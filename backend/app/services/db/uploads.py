import datetime
from typing import List, Dict, Any, Optional
from app.services.db.connection import get_connection

def get_viral_ideas_db() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM viral_ideas ORDER BY id ASC").fetchall()
        return [dict(row) for row in rows]

def save_viral_ideas_db(ideas: List[Dict[str, Any]]):
    created_at = datetime.datetime.now().isoformat()
    with get_connection() as conn:
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

def add_scheduled_upload_db(filename: str, title: str, description: str, tags: List[str], category_id: str, publish_at: str):
    created_at = datetime.datetime.now().isoformat()
    tags_str = ",".join(tags) if isinstance(tags, list) else tags
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO scheduled_uploads (filename, title, description, tags, category_id, publish_at, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
            ON CONFLICT(filename) DO UPDATE SET
                title=excluded.title,
                description=excluded.description,
                tags=excluded.tags,
                category_id=excluded.category_id,
                publish_at=excluded.publish_at,
                status='pending',
                error=NULL,
                created_at=excluded.created_at
            """,
            (filename, title, description, tags_str, category_id, publish_at, created_at)
        )
        conn.commit()

def get_scheduled_uploads_db() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM scheduled_uploads ORDER BY publish_at ASC").fetchall()
        res = []
        for row in rows:
            d = dict(row)
            d["tags"] = [t.strip() for t in d["tags"].split(",") if t.strip()] if d["tags"] else []
            res.append(d)
        return res

def get_due_uploads_db() -> List[Dict[str, Any]]:
    now_str = datetime.datetime.now().isoformat()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM scheduled_uploads WHERE publish_at <= ? AND status = 'pending'",
            (now_str,)
        ).fetchall()
        res = []
        for row in rows:
            d = dict(row)
            d["tags"] = [t.strip() for t in d["tags"].split(",") if t.strip()] if d["tags"] else []
            res.append(d)
        return res

def update_scheduled_upload_status_db(filename: str, status: str, youtube_id: Optional[str] = None, error: Optional[str] = None):
    with get_connection() as conn:
        conn.execute(
            "UPDATE scheduled_uploads SET status = ?, youtube_id = ?, error = ? WHERE filename = ?",
            (status, youtube_id, error, filename)
        )
        conn.commit()

def delete_scheduled_upload_db(filename: str):
    with get_connection() as conn:
        conn.execute("DELETE FROM scheduled_uploads WHERE filename = ?", (filename,))
        conn.commit()
