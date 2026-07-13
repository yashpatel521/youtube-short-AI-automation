import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Body
from fastapi.responses import RedirectResponse

from app.config import CLIENT_SECRETS_FILE, PORT, OUTPUT_DIR, YOUTUBE_CATEGORIES, TEMP_DIR
from app.services import youtube_service, ai_service, db_service
from app.models import UploadRequest, ScheduleRequest, SuggestMetadataRequest, UploadThumbnailRequest

router = APIRouter(prefix="/api/youtube", tags=["youtube"])

@router.get("/auth-url")
def get_youtube_auth_url(redirect_uri: str = Query("http://localhost:8000/api/youtube/callback")):
    """Generates OAuth2 authentication URL."""
    try:
        url = youtube_service.get_auth_url(redirect_uri)
        return {"url": url}
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth Flow initialization error: {str(e)}")

@router.get("/callback")
def youtube_callback(code: str, state: Optional[str] = None):
    """Callback redirect target for Google OAuth code exchange."""
    redirect_uri = f"http://localhost:{PORT}/api/youtube/callback"
    try:
        youtube_service.fetch_token_from_code(code, redirect_uri)
        # Redirect back to frontend settings page on success
        return RedirectResponse(url="http://localhost:5173/settings?auth=success")
    except Exception as e:
        return RedirectResponse(url=f"http://localhost:5173/settings?auth=error&detail={str(e)}")

@router.get("/channel")
def get_channel_info():
    """Retrieves current channel statistics and past Shorts performance."""
    if not youtube_service.is_authenticated():
        raise HTTPException(status_code=401, detail="YouTube account is not authenticated. Please log in first.")
    
    stats = youtube_service.get_channel_stats()
    if "error" in stats:
        raise HTTPException(status_code=500, detail=stats["error"])
    return stats

@router.post("/upload")
def upload_to_youtube(req: UploadRequest):
    """Publishes a compiled video directly to the user's channel as a Short."""
    if not youtube_service.is_authenticated():
        raise HTTPException(status_code=401, detail="YouTube client is not authenticated.")
    
    file_path = OUTPUT_DIR / req.video_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Compiled video file {req.video_filename} not found.")

    # Use user-supplied tags and category, or fallback to Gemini if missing
    tags = req.tags
    category_id = req.category_id
    if not tags or not category_id:
        try:
            meta = ai_service.generate_youtube_metadata(title=req.title, description=req.description)
            tags = tags or meta.tags
            category_id = category_id or meta.category_id
        except Exception:
            tags = tags or []
            category_id = category_id or "24" # Entertainment default

    res = youtube_service.upload_short(
        video_path=str(file_path),
        title=req.title,
        description=req.description,
        tags=tags,
        privacy_status=req.privacy_status,
        category_id=category_id
    )
    
    if not res.get("success", False):
        raise HTTPException(status_code=500, detail=res.get("error", "Upload failed"))
        
    # Mark as uploaded in the database
    db_service.mark_history_as_posted(req.video_filename, res.get("video_id"))

    # Update chapters table with youtube_video_id
    try:
        normalized_filename = str(req.video_filename).replace("\\", "/")
        if "story_" in normalized_filename:
            parts = normalized_filename.split("/")
            story_part = next((p for p in parts if p.startswith("story_")), None)
            chapter_part = next((p for p in parts if p.startswith("chapter_")), None)
            if story_part and chapter_part:
                story_id = story_part.replace("story_", "")
                chapter_idx = int(chapter_part.replace("chapter_", ""))
                
                stories = db_service.get_stories()
                story = next((s for s in stories if s["id"] == story_id), None)
                if story and chapter_idx < len(story["chapters"]):
                    story["chapters"][chapter_idx]["youtube_video_id"] = res.get("video_id", "")
                    story["chapters"][chapter_idx]["published"] = 1
                    db_service.save_story(story)
                    print(f"[YouTube Upload] Automatically updated database for story {story_id} chapter {chapter_idx} with youtube_video_id {res.get('video_id')}")
    except Exception as db_err:
        print(f"[YouTube Upload] Failed to update chapter youtube_video_id: {db_err}")

    # Delete local video file after successful upload to conserve storage
    try:
        if file_path.exists():
            file_path.unlink()
            print(f"Deleted local video after successful YouTube publish: {req.video_filename}")
    except Exception as e:
        print(f"Error deleting local video {file_path}: {e}")

    return res

@router.post("/suggest-metadata")
def suggest_youtube_metadata(req: SuggestMetadataRequest):
    """Queries Gemini to suggest optimized tags and Category ID matching title/description."""
    try:
        meta = ai_service.generate_youtube_metadata(title=req.title, description=req.description)
        category_name = YOUTUBE_CATEGORIES.get(meta.category_id, "Entertainment")
        return {
            "tags": meta.tags,
            "category_id": meta.category_id,
            "category_name": category_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/schedule")
def schedule_video_upload(req: ScheduleRequest):
    """Schedules a video upload in the local database queue."""
    if not youtube_service.is_authenticated():
        raise HTTPException(status_code=401, detail="YouTube account is not authenticated.")
    
    file_path = OUTPUT_DIR / req.video_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Compiled video file {req.video_filename} not found.")

    try:
        # Pre-process publish_at date format string verification
        publish_time = datetime.datetime.fromisoformat(req.publish_at.replace("Z", "+00:00"))
        
        # Save to database
        db_service.add_scheduled_upload(
            filename=req.video_filename,
            title=req.title,
            description=req.description,
            tags=req.tags,
            category_id=req.category_id or "24",
            publish_at=publish_time.isoformat()
        )
        return {"success": True, "message": "Video successfully scheduled."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid date/format: {str(e)}")

@router.get("/schedule")
def get_scheduled_uploads():
    """Retrieves all scheduled video uploads in the database queue."""
    return {"scheduled": db_service.get_scheduled_uploads()}

@router.delete("/schedule/{filename}")
def cancel_scheduled_upload(filename: str):
    """Cancels/deletes a scheduled upload record."""
    db_service.delete_scheduled_upload(filename)
    return {"success": True, "message": "Scheduled upload cancelled."}

@router.get("/categories")
def get_youtube_categories():
    """Fetches video categories dynamically from the YouTube API."""
    fallback_list = [
        {"id": k, "title": v} for k, v in YOUTUBE_CATEGORIES.items()
    ]
    if not youtube_service.is_authenticated():
        return {"categories": fallback_list}
    try:
        youtube = youtube_service.get_client()
        res = youtube.videoCategories().list(part="snippet", regionCode="US").execute()
        cats = [
            {"id": item["id"], "title": item["snippet"]["title"]}
            for item in res.get("items", [])
            if item["snippet"].get("assignable", True)
        ]
        return {"categories": cats if cats else fallback_list}
    except Exception as e:
        print(f"Error fetching categories from YouTube API: {e}")
        return {"categories": fallback_list}

@router.post("/upload-thumbnail")
def upload_youtube_thumbnail(req: UploadThumbnailRequest):
    """Uploads a specific generated image as the thumbnail for a YouTube video."""
    if not youtube_service.is_authenticated():
        raise HTTPException(status_code=401, detail="YouTube client is not authenticated.")
    
    file_path = TEMP_DIR / req.image_filename
    if not file_path.exists():
        # Try output dir just in case
        file_path = OUTPUT_DIR / req.image_filename
        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"Image file {req.image_filename} not found.")

    success = youtube_service.upload_thumbnail(req.video_id, str(file_path))
    if not success:
        raise HTTPException(status_code=500, detail="Failed to upload thumbnail to YouTube.")
    return {"success": True, "message": "Thumbnail uploaded successfully."}

@router.get("/competitors")
def search_competitors(keyword: str = Query(..., description="Topic keywords to search")):
    """Queries YouTube API or public scraper for competitor metrics."""
    results = youtube_service.search_competitor_shorts(keyword)
    return {"results": results}
