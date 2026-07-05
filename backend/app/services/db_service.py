import sqlite3
import json
import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

DB_PATH = Path(__file__).resolve().parents[2] / "database.db"

class DBService:
    def __init__(self):
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            # 1. Video history table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS video_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT UNIQUE,
                    title TEXT,
                    created_at TEXT,
                    posted INTEGER DEFAULT 0,
                    youtube_id TEXT
                )
            """)
            # 2. Jobs status table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    job_id TEXT PRIMARY KEY,
                    status TEXT,
                    progress INTEGER,
                    logs TEXT,
                    video_path TEXT,
                    video_filename TEXT,
                    error TEXT,
                    created_at TEXT
                )
            """)
            # 3. Viral ideas table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS viral_ideas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT,
                    concept TEXT,
                    hook TEXT,
                    rationale TEXT,
                    prompt_query TEXT,
                    created_at TEXT
                )
            """)
            # 4. Quality reviews table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS quality_reviews (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT UNIQUE,
                    script_text TEXT,
                    visual_rating INTEGER,
                    audio_rating INTEGER,
                    pacing_rating INTEGER,
                    notes TEXT,
                    created_at TEXT
                )
            """)
            conn.commit()

    # --- History Operations ---
    def get_history(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            rows = conn.execute("SELECT * FROM video_history ORDER BY created_at DESC").fetchall()
            return [dict(row) for row in rows]

    def add_history_entry(self, filename: str, title: str):
        created_at = datetime.datetime.now().isoformat()
        with self._get_connection() as conn:
            try:
                conn.execute(
                    "INSERT INTO video_history (filename, title, created_at, posted) VALUES (?, ?, ?, 0)",
                    (filename, title, created_at)
                )
                conn.commit()
            except sqlite3.IntegrityError:
                # Already exists, ignore
                pass

    def mark_history_as_posted(self, filename: str, youtube_id: str):
        with self._get_connection() as conn:
            conn.execute(
                "UPDATE video_history SET posted = 1, youtube_id = ? WHERE filename = ?",
                (youtube_id, filename)
            )
            conn.commit()

    # --- Jobs Operations ---
    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
            if not row:
                return None
            data = dict(row)
            # Deserialize JSON logs
            try:
                data["logs"] = json.loads(data["logs"])
            except Exception:
                data["logs"] = []
            return data

    def create_job(self, job_id: str, status: str = "queued", progress: int = 0):
        created_at = datetime.datetime.now().isoformat()
        logs_json = json.dumps([])
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO jobs (job_id, status, progress, logs, created_at) VALUES (?, ?, ?, ?, ?)",
                (job_id, status, progress, logs_json, created_at)
            )
            conn.commit()

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
        with self._get_connection() as conn:
            # First load existing job to append logs if needed
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

            # Build dynamic UPDATE statement
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

    def delete_history_entry(self, filename: str):
        with self._get_connection() as conn:
            conn.execute("DELETE FROM video_history WHERE filename = ?", (filename,))
            conn.commit()

    def get_viral_ideas(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            rows = conn.execute("SELECT * FROM viral_ideas ORDER BY id ASC").fetchall()
            return [dict(row) for row in rows]

    def save_viral_ideas(self, ideas: List[Dict[str, Any]]):
        created_at = datetime.datetime.now().isoformat()
        with self._get_connection() as conn:
            conn.execute("DELETE FROM viral_ideas")
            for idea in ideas:
                conn.execute(
                    """
                    INSERT INTO viral_ideas (title, concept, hook, rationale, prompt_query, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        idea.get("title", ""),
                        idea.get("concept", ""),
                        idea.get("hook", ""),
                        idea.get("rationale", ""),
                        idea.get("prompt_query", ""),
                        created_at
                    )
                )
            conn.commit()

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
        created_at = datetime.datetime.now().isoformat()
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO quality_reviews (filename, script_text, visual_rating, audio_rating, pacing_rating, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(filename) DO UPDATE SET
                    script_text=excluded.script_text,
                    visual_rating=excluded.visual_rating,
                    audio_rating=excluded.audio_rating,
                    pacing_rating=excluded.pacing_rating,
                    notes=excluded.notes,
                    created_at=excluded.created_at
                """,
                (filename, script_text, visual_rating, audio_rating, pacing_rating, notes, created_at)
            )
            conn.commit()

    def get_quality_reviews(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            rows = conn.execute("SELECT * FROM quality_reviews ORDER BY created_at DESC").fetchall()
            return [dict(row) for row in rows]
