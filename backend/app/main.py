import os
import shutil
import uuid
import json
import datetime
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
from pydantic import BaseModel, Field

# Backend imports
from app.config import PORT, HOST, OUTPUT_DIR, TEMP_DIR, CLIENT_SECRETS_FILE
from app.services.video_engine import VideoEngine
from app.services.youtube_service import YouTubeService
from app.services.ai_service import AIService
from app.services.db_service import DBService

# Initialize FastAPI App
app = FastAPI(
    title="Local Video Generator & YouTube Automation",
    description="Backend API for generating vertical video shorts and posting to YouTube."
)

# Configure CORS for local development (Vite frontend on 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Services Singletons
video_engine = VideoEngine()
youtube_service = YouTubeService()
ai_service = AIService()
db_service = DBService()

# --- Request/Response Models ---
class ScriptRequest(BaseModel):
    topic: str
    previous_shorts: List[dict] = []
    competitor_shorts: List[dict] = []
    gemini_key: Optional[str] = None

class CustomScriptRequest(BaseModel):
    title: str
    description: str
    gemini_key: Optional[str] = None

class CompileRequest(BaseModel):
    script_text: str
    title: Optional[str] = None
    voice: str = "en-US-EmmaMultilingualNeural"
    pexels_query: str = "abstract loop"
    highlight_color: str = "#FFD700"
    music_filename: Optional[str] = None
    music_volume: float = 0.15
    enable_subscribe: bool = True
    pexels_key: Optional[str] = None
    background_source: str = "pexels" # "pexels" or "local_model"
    visual_prompt: Optional[str] = None

class UploadRequest(BaseModel):
    video_filename: str
    title: str
    description: str
    tags: List[str] = []
    privacy_status: str = "private"

class SettingsRequest(BaseModel):
    gemini_api_key: Optional[str] = None
    pexels_api_key: Optional[str] = None
    youtube_client_id: Optional[str] = None
    youtube_client_secret: Optional[str] = None

# --- Endpoints ---

@app.get("/api/status")
def get_status():
    """Checks overall backend and YouTube OAuth authentication status."""
    return {
        "status": "online",
        "youtube_authenticated": youtube_service.is_authenticated(),
        "client_secrets_configured": CLIENT_SECRETS_FILE.exists()
    }

# --- YouTube Auth Routes ---

@app.get("/api/youtube/auth-url")
def get_youtube_auth_url(redirect_uri: str = Query("http://localhost:8000/api/youtube/callback")):
    """Generates OAuth2 authentication URL."""
    try:
        url = youtube_service.get_auth_url(redirect_uri)
        return {"url": url}
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth Flow initialization error: {str(e)}")

@app.get("/api/youtube/callback")
def youtube_callback(code: str, state: Optional[str] = None):
    """Callback redirect target for Google OAuth code exchange."""
    redirect_uri = f"http://localhost:{PORT}/api/youtube/callback"
    try:
        youtube_service.fetch_token_from_code(code, redirect_uri)
        # Redirect back to frontend settings page on success
        return RedirectResponse(url="http://localhost:5173/settings?auth=success")
    except Exception as e:
        return RedirectResponse(url=f"http://localhost:5173/settings?auth=error&detail={str(e)}")

@app.get("/api/youtube/channel")
def get_channel_info():
    """Retrieves current channel statistics and past Shorts performance."""
    if not youtube_service.is_authenticated():
        raise HTTPException(status_code=401, detail="YouTube account is not authenticated. Please log in first.")
    
    stats = youtube_service.get_channel_stats()
    if "error" in stats:
        raise HTTPException(status_code=500, detail=stats["error"])
    return stats

@app.get("/api/competitors")
def search_competitors(keyword: str = Query(..., description="Topic keywords to search")):
    """Queries YouTube API or public scraper for competitor metrics."""
    results = youtube_service.search_competitor_shorts(keyword)
    return {"results": results}

class SuggestionRequest(BaseModel):
    gemini_key: Optional[str] = None
    previous_shorts: Optional[List[dict]] = None
    competitor_shorts: Optional[List[dict]] = None

@app.post("/api/script/suggest-ideas")
def suggest_viral_ideas_endpoint(req: SuggestionRequest):
    """Uses Gemini API to suggest 3 viral Shorts ideas based on channel history and competitors."""
    key_override = req.gemini_key
    try:
        ideas = ai_service.suggest_viral_ideas(
            previous_shorts=req.previous_shorts or [],
            competitor_shorts=req.competitor_shorts or [],
            api_key_override=key_override
        )
        return {"suggestions": ideas}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini ideas generation error: {str(e)}")

class ViralIdeasRequest(BaseModel):
    gemini_key: Optional[str] = None
    previous_shorts: Optional[List[dict]] = None
    competitor_shorts: Optional[List[dict]] = None

@app.post("/api/viral-ideas")
def get_viral_ideas_endpoint(req: ViralIdeasRequest):
    """Retrieves cached 10 viral ideas, or generates them using Gemini if the database is empty."""
    try:
        cached_ideas = db_service.get_viral_ideas()
        if cached_ideas:
            return {"ideas": cached_ideas}

        # Cache is empty, fetch from Gemini
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

@app.post("/api/viral-ideas/refresh")
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

# --- AI Script Generation Route ---

@app.post("/api/script/generate-custom")
def generate_custom_script_details(req: CustomScriptRequest):
    """Uses Gemini API to generate custom script details (idea, visual prompt, narration) from title and description."""
    key_override = req.gemini_key
    try:
        details = ai_service.generate_custom_details(
            title=req.title,
            description=req.description,
            api_key_override=key_override
        )
        return details
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Custom details generation error: {str(e)}")

@app.post("/api/script/generate")
def generate_ai_script(req: ScriptRequest):
    """Uses Gemini API to write a 20-30s structured Shorts script."""
    # Temporarily override key if user provided one in UI settings
    key_override = req.gemini_key
    try:
        package = ai_service.generate_script(
            topic=req.topic,
            previous_shorts=req.previous_shorts,
            competitor_shorts=req.competitor_shorts,
            api_key_override=key_override
        )
        return package
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini script synthesis error: {str(e)}")

# --- Video Synthesis Routes ---

def run_video_compilation(job_id: str, req: CompileRequest):
    """Background compilation runner."""
    db_service.update_job(job_id, status="rendering", progress=5, add_log="Speech synthesis started...")
    
    # Override Pexels key if supplied dynamically
    if req.pexels_key:
        os.environ["PEXELS_API_KEY"] = req.pexels_key
        
    try:
        # Determine background music path
        music_path = None
        if req.music_filename:
            # We can support user-uploaded music files in temp/
            path_check = TEMP_DIR / req.music_filename
            if path_check.exists():
                music_path = str(path_check)

        db_service.update_job(job_id, add_log="Downloading stock assets or setting gradient fallbacks...")
        
        def update_progress(val: int):
            db_service.update_job(job_id, progress=val)

        import asyncio
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
        # Save to persistent history
        db_service.add_history_entry(output_file.name, req.title or "Untitled Shorts Script")
    except Exception as e:
        db_service.update_job(
            job_id, 
            status="failed", 
            error=str(e), 
            add_log=f"Fatal compile error: {str(e)}"
        )

@app.post("/api/video/compile")
def start_compilation(req: CompileRequest, background_tasks: BackgroundTasks):
    """Starts the video compiler pipeline in a background task."""
    job_id = str(uuid.uuid4())
    db_service.create_job(job_id, status="pending", progress=0)
    db_service.update_job(job_id, add_log="Job created. Initializing rendering thread...")
    
    background_tasks.add_task(run_video_compilation, job_id, req)
    return {"job_id": job_id, "status": "pending"}

@app.get("/api/video/status/{job_id}")
def get_job_status(job_id: str):
    """Checks the status and progress logs of a video generation task."""
    job = db_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Generation job not found.")
    return job

@app.get("/api/video/preview/{filename}")
def preview_video(filename: str):
    """Streams the compiled video to the frontend player."""
    file_path = OUTPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found.")
    return FileResponse(str(file_path), media_type="video/mp4")

# --- YouTube Publish Route ---

@app.post("/api/youtube/upload")
def upload_to_youtube(req: UploadRequest):
    """Publishes a compiled video directly to the user's channel as a Short."""
    if not youtube_service.is_authenticated():
        raise HTTPException(status_code=401, detail="YouTube client is not authenticated.")
    
    file_path = OUTPUT_DIR / req.video_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Compiled video file {req.video_filename} not found.")

    res = youtube_service.upload_short(
        video_path=str(file_path),
        title=req.title,
        description=req.description,
        tags=req.tags,
        privacy_status=req.privacy_status
    )
    
    if not res.get("success", False):
        raise HTTPException(status_code=500, detail=res.get("error", "Upload failed"))
        
    # Mark as uploaded in the database
    db_service.mark_history_as_posted(req.video_filename, res.get("video_id"))
    return res

@app.get("/api/video/history")
def get_video_history():
    """Returns the list of previously compiled videos and their upload status."""
    return {"history": db_service.get_history()}

@app.delete("/api/video/delete/{filename}")
def delete_video(filename: str):
    """Deletes a video record from the database and deletes the physical file from output/."""
    # 1. Delete physical file if exists
    file_path = OUTPUT_DIR / filename
    if file_path.exists():
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Error removing physical file: {e}")
            
    # 2. Delete database entry
    db_service.delete_history_entry(filename)
    return {"success": True}

# --- Quality Lab Evaluation Routes ---

class QualityReviewRequest(BaseModel):
    filename: str
    script_text: str
    visual_rating: int
    audio_rating: int
    pacing_rating: int
    notes: str

@app.get("/api/quality/reviews")
def get_quality_reviews():
    """Retrieves all submitted quality ratings and scored history logs."""
    return {"reviews": db_service.get_quality_reviews()}

@app.post("/api/quality/review")
def save_quality_review(req: QualityReviewRequest):
    """Saves or updates a user quality and animation review for a video."""
    try:
        db_service.save_quality_review(
            filename=req.filename,
            script_text=req.script_text,
            visual_rating=req.visual_rating,
            audio_rating=req.audio_rating,
            pacing_rating=req.pacing_rating,
            notes=req.notes
        )
        return {"success": True, "message": "Quality review saved successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save quality review: {str(e)}")

# --- System Settings Routes ---

@app.get("/api/settings")
def get_keys_settings():
    """Returns local API key names and configurations (without showing full key values)."""
    from app.config import GEMINI_API_KEY, PEXELS_API_KEY
    
    # Load raw client secrets if present
    client_secrets = {}
    if CLIENT_SECRETS_FILE.exists():
        try:
            with open(CLIENT_SECRETS_FILE, "r") as f:
                client_secrets = json.load(f)
        except Exception:
            pass

    return {
        "gemini_api_key_configured": bool(GEMINI_API_KEY),
        "pexels_api_key_configured": bool(PEXELS_API_KEY),
        "youtube_client_secrets_configured": CLIENT_SECRETS_FILE.exists(),
        "client_id": client_secrets.get("web", {}).get("client_id", "") or client_secrets.get("installed", {}).get("client_id", "")
    }

@app.post("/api/settings")
def update_settings(req: SettingsRequest):
    """Updates API keys and Google client_secrets.json files dynamically."""
    try:
        env_path = Path(__file__).resolve().parent.parent / ".env"
        env_lines = []
        
        # Read existing file to preserve other configs
        if env_path.exists():
            with open(env_path, "r") as f:
                env_lines = f.readlines()

        config_map = {}
        for line in env_lines:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                config_map[k.strip()] = v.strip()

        # Update values
        if req.gemini_api_key is not None:
            config_map["GEMINI_API_KEY"] = req.gemini_api_key
            os.environ["GEMINI_API_KEY"] = req.gemini_api_key
        if req.pexels_api_key is not None:
            config_map["PEXELS_API_KEY"] = req.pexels_api_key
            os.environ["PEXELS_API_KEY"] = req.pexels_api_key

        # Re-write .env file
        with open(env_path, "w") as f:
            for k, v in config_map.items():
                f.write(f"{k}={v}\n")

        # Dynamically write client secrets if provided
        if req.youtube_client_id and req.youtube_client_secret:
            secrets_data = {
                "installed": {
                    "client_id": req.youtube_client_id,
                    "client_secret": req.youtube_client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "redirect_uris": [f"http://localhost:{PORT}/api/youtube/callback"]
                }
            }
            with open(CLIENT_SECRETS_FILE, "w") as f:
                import json
                json.dump(secrets_data, f, indent=4)

        return {"success": True, "message": "Settings updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")

# Serve frontend build artifacts if running production build
# For local dev, Vite handles the frontend.
import json
