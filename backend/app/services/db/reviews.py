import datetime
from typing import List, Dict, Any
from app.services.db.connection import get_connection

def save_quality_review_db(
    filename: str,
    script_text: str,
    visual_rating: int,
    audio_rating: int,
    pacing_rating: int,
    notes: str
):
    created_at = datetime.datetime.now().isoformat()
    with get_connection() as conn:
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

def get_quality_reviews_db() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM quality_reviews ORDER BY created_at DESC").fetchall()
        return [dict(row) for row in rows]
