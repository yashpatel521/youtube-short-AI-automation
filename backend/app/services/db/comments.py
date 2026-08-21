import datetime
from typing import List, Dict, Any, Optional
from app.services.db.connection import get_connection

def get_comment_settings() -> Dict[str, Any]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM comment_auto_reply_settings WHERE id = 1").fetchone()
        if row:
            return dict(row)
        return {
            "id": 1,
            "is_enabled": 1,
            "check_interval_minutes": 5,
            "ai_tone": "Enthusiastic & Friendly",
            "include_cta": 1,
            "cta_text": "Thanks for watching! Subscribe for daily viral Shorts! 🔔"
        }

def update_comment_settings(
    is_enabled: Optional[bool] = None,
    check_interval_minutes: Optional[int] = None,
    ai_tone: Optional[str] = None,
    include_cta: Optional[bool] = None,
    cta_text: Optional[str] = None
) -> Dict[str, Any]:
    current = get_comment_settings()
    
    new_is_enabled = int(is_enabled) if is_enabled is not None else current["is_enabled"]
    new_interval = check_interval_minutes if check_interval_minutes is not None else current["check_interval_minutes"]
    new_tone = ai_tone if ai_tone is not None else current["ai_tone"]
    new_include_cta = int(include_cta) if include_cta is not None else current["include_cta"]
    new_cta_text = cta_text if cta_text is not None else current["cta_text"]
    
    with get_connection() as conn:
        conn.execute("""
            UPDATE comment_auto_reply_settings
            SET is_enabled = ?,
                check_interval_minutes = ?,
                ai_tone = ?,
                include_cta = ?,
                cta_text = ?
            WHERE id = 1
        """, (new_is_enabled, new_interval, new_tone, new_include_cta, new_cta_text))
    
    return get_comment_settings()

def get_comment_rules() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM comment_rules ORDER BY id DESC").fetchall()
        return [dict(r) for r in rows]

def create_comment_rule(name: str, keyword: str, reply_mode: str = "ai", template_text: str = "", is_active: bool = True) -> Dict[str, Any]:
    now = datetime.datetime.now().isoformat()
    with get_connection() as conn:
        cursor = conn.execute("""
            INSERT INTO comment_rules (name, keyword, reply_mode, template_text, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (name, keyword, reply_mode, template_text, 1 if is_active else 0, now))
        rule_id = cursor.lastrowid
        row = conn.execute("SELECT * FROM comment_rules WHERE id = ?", (rule_id,)).fetchone()
        return dict(row)

def update_comment_rule(rule_id: int, name: str, keyword: str, reply_mode: str, template_text: str, is_active: bool) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        conn.execute("""
            UPDATE comment_rules
            SET name = ?, keyword = ?, reply_mode = ?, template_text = ?, is_active = ?
            WHERE id = ?
        """, (name, keyword, reply_mode, template_text, 1 if is_active else 0, rule_id))
        row = conn.execute("SELECT * FROM comment_rules WHERE id = ?", (rule_id,)).fetchone()
        return dict(row) if row else None

def delete_comment_rule(rule_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM comment_rules WHERE id = ?", (rule_id,))
        return cursor.rowcount > 0

def get_comments_history(status_filter: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        if status_filter:
            rows = conn.execute(
                "SELECT * FROM comments_history WHERE reply_status = ? ORDER BY id DESC LIMIT ?",
                (status_filter, limit)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM comments_history ORDER BY id DESC LIMIT ?",
                (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

def get_comment_by_id(comment_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM comments_history WHERE comment_id = ?", (comment_id,)).fetchone()
        return dict(row) if row else None

def save_or_update_comment(
    comment_id: str,
    video_id: str,
    video_title: str,
    author_name: str,
    author_profile_image: str,
    comment_text: str,
    reply_text: str = "",
    reply_status: str = "pending",
    rule_id: Optional[int] = None,
    error: str = ""
) -> Dict[str, Any]:
    now = datetime.datetime.now().isoformat()
    with get_connection() as conn:
        existing = conn.execute("SELECT * FROM comments_history WHERE comment_id = ?", (comment_id,)).fetchone()
        if existing:
            conn.execute("""
                UPDATE comments_history
                SET video_id = ?,
                    video_title = ?,
                    author_name = ?,
                    author_profile_image = ?,
                    comment_text = ?,
                    reply_text = CASE WHEN ? != '' THEN ? ELSE reply_text END,
                    reply_status = ?,
                    replied_at = CASE WHEN ? = 'replied' THEN ? ELSE replied_at END,
                    rule_id = COALESCE(?, rule_id),
                    error = ?
                WHERE comment_id = ?
            """, (video_id, video_title, author_name, author_profile_image, comment_text,
                  reply_text, reply_text, reply_status, reply_status, now, rule_id, error, comment_id))
        else:
            conn.execute("""
                INSERT INTO comments_history (
                    comment_id, video_id, video_title, author_name, author_profile_image,
                    comment_text, reply_text, reply_status, replied_at, rule_id, error, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                comment_id, video_id, video_title, author_name, author_profile_image,
                comment_text, reply_text, reply_status,
                now if reply_status == "replied" else None,
                rule_id, error, now
            ))
        row = conn.execute("SELECT * FROM comments_history WHERE comment_id = ?", (comment_id,)).fetchone()
        return dict(row)

def mark_comment_replied(comment_id: str, reply_text: str, rule_id: Optional[int] = None) -> bool:
    now = datetime.datetime.now().isoformat()
    with get_connection() as conn:
        cursor = conn.execute("""
            UPDATE comments_history
            SET reply_text = ?, reply_status = 'replied', replied_at = ?, rule_id = COALESCE(?, rule_id), error = ''
            WHERE comment_id = ?
        """, (reply_text, now, rule_id, comment_id))
        return cursor.rowcount > 0

def mark_comment_failed(comment_id: str, error_msg: str) -> bool:
    with get_connection() as conn:
        cursor = conn.execute("""
            UPDATE comments_history
            SET reply_status = 'failed', error = ?
            WHERE comment_id = ?
        """, (error_msg, comment_id))
        return cursor.rowcount > 0
