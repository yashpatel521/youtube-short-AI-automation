import json
import datetime
import sqlite3
from typing import List, Dict, Any, Optional
from app.services.db.connection import get_connection

def get_history_db() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM video_history ORDER BY created_at DESC").fetchall()
        return [dict(row) for row in rows]

def add_history_entry_db(filename: str, title: str):
    created_at = datetime.datetime.now().isoformat()
    with get_connection() as conn:
        try:
            conn.execute(
                "INSERT INTO video_history (filename, title, created_at, posted) VALUES (?, ?, ?, 0)",
                (filename, title, created_at)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            pass

def mark_history_as_posted_db(filename: str, youtube_id: str):
    with get_connection() as conn:
        conn.execute(
            "UPDATE video_history SET posted = 1, youtube_id = ? WHERE filename = ?",
            (youtube_id, filename)
        )
        conn.commit()

def delete_history_entry_db(filename: str):
    with get_connection() as conn:
        conn.execute("DELETE FROM video_history WHERE filename = ?", (filename,))
        conn.commit()

def get_job_db(job_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
        if not row:
            return None
        data = dict(row)
        try:
            data["logs"] = json.loads(data["logs"])
        except Exception:
            data["logs"] = []
        return data

def get_all_jobs_db() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC").fetchall()
        jobs = []
        for row in rows:
            data = dict(row)
            try:
                data["logs"] = json.loads(data["logs"])
            except Exception:
                data["logs"] = []
            jobs.append(data)
        return jobs

def create_job_db(job_id: str, status: str = "queued", progress: int = 0):
    created_at = datetime.datetime.now().isoformat()
    logs_json = json.dumps([])
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO jobs (job_id, status, progress, logs, created_at) VALUES (?, ?, ?, ?, ?)",
            (job_id, status, progress, logs_json, created_at)
        )
        conn.commit()

def update_job_db(
    job_id: str, 
    status: Optional[str] = None, 
    progress: Optional[int] = None, 
    add_log: Optional[str] = None, 
    video_path: Optional[str] = None, 
    video_filename: Optional[str] = None, 
    error: Optional[str] = None
):
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
        if not row:
            return
        
        job_data = dict(row)
        try:
            logs = json.loads(job_data["logs"])
        except Exception:
            logs = []

        if add_log is not None:
            logs.append(add_log)

        updates = []
        params = []
        if status is not None:
            updates.append("status = ?")
            params.append(status)
        if progress is not None:
            updates.append("progress = ?")
            params.append(progress)
        if add_log is not None:
            updates.append("logs = ?")
            params.append(json.dumps(logs))
        if video_path is not None:
            updates.append("video_path = ?")
            params.append(video_path)
        if video_filename is not None:
            updates.append("video_filename = ?")
            params.append(video_filename)
        if error is not None:
            updates.append("error = ?")
            params.append(error)

        if updates:
            query = f"UPDATE jobs SET {', '.join(updates)} WHERE job_id = ?"
            params.append(job_id)
            conn.execute(query, params)
            conn.commit()
