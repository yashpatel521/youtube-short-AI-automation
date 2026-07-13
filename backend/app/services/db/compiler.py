from typing import List, Dict, Any, Optional

from app.services.db.connection import init_db, reset_db_connections
from app.services.db.stories import (
    get_stories_db, save_story_db, delete_story_db,
    update_scene_image_db, update_chapter_video_db
)
from app.services.db.queue import (
    get_history_db, add_history_entry_db, mark_history_as_posted_db,
    delete_history_entry_db, get_job_db, get_all_jobs_db,
    create_job_db, update_job_db
)
from app.services.db.uploads import (
    get_viral_ideas_db, save_viral_ideas_db, add_scheduled_upload_db,
    get_scheduled_uploads_db, get_due_uploads_db,
    update_scheduled_upload_status_db, delete_scheduled_upload_db
)
from app.services.db.reviews import save_quality_review_db, get_quality_reviews_db
from app.services.db.automation import (
    get_automation_state, set_automation_state, add_automation_log,
    get_automation_logs, clear_automation_logs, is_video_processed,
    is_video_processed_by_title_or_desc, add_processed_video, get_processed_videos
)

class DBService:
    def __init__(self):
        self._init_db()

    def _init_db(self):
        init_db()

    # --- History Operations ---
    def get_history(self) -> List[Dict[str, Any]]:
        return get_history_db()

    def add_history_entry(self, filename: str, title: str):
        add_history_entry_db(filename, title)

    def mark_history_as_posted(self, filename: str, youtube_id: str):
        mark_history_as_posted_db(filename, youtube_id)

    def delete_history_entry(self, filename: str):
        delete_history_entry_db(filename)

    # --- Jobs Operations ---
    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        return get_job_db(job_id)

    def get_all_jobs(self) -> List[Dict[str, Any]]:
        return get_all_jobs_db()

    def create_job(self, job_id: str, status: str = "queued", progress: int = 0):
        create_job_db(job_id, status, progress)

    def update_job(
        self, 
        job_id: str, 
        status: Optional[str] = None, 
        progress: Optional[int] = None, 
        add_log: Optional[str] = None, 
        video_path: Optional[str] = None, 
        video_filename: Optional[str] = None, 
        error: Optional[str] = None
    ):
        update_job_db(job_id, status, progress, add_log, video_path, video_filename, error)

    # --- Viral Ideas Operations ---
    def get_viral_ideas(self) -> List[Dict[str, Any]]:
        return get_viral_ideas_db()

    def save_viral_ideas(self, ideas: List[Dict[str, Any]]):
        save_viral_ideas_db(ideas)

    # --- Quality Score Reviews Operations ---
    def save_quality_review(
        self,
        filename: str,
        script_text: str,
        visual_rating: int,
        audio_rating: int,
        pacing_rating: int,
        notes: str
    ):
        save_quality_review_db(filename, script_text, visual_rating, audio_rating, pacing_rating, notes)

    def get_quality_reviews(self) -> List[Dict[str, Any]]:
        return get_quality_reviews_db()

    # --- Scheduled Uploads Operations ---
    def add_scheduled_upload(self, filename: str, title: str, description: str, tags: List[str], category_id: str, publish_at: str):
        add_scheduled_upload_db(filename, title, description, tags, category_id, publish_at)

    def get_scheduled_uploads(self) -> List[Dict[str, Any]]:
        return get_scheduled_uploads_db()

    def get_due_uploads(self) -> List[Dict[str, Any]]:
        return get_due_uploads_db()

    def update_scheduled_upload_status(self, filename: str, status: str, youtube_id: Optional[str] = None, error: Optional[str] = None):
        update_scheduled_upload_status_db(filename, status, youtube_id, error)

    def delete_scheduled_upload(self, filename: str):
        delete_scheduled_upload_db(filename)

    # --- Story Studio Operations ---
    def get_stories(self) -> List[Dict[str, Any]]:
        return get_stories_db()

    def save_story(self, story: Dict[str, Any]):
        save_story_db(story)

    def delete_story(self, story_id: str):
        delete_story_db(story_id)

    def update_scene_image(self, scene_id: str, image_url: str, image_urls: List[str]):
        update_scene_image_db(scene_id, image_url, image_urls)

    def update_chapter_video(self, chapter_id: str, compiled_video: str):
        update_chapter_video_db(chapter_id, compiled_video)

    def reset_db(self):
        """Drops all database tables, empties media directories, and re-seeds default data templates."""
        try:
            import shutil
            from app.config import TEMP_DIR, OUTPUT_DIR
            for directory in [TEMP_DIR, OUTPUT_DIR]:
                if directory.exists():
                    for item in directory.iterdir():
                        try:
                            if item.is_file():
                                item.unlink()
                            elif item.is_dir():
                                shutil.rmtree(item)
                        except Exception as e:
                            print(f"[Reset DB] Failed to delete {item}: {e}")
        except Exception as e:
            print(f"[Reset DB] Error emptying media directories: {e}")

        reset_db_connections()

    # --- Autopost Automation Operations ---
    def get_automation_state(self, key: str, default: str = "") -> str:
        return get_automation_state(key, default)

    def set_automation_state(self, key: str, value: str):
        set_automation_state(key, value)

    def add_automation_log(self, log_text: str, level: str = "INFO"):
        add_automation_log(log_text, level)

    def get_automation_logs(self, limit: int = 150) -> List[Dict[str, Any]]:
        return get_automation_logs(limit)

    def clear_automation_logs(self):
        clear_automation_logs()

    def is_video_processed(self, original_youtube_id: str) -> bool:
        return is_video_processed(original_youtube_id)

    def is_video_processed_by_title_or_desc(self, title: str, description: str) -> bool:
        return is_video_processed_by_title_or_desc(title, description)

    def add_processed_video(self, original_youtube_id: str, original_title: str, original_description: str, regenerated_title: str, youtube_video_id: str):
        add_processed_video(original_youtube_id, original_title, original_description, regenerated_title, youtube_video_id)

    def get_processed_videos(self) -> List[Dict[str, Any]]:
        return get_processed_videos()
