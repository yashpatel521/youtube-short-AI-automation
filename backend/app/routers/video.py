import os
import uuid
import asyncio
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import FileResponse

from app.config import OUTPUT_DIR, TEMP_DIR
from app.services import db_service, ai_service, video_engine, youtube_service
from app.models import (
    ScriptRequest, CustomScriptRequest, CompileRequest, AutoGeneratePostRequest,
    SuggestionRequest, ViralIdeasRequest
)

router = APIRouter(prefix="/api/video", tags=["video"])

def run_auto_generate_and_post(job_id: str, prompt_query: str, idea_title: str):
    """Background task to generate script, compile with pexels, and publish to YouTube in one click."""
    db_service.update_job(job_id, status="generating", progress=10, add_log="Script generation starting...")
    try:
        # 1. Generate Script
        db_service.update_job(job_id, add_log=f"Querying Gemini for topic: '{prompt_query}'...")
        package = ai_service.generate_script(topic=prompt_query, previous_shorts=[], competitor_shorts=[])
        script_text = "\n".join([seg.narration for seg in package.segments])
        db_service.update_job(
            job_id,
            progress=30,
            add_log=f"Script generated successfully: '{package.title}'. Narrations count: {len(package.segments)}. Splicing audio and visuals..."
        )
        
        # 2. Compile Video (using Pexels as source)
        segments_dict = [seg.dict() for seg in package.segments]
        db_service.update_job(job_id, status="rendering", progress=45, add_log="Downloading Pexels motion background clips & stitching...")
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        video_path = loop.run_until_complete(
            video_engine.compile_video(
                script_text=script_text,
                pexels_query=prompt_query,
                background_source="pexels",
                segments=segments_dict,
                progress_callback=lambda p: db_service.update_job(job_id, progress=45 + int(p * 0.35), add_log=f"Rendering progress: {p}%")
            )
        )
        
        video_filename = video_path.name
        db_service.add_history_entry(video_filename, package.title)
        db_service.update_job(
            job_id,
            progress=85,
            add_log="Video compiled successfully. Generating optimized SEO metadata tags..."
        )
        
        # 3. Optimize Tags & Upload to YouTube
        meta = ai_service.generate_youtube_metadata(title=package.title, description=package.description)
        db_service.update_job(job_id, progress=90, add_log="Metadata ready. Uploading to YouTube channel...")
        
        res = youtube_service.upload_short(
            video_path=str(video_path),
            title=package.title,
            description=package.description,
            tags=meta.tags,
            privacy_status="public",  # automatically publish public
            category_id=meta.category_id
        )
        
        if res.get("success", False):
            yt_id = res.get("video_id")
            db_service.mark_history_as_posted(video_filename, yt_id)
            db_service.update_job(
                job_id,
                status="completed",
                progress=100,
                video_path=str(video_path),
                video_filename=video_filename,
                add_log=f"Short posted successfully to YouTube! Watch URL: https://youtube.com/watch?v={yt_id}"
            )
        else:
            raise RuntimeError(res.get("error", "YouTube upload failed"))
            
    except Exception as e:
        error_msg = str(e)
        print(f"Error in auto-generation & post: {error_msg}")
        db_service.update_job(
            job_id,
            status="failed",
            error=error_msg,
            add_log=f"Autopost job failed: {error_msg}"
        )

def run_video_compilation(job_id: str, req: CompileRequest):
    """Background compilation runner."""
    db_service.update_job(job_id, status="rendering", progress=5, add_log="Speech synthesis started...")
    
    if req.pexels_key:
        os.environ["PEXELS_API_KEY"] = req.pexels_key
        
    try:
        music_path = None
        if req.music_filename:
            path_check = TEMP_DIR / req.music_filename
            if path_check.exists():
                music_path = str(path_check)

        db_service.update_job(job_id, add_log="Downloading stock assets or setting gradient fallbacks...")
        
        def update_progress(val: int):
            db_service.update_job(job_id, progress=val)

        output_file = asyncio.run(video_engine.compile_video(
            script_text=req.script_text,
            voice=req.voice,
            pexels_query=req.pexels_query,
            highlight_color=req.highlight_color,
            music_path=music_path,
            music_volume=req.music_volume,
            enable_subscribe=req.enable_subscribe,
            background_source=req.background_source,
            visual_prompt=req.visual_prompt,
            segments=req.segments,
            progress_callback=update_progress
        ))

        db_service.update_job(
            job_id, 
            status="completed", 
            progress=100, 
            video_path=str(output_file), 
            video_filename=output_file.name,
            add_log="Compilation completed successfully!"
        )
        db_service.add_history_entry(output_file.name, req.title or "Untitled Shorts Script")
    except Exception as e:
        db_service.update_job(
            job_id, 
            status="failed", 
            error=str(e), 
            add_log=f"Fatal compile error: {str(e)}"
        )

@router.post("/compile")
def start_compilation(req: CompileRequest, background_tasks: BackgroundTasks):
    """Starts the video compiler pipeline in a background task."""
    job_id = str(uuid.uuid4())
    db_service.create_job(job_id, status="pending", progress=0)
    db_service.update_job(job_id, add_log="Job created. Initializing rendering thread...")
    
    background_tasks.add_task(run_video_compilation, job_id, req)
    return {"job_id": job_id, "status": "pending"}

@router.get("/status/{job_id}")
def get_job_status(job_id: str):
    """Checks the status and progress logs of a video generation task."""
    job = db_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Generation job not found.")
    return job

@router.get("/jobs")
def get_all_jobs_endpoint():
    """Retrieves all compiled/auto-generation jobs in the system queue."""
    return {"jobs": db_service.get_all_jobs()}

@router.get("/preview/{path:path}")
def preview_video(path: str):
    """Streams the compiled video to the frontend player."""
    file_path = OUTPUT_DIR / path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found.")
    return FileResponse(str(file_path), media_type="video/mp4")

@router.get("/history")
def get_video_history():
    """Returns the list of previously compiled videos and their upload status."""
    return {"history": db_service.get_history()}

@router.delete("/delete/{filename}")
def delete_video(filename: str):
    """Deletes a video record from the database and deletes the physical file from output/."""
    file_path = OUTPUT_DIR / filename
    if file_path.exists():
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Error removing physical file: {e}")
            
    db_service.delete_history_entry(filename)
    return {"success": True}

# --- Separate endpoints for /api/script/ and /api/viral-ideas/ that route here but are registered under appropriate sub-prefixes if desired ---
# We will define a nested router/endpoints structure or include them directly

# We will define separate routers or register these endpoints here:
# Note: For routing, FastAPI lets us register different paths on the same router:

@router.post("/script/suggest-ideas")
def suggest_viral_ideas_endpoint(req: SuggestionRequest):
    """Uses Gemini API to suggest 3 viral Shorts ideas based on channel history and competitors."""
    try:
        ideas = ai_service.suggest_viral_ideas(
            previous_shorts=req.previous_shorts or [],
            competitor_shorts=req.competitor_shorts or [],
            api_key_override=req.gemini_key
        )
        return {"suggestions": ideas}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini ideas generation error: {str(e)}")

@router.post("/viral-ideas")
def get_viral_ideas_endpoint(req: ViralIdeasRequest):
    """Retrieves cached 10 viral ideas, or generates them using Gemini if the database is empty."""
    try:
        cached_ideas = db_service.get_viral_ideas()
        if cached_ideas:
            return {"ideas": cached_ideas}

        ideas = ai_service.generate_10_viral_ideas(
            previous_shorts=req.previous_shorts or [],
            competitor_shorts=req.competitor_shorts or [],
            api_key_override=req.gemini_key
        )
        db_service.save_viral_ideas(ideas)
        return {"ideas": db_service.get_viral_ideas()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch/generate viral ideas: {str(e)}")

@router.post("/viral-ideas/refresh")
def refresh_viral_ideas_endpoint(req: ViralIdeasRequest):
    """Bypasses SQLite cache, queries Gemini for 10 new ideas, and updates the database."""
    try:
        ideas = ai_service.generate_10_viral_ideas(
            previous_shorts=req.previous_shorts or [],
            competitor_shorts=req.competitor_shorts or [],
            api_key_override=req.gemini_key
        )
        db_service.save_viral_ideas(ideas)
        return {"ideas": db_service.get_viral_ideas()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh viral ideas: {str(e)}")

@router.post("/script/generate-custom")
def generate_custom_script_details(req: CustomScriptRequest):
    """Uses Gemini API to generate custom script details (idea, visual prompt, narration) from title and description."""
    try:
        details = ai_service.generate_custom_details(
            title=req.title,
            description=req.description,
            api_key_override=req.gemini_key
        )
        return details
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Custom details generation error: {str(e)}")

@router.post("/script/generate")
def generate_ai_script(req: ScriptRequest):
    """Uses Gemini API to write a 20-30s structured Shorts script."""
    try:
        package = ai_service.generate_script(
            topic=req.topic,
            previous_shorts=req.previous_shorts,
            competitor_shorts=req.competitor_shorts,
            api_key_override=req.gemini_key
        )
        return package
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini script synthesis error: {str(e)}")

@router.post("/viral-ideas/auto-generate-post")
def auto_generate_and_post_idea(req: AutoGeneratePostRequest, background_tasks: BackgroundTasks):
    """Starts the background pipeline to write, compile, and publish a Short for a viral idea."""
    if not youtube_service.is_authenticated():
        raise HTTPException(status_code=401, detail="YouTube account is not authenticated.")
        
    job_id = str(uuid.uuid4())
    db_service.create_job(job_id, status="queued", progress=0)
    db_service.update_job(job_id, add_log="One-click generation and publish queued...")
    
    background_tasks.add_task(run_auto_generate_and_post, job_id, req.prompt_query, req.idea_title)
    return {"job_id": job_id}
