import datetime
from typing import List, Dict, Any, Optional
from .connection import get_connection

def get_automation_state(key: str, default: str = "") -> str:
    """Retrieves an automation state value by key."""
    with get_connection() as conn:
        cursor = conn.execute("SELECT value FROM automation_state WHERE key = ?", (key,))
        row = cursor.fetchone()
        return row["value"] if row else default

def set_automation_state(key: str, value: str):
    """Sets/saves an automation state value."""
    with get_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO automation_state (key, value) VALUES (?, ?)",
            (key, str(value))
        )
        conn.commit()

def add_automation_log(log_text: str, level: str = "INFO"):
    """Adds a log entry for Autopost Automation."""
    timestamp = datetime.datetime.now().isoformat()
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO automation_logs (log_text, level, created_at) VALUES (?, ?, ?)",
            (log_text, level, timestamp)
        )
        conn.commit()

def get_automation_logs(limit: int = 150) -> List[Dict[str, Any]]:
    """Retrieves the latest logs in reverse-chronological order."""
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT id, log_text, level, created_at FROM automation_logs ORDER BY id DESC LIMIT ?",
            (limit,)
        )
        return [dict(row) for row in cursor.fetchall()]

def clear_automation_logs():
    """Clears the automation logs table."""
    with get_connection() as conn:
        conn.execute("DELETE FROM automation_logs")
        conn.commit()

def is_video_processed(original_youtube_id: str) -> bool:
    """Checks if a video has already been processed by its original YouTube ID."""
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT 1 FROM automation_processed_videos WHERE original_youtube_id = ?",
            (original_youtube_id,)
        )
        return cursor.fetchone() is not None

def is_video_processed_by_title_or_desc(title: str, description: str) -> bool:
    """Checks if a video with similar title/description exists in processed history to prevent duplication."""
    if not title:
        return False
    
    title_clean = title.strip().lower()
    with get_connection() as conn:
        cursor = conn.execute("SELECT original_title, original_description, regenerated_title FROM automation_processed_videos")
        rows = cursor.fetchall()
        for row in rows:
            # Check exact matching on title/regenerated title
            orig_t = (row["original_title"] or "").strip().lower()
            regen_t = (row["regenerated_title"] or "").strip().lower()
            if title_clean == orig_t or title_clean == regen_t:
                return True
            
            # Simple substring matching
            if title_clean in orig_t or orig_t in title_clean:
                return True
                
        return False

def add_processed_video(original_youtube_id: str, original_title: str, original_description: str, regenerated_title: str, youtube_video_id: str):
    """Adds a record of a successfully processed and uploaded viral video."""
    timestamp = datetime.datetime.now().isoformat()
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO automation_processed_videos "
            "(original_youtube_id, original_title, original_description, regenerated_title, youtube_video_id, processed_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (original_youtube_id, original_title, original_description, regenerated_title, youtube_video_id, timestamp)
        )
        conn.commit()

def get_processed_videos() -> List[Dict[str, Any]]:
    """Retrieves all processed videos records."""
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT id, original_youtube_id, original_title, original_description, regenerated_title, youtube_video_id, processed_at "
            "FROM automation_processed_videos ORDER BY id DESC"
        )
        return [dict(row) for row in cursor.fetchall()]
