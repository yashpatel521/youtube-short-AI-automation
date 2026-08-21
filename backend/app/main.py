import time
import threading
from fastapi import FastAPI, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import OUTPUT_DIR
from app.services import db_service, youtube_service
from app.services.comment_worker import comment_worker
from app.routers import youtube, video, settings, automation, comments
from app.models import (
    ViralIdeasRequest, 
    AutoGeneratePostRequest, 
    SuggestionRequest, 
    ScriptRequest, 
    CustomScriptRequest
)

# Initialize FastAPI App
app = FastAPI(
    title="Local Video Generator & YouTube Automation",
    description="Backend API for generating vertical video shorts and posting to YouTube."
)

# Configure CORS for local development (Vite frontend on 5173 / 5174)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for robustness during dev port shifting
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Modular API Routers
app.include_router(settings.router)
app.include_router(youtube.router)
app.include_router(video.router)
app.include_router(automation.router)
app.include_router(comments.router)


# Backward Compatibility Fallbacks for Legacy Ideas Endpoints
@app.post("/api/viral-ideas")
def fallback_viral_ideas(req: ViralIdeasRequest):
    return video.get_viral_ideas_endpoint(req)

@app.post("/api/viral-ideas/refresh")
def fallback_viral_ideas_refresh(req: ViralIdeasRequest):
    return video.refresh_viral_ideas_endpoint(req)

@app.post("/api/viral-ideas/auto-generate-post")
def fallback_auto_generate_post(req: AutoGeneratePostRequest, background_tasks: BackgroundTasks):
    return video.auto_generate_and_post_idea(req, background_tasks)

# Backward Compatibility Fallbacks for Legacy Script Endpoints
@app.post("/api/script/suggest-ideas")
def fallback_suggest_ideas(req: SuggestionRequest):
    return video.suggest_viral_ideas_endpoint(req)

@app.post("/api/script/generate")
def fallback_generate_script(req: ScriptRequest):
    return video.generate_ai_script(req)

@app.post("/api/script/generate-custom")
def fallback_generate_custom(req: CustomScriptRequest):
    return video.generate_custom_script_details(req)

def background_upload_worker():
    """Background loop that checks for due scheduled uploads and uploads them to YouTube."""
    db_svc = db_service
    yt_svc = youtube_service
    
    print("Background YouTube upload worker started.")
    while True:
        try:
            if not yt_svc.is_authenticated():
                time.sleep(60)
                continue
                
            due_uploads = db_svc.get_due_uploads()
            for upload in due_uploads:
                filename = upload["filename"]
                title = upload["title"]
                description = upload["description"]
                tags_str = upload.get("tags") or ""
                category_id = upload.get("category_id") or "22"
                
                tags = [t.strip() for t in tags_str.split(",") if t.strip()] if isinstance(tags_str, str) else (tags_str or [])
                
                print(f"[Scheduler] Processing scheduled upload: {filename} ({title})...")
                file_path = OUTPUT_DIR / filename
                if not file_path.exists():
                    db_svc.update_scheduled_upload_status(filename, status="failed", error="File not found in output directory.")
                    continue
                
                # Upload short
                res = yt_svc.upload_short(
                    video_path=str(file_path),
                    title=title,
                    description=description,
                    tags=tags,
                    privacy_status="public", # scheduled videos are published as public
                    category_id=category_id
                )
                
                if res.get("success", False):
                    yt_id = res.get("video_id")
                    db_svc.update_scheduled_upload_status(filename, status="published", youtube_id=yt_id)
                    db_svc.mark_history_as_posted(filename, yt_id)
                    print(f"[Scheduler] Successfully published video: {filename} to YouTube.")
                else:
                    err = res.get("error", "Upload failed")
                    db_svc.update_scheduled_upload_status(filename, status="failed", error=err)
                    print(f"[Scheduler] Failed to upload video {filename}: {err}")
                    
        except Exception as e:
            print(f"[Scheduler] Error in background upload worker: {e}")
            
        time.sleep(60)

# Start worker threads
worker_thread = threading.Thread(target=background_upload_worker, daemon=True)
worker_thread.start()

# Start background comment auto-reply worker
try:
    comment_worker.start()
except Exception as e:
    print(f"Failed to start comment worker: {e}")

