import time
import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import OUTPUT_DIR
from app.services import db_service, youtube_service
from app.routers import youtube, stories, video, settings

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
app.include_router(stories.router)
app.include_router(video.router)

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

# Start worker thread
worker_thread = threading.Thread(target=background_upload_worker, daemon=True)
worker_thread.start()
