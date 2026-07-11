import uuid
import shutil
import asyncio
import threading
from fastapi import APIRouter, HTTPException, BackgroundTasks, Body

import os
from PIL import Image
from fastapi.responses import FileResponse
from app.config import OUTPUT_DIR, TEMP_DIR
from app.services import db_service, ai_service, video_engine
from app.models import (
    StoryGenerateRequest, StoryCompileRequest, SceneNarrationRequest,
    ScenePromptRequest, SceneImageRequest, SceneDeleteImageRequest
)

router = APIRouter(prefix="/api/stories", tags=["stories"])

def run_story_compilation(job_id: str, req: StoryCompileRequest):
    """Background storyteller compilation runner."""
    db_service.update_job(job_id, status="rendering", progress=5, add_log="Story details received. Commencing image and speech generation...")
    try:
        def update_progress(val: int):
            db_service.update_job(job_id, progress=val, add_log=f"Compiling story elements... progress: {val}%")

        # Load latest chapter scenes from database if story_id and chapter_idx are present (Start from Fail)
        chapters_payload = req.chapters
        if req.story_id is not None and req.chapter_idx is not None:
            stories = db_service.get_stories()
            story = next((s for s in stories if s["id"] == req.story_id), None)
            if story and req.chapter_idx < len(story["chapters"]):
                chapters_payload = story["chapters"][req.chapter_idx]["scenes"]
                print(f"[Start-from-Fail] Loaded latest {len(chapters_payload)} scenes from database for compilation.")

        output_file = asyncio.run(video_engine.compile_story_video(
            story_package={
                "title": req.title,
                "chapters": chapters_payload
            },
            style=req.style,
            voice=req.voice,
            progress_callback=update_progress,
            story_id=req.story_id,
            chapter_idx=req.chapter_idx
        ))

        # Calculate relative path from output directory
        try:
            rel_video_path = str(output_file.relative_to(video_engine.output_dir)).replace("\\", "/")
        except Exception:
            rel_video_path = output_file.name

        db_service.update_job(
            job_id,
            status="completed",
            progress=100,
            video_path=str(output_file),
            video_filename=rel_video_path,
            add_log="Storybook compilation completed successfully!"
        )
        db_service.add_history_entry(rel_video_path, req.title)

        # Update the SQLite database story record with generated images!
        if req.story_id is not None and req.chapter_idx is not None:
            stories = db_service.get_stories()
            story = next((s for s in stories if s["id"] == req.story_id), None)
            if story:
                # Update the scenes list with the generated image URLs!
                story["chapters"][req.chapter_idx]["scenes"] = chapters_payload
                
                # Also save the generated video output filename in the chapter's compiled_video!
                story["chapters"][req.chapter_idx]["compiled_video"] = rel_video_path
                
                db_service.save_story(story)

    except Exception as e:
        db_service.update_job(
            job_id,
            status="failed",
            error=str(e),
            add_log=f"Fatal story compilation error: {str(e)}"
        )

@router.post("/generate-script")
def generate_story_script_endpoint(req: StoryGenerateRequest):
    """Generates a story storytelling script and image storyboard prompts."""
    try:
        story = ai_service.generate_story_script(
            topic=req.topic,
            style=req.style,
            duration=req.duration,
            story_title=req.story_title,
            previous_context=req.previous_context
        )
        return story
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini story synthesis error: {str(e)}")

@router.post("/generate-images")
def generate_story_images_endpoint(req: dict = Body(...), background_tasks: BackgroundTasks = None):
    """Generates illustration images for all scenes inside a chapter storyboard in the background."""
    story_id = req.get("story_id")
    chapter_idx = req.get("chapter_idx")
    style = req.get("style", "kids_cartoon")
    scenes = req.get("scenes", [])
    all_beats = req.get("all_beats", False)

    def run_image_generation():
        db_svc = db_service
        engine = video_engine
        
        stories = db_svc.get_stories()
        story = next((s for s in stories if s["id"] == story_id), None)
        if not story or chapter_idx >= len(story["chapters"]):
            return

        chapter = story["chapters"][chapter_idx]
        chapter_id = chapter["id"]
        db_scenes = chapter["scenes"]

        folder_path = TEMP_DIR / f"story_{story_id}" / f"chapter_{chapter_idx}"
        folder_path.mkdir(parents=True, exist_ok=True)

        updated_scenes = []
        for s_idx, scene_data in enumerate(scenes):
            db_scene = db_scenes[s_idx] if s_idx < len(db_scenes) else None
            
            prompts = scene_data.get("image_prompts") or []
            if not prompts:
                single_prompt = scene_data.get("image_prompt", "")
                prompts = [p.strip() for p in single_prompt.split("\n") if p.strip()] if single_prompt else ["a beautiful fantasy scene illustration"]

            prompts = prompts[:3]
            
            image_urls = db_scene.get("image_urls") if db_scene else []
            if not isinstance(image_urls, list):
                image_urls = []
            while len(image_urls) < len(prompts):
                image_urls.append("")

            beats_to_generate = range(len(prompts)) if all_beats else [0]

            for p_idx in beats_to_generate:
                prompt_str = prompts[p_idx]
                filename = f"thumb_{story_id}_{chapter_idx}_{s_idx}_sub{p_idx}.png"
                dest_path = folder_path / filename
                
                # Check if it already exists, skip if so
                if dest_path.exists() and image_urls[p_idx]:
                    continue
                
                generated_path = engine._generate_story_image(prompt_str, style, f"thumb_{s_idx}_sub{p_idx}")
                if generated_path and generated_path.exists():
                    shutil.copy(str(generated_path), str(dest_path))
                    image_urls[p_idx] = f"story_{story_id}/chapter_{chapter_idx}/{filename}"
                    try:
                        generated_path.unlink()
                    except:
                        pass
            
            # Recalculate first non-empty preview image_url
            image_url = ""
            for url in image_urls:
                if url:
                    image_url = url
                    break

            scene_id = f"{chapter_id}_sc{s_idx}"
            db_svc.update_scene_image(scene_id, image_url, image_urls)
            
            scene_data["image_url"] = image_url
            scene_data["image_urls"] = image_urls
            updated_scenes.append(scene_data)

        story["chapters"][chapter_idx]["scenes"] = updated_scenes
        db_svc.save_story(story)

    if background_tasks:
        background_tasks.add_task(run_image_generation)
    else:
        threading.Thread(target=run_image_generation).start()

    return {"success": True, "message": "Storyboard images generation started in background."}

@router.post("/compile")
def compile_story_video_endpoint(req: StoryCompileRequest, background_tasks: BackgroundTasks):
    """Enqueues compilation of the long storytelling video in the background."""
    job_id = str(uuid.uuid4())
    db_service.create_job(job_id, status="pending", progress=0)
    db_service.update_job(job_id, add_log="Story video compilation job created. Initializing background rendering threads...")
    
    background_tasks.add_task(run_story_compilation, job_id, req)
    return {"job_id": job_id, "status": "pending"}

@router.get("")
def get_stories_endpoint():
    """Fetches all stories (playlists) saved in the SQLite database."""
    return {"stories": db_service.get_stories()}

@router.post("")
def save_story_endpoint(story: dict = Body(...)):
    """Saves or updates a story configuration directly inside SQLite."""
    try:
        db_service.save_story(story)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save story: {str(e)}")

@router.delete("/{story_id}")
def delete_story_endpoint(story_id: str):
    """Deletes a story from SQLite by its unique ID."""
    try:
        db_service.delete_story(story_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete story: {str(e)}")

@router.post("/scene/generate-narration")
def generate_scene_narration_endpoint(req: SceneNarrationRequest):
    """Generates spoken narration for a single scene following the story plot progression context."""
    try:
        stories = db_service.get_stories()
        story = next((s for s in stories if s["id"] == req.story_id), None)
        if not story:
            raise HTTPException(status_code=404, detail="Story not found")

        prev_context = ""
        for idx, ch in enumerate(story.get("chapters", [])):
            if idx < req.chapter_idx:
                prev_context += f"Chapter {idx + 1}: {ch.get('title')}\n"
                for s_idx, sc in enumerate(ch.get("scenes", [])):
                    if sc.get("narration"):
                        prev_context += f"  - Scene {s_idx + 1}: {sc['narration']}\n"
            elif idx == req.chapter_idx:
                prev_context += f"Current Chapter {idx + 1}: {ch.get('title')}\n"
                for s_idx, sc in enumerate(ch.get("scenes", [])):
                    if s_idx < len(ch.get("scenes", [])) and sc.get("narration"):
                        prev_context += f"  - Scene {s_idx + 1}: {sc['narration']}\n"
                break

        narration = ai_service.generate_scene_narration(
            previous_context=prev_context,
            scene_title=req.scene_title
        )
        return {"narration": narration}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scene/generate-prompt")
def generate_scene_prompt_endpoint(req: ScenePromptRequest):
    """Generates exactly 3 sequential image prompts based on narration."""
    try:
        prompts = ai_service.generate_scene_image_prompts(
            narration=req.narration,
            style=req.style
        )
        return {"image_prompts": prompts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scene/generate-image")
def generate_scene_image_endpoint(req: SceneImageRequest):
    """Generates illustration image for a specific visual beat in a scene."""
    try:
        folder_path = TEMP_DIR / f"story_{req.story_id}" / f"chapter_{req.chapter_idx}"
        folder_path.mkdir(parents=True, exist_ok=True)

        prefix = f"{req.story_id}_{req.chapter_idx}_{req.scene_idx}_sub{req.beat_idx}"
        temp_img = video_engine._generate_story_image(req.prompt, req.style, prefix)
        if not temp_img or not temp_img.exists():
            raise RuntimeError("Stable Diffusion inference failed to write image file.")

        filename = f"thumb_{req.story_id}_{req.chapter_idx}_{req.scene_idx}_sub{req.beat_idx}.png"
        final_path = folder_path / filename
        shutil.copy(str(temp_img), str(final_path))

        try:
            temp_img.unlink()
        except:
            pass

        db_relative_url = f"story_{req.story_id}/chapter_{req.chapter_idx}/{filename}"
        
        stories = db_service.get_stories()
        story = next((s for s in stories if s["id"] == req.story_id), None)
        if not story or req.chapter_idx >= len(story["chapters"]):
            raise RuntimeError("Failed to resolve story/chapter metadata.")

        chapter = story["chapters"][req.chapter_idx]
        chapter_id = chapter["id"]
        scene_id = f"{chapter_id}_sc{req.scene_idx}"
        
        scenes = chapter.get("scenes", [])
        scene = scenes[req.scene_idx] if req.scene_idx < len(scenes) else None
        if not scene:
            raise RuntimeError("Target scene record not found in database.")

        image_urls = scene.get("image_urls") or []
        while len(image_urls) <= req.beat_idx:
            image_urls.append("")

        image_urls[req.beat_idx] = db_relative_url
        
        image_url = ""
        for url in image_urls:
            if url:
                image_url = url
                break

        db_service.update_scene_image(scene_id, image_url, image_urls)

        return {
            "success": True,
            "image_url": image_url,
            "image_urls": image_urls
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scene/delete-image")
def delete_scene_image_endpoint(req: SceneDeleteImageRequest):
    """Deletes the physical image and clears links in database."""
    try:
        filename = f"thumb_{req.story_id}_{req.chapter_idx}_{req.scene_idx}_sub{req.beat_idx}.png"
        file_path = TEMP_DIR / f"story_{req.story_id}" / f"chapter_{req.chapter_idx}" / filename
        if file_path.exists():
            file_path.unlink()

        stories = db_service.get_stories()
        story = next((s for s in stories if s["id"] == req.story_id), None)
        if not story or req.chapter_idx >= len(story["chapters"]):
            raise RuntimeError("Failed to resolve story/chapter metadata.")

        chapter = story["chapters"][req.chapter_idx]
        chapter_id = chapter["id"]
        scene_id = f"{chapter_id}_sc{req.scene_idx}"
        
        scenes = chapter.get("scenes", [])
        scene = scenes[req.scene_idx] if req.scene_idx < len(scenes) else None
        if not scene:
            raise RuntimeError("Target scene record not found in database.")

        image_urls = scene.get("image_urls") or []
        if req.beat_idx < len(image_urls):
            image_urls[req.beat_idx] = ""

        image_url = ""
        for url in image_urls:
            if url:
                image_url = url
                break

        db_service.update_scene_image(scene_id, image_url, image_urls)
        return {"success": True, "image_url": image_url, "image_urls": image_urls}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/scene/image/{path:path}")
def serve_scene_image_endpoint(path: str):
    """Serves structured scene images from the local temp directory."""
    file_path = TEMP_DIR / path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found.")
    return FileResponse(str(file_path), media_type="image/png")

