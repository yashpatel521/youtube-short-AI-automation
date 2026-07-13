import json
from typing import List, Dict, Any, Optional
from app.services.db.connection import get_connection

def get_stories_db() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        story_rows = conn.execute("SELECT * FROM stories").fetchall()
        stories = []
        
        for s_row in story_rows:
            story = dict(s_row)
            story_id = story["id"]
            
            ch_rows = conn.execute(
                "SELECT * FROM chapters WHERE story_id = ? ORDER BY chapter_idx ASC",
                (story_id,)
            ).fetchall()
            
            chapters = []
            for ch_row in ch_rows:
                chapter = dict(ch_row)
                chapter_id = chapter["id"]
                
                sc_rows = conn.execute(
                    "SELECT * FROM scenes WHERE chapter_id = ? ORDER BY scene_idx ASC",
                    (chapter_id,)
                ).fetchall()
                
                scenes = []
                for sc_row in sc_rows:
                    scene = dict(sc_row)
                    try:
                        scene["image_prompts"] = json.loads(scene["image_prompts"])
                    except Exception:
                        scene["image_prompts"] = []
                    try:
                        scene["image_urls"] = json.loads(scene["image_urls"])
                    except Exception:
                        scene["image_urls"] = []
                    
                    scenes.append(scene)
                    
                chapter["scenes"] = scenes
                chapters.append(chapter)
                
            story["chapters"] = chapters
            stories.append(story)
            
        return stories

def save_story_db(story: Dict[str, Any]):
    with get_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO stories (id, title, style, youtube_playlist_id) VALUES (?, ?, ?, ?)",
            (story["id"], story["title"], story["style"], story.get("youtube_playlist_id", ""))
        )
        
        existing_ch_rows = conn.execute(
            "SELECT id FROM chapters WHERE story_id = ?",
            (story["id"],)
        ).fetchall()
        existing_ch_ids = {row["id"] for row in existing_ch_rows}
        incoming_ch_ids = set()
        
        for ch_idx, chapter in enumerate(story.get("chapters", [])):
            ch_id = chapter.get("id")
            if not ch_id:
                ch_id = f"{story['id']}_ch{ch_idx}"
                chapter["id"] = ch_id
            
            incoming_ch_ids.add(ch_id)
            
            compiled_video = chapter.get("compiled_video")
            if not compiled_video:
                db_ch = conn.execute(
                    "SELECT compiled_video FROM chapters WHERE id = ?",
                    (ch_id,)
                ).fetchone()
                if db_ch:
                    compiled_video = db_ch["compiled_video"]
            
            conn.execute(
                "INSERT OR REPLACE INTO chapters (id, story_id, title, chapter_idx, compiled_video, description, tags, category_id, published, youtube_video_id) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    ch_id,
                    story["id"],
                    chapter["title"],
                    ch_idx,
                    compiled_video,
                    chapter.get("description", ""),
                    chapter.get("tags", ""),
                    chapter.get("category_id", ""),
                    1 if chapter.get("published", False) or chapter.get("published") == 1 else 0,
                    chapter.get("youtube_video_id", "")
                )
            )
            
            existing_sc_rows = conn.execute(
                "SELECT id FROM scenes WHERE chapter_id = ?",
                (ch_id,)
            ).fetchall()
            existing_sc_ids = {row["id"] for row in existing_sc_rows}
            incoming_sc_ids = set()
            
            for sc_idx, scene in enumerate(chapter.get("scenes", [])):
                sc_id = scene.get("id") or f"{ch_id}_sc{sc_idx}"
                scene["id"] = sc_id
                incoming_sc_ids.add(sc_id)
                
                image_url = scene.get("image_url")
                image_urls = scene.get("image_urls") or []
                
                if not image_url or not image_urls:
                    db_sc = conn.execute(
                        "SELECT image_url, image_urls FROM scenes WHERE id = ?",
                        (sc_id,)
                    ).fetchone()
                    if db_sc:
                        if not image_url:
                            image_url = db_sc["image_url"]
                        if not image_urls:
                            try:
                                image_urls = json.loads(db_sc["image_urls"])
                            except Exception:
                                image_urls = []
                
                image_prompt = scene.get("image_prompt", "")
                image_prompts = scene.get("image_prompts") or []
                if not image_prompts and image_prompt:
                    image_prompts = [p.strip() for p in image_prompt.split("\n") if p.strip()]
                if not image_prompts:
                    image_prompts = ["a beautiful fantasy scene illustration"]
                    
                conn.execute(
                    "INSERT OR REPLACE INTO scenes (id, chapter_id, scene_idx, title, narration, image_prompt, image_prompts, image_url, image_urls) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        sc_id,
                        ch_id,
                        sc_idx,
                        scene["title"],
                        scene["narration"],
                        image_prompt,
                        json.dumps(image_prompts),
                        image_url,
                        json.dumps(image_urls)
                    )
                )
            
            deleted_sc_ids = existing_sc_ids - incoming_sc_ids
            for del_sc_id in deleted_sc_ids:
                conn.execute("DELETE FROM scenes WHERE id = ?", (del_sc_id,))
                
        deleted_ch_ids = existing_ch_ids - incoming_ch_ids
        for del_ch_id in deleted_ch_ids:
            conn.execute("DELETE FROM scenes WHERE chapter_id = ?", (del_ch_id,))
            conn.execute("DELETE FROM chapters WHERE id = ?", (del_ch_id,))
            
        conn.commit()

def delete_story_db(story_id: str):
    with get_connection() as conn:
        conn.execute("DELETE FROM stories WHERE id = ?", (story_id,))
        conn.commit()

def update_scene_image_db(scene_id: str, image_url: str, image_urls: List[str]):
    with get_connection() as conn:
        conn.execute(
            "UPDATE scenes SET image_url = ?, image_urls = ? WHERE id = ?",
            (image_url, json.dumps(image_urls), scene_id)
        )
        conn.commit()

def update_chapter_video_db(chapter_id: str, compiled_video: str):
    with get_connection() as conn:
        conn.execute(
            "UPDATE chapters SET compiled_video = ? WHERE id = ?",
            (compiled_video, chapter_id)
        )
        conn.commit()
