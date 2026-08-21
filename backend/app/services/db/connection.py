import sqlite3
import json
import datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[4] / "database.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_connection() as conn:
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
        # 5. Scheduled uploads table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS scheduled_uploads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT UNIQUE,
                title TEXT,
                description TEXT,
                tags TEXT,
                category_id TEXT,
                publish_at TEXT,
                status TEXT DEFAULT 'pending',
                youtube_id TEXT,
                error TEXT,
                created_at TEXT
            )
        """)
        
        # Seed a dummy completed compilation job if it does not already exist
        cursor = conn.execute("SELECT 1 FROM jobs WHERE job_id = 'dummy-chapter-video-compile'")
        if not cursor.fetchone():
            conn.execute(
                "INSERT INTO jobs (job_id, status, progress, logs, video_path, video_filename, error, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    "dummy-chapter-video-compile",
                    "completed",
                    100,
                    "Speech synthesized successfully\nFlux illustration images generated successfully\nSubs card rendered successfully\nMerging and concatenating audio/video segments complete\nChapter video compiling finalized successfully.",
                    "short_19849.mp4",
                    "short_19849.mp4",
                    "",
                    datetime.datetime.now().isoformat()
                )
            )
        
        # Seed matching entry in video history table
        cursor = conn.execute("SELECT 1 FROM video_history WHERE filename = 'short_19849.mp4'")
        if not cursor.fetchone():
            conn.execute(
                "INSERT INTO video_history (filename, title, created_at, posted) VALUES (?, ?, ?, 0)",
                ("short_19849.mp4", "Chapter 1: Discovery of the Key", datetime.datetime.now().isoformat())
            )

        # 6. Stories table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS stories (
                id TEXT PRIMARY KEY,
                title TEXT,
                style TEXT,
                youtube_playlist_id TEXT DEFAULT ''
            )
        """)

        # Migration: Add youtube_playlist_id to stories if missing
        try:
            conn.execute("ALTER TABLE stories ADD COLUMN youtube_playlist_id TEXT DEFAULT ''")
        except Exception:
            pass

        # 7. Chapters table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chapters (
                id TEXT PRIMARY KEY,
                story_id TEXT,
                title TEXT,
                chapter_idx INTEGER,
                compiled_video TEXT,
                description TEXT DEFAULT '',
                tags TEXT DEFAULT '',
                category_id TEXT DEFAULT '',
                published INTEGER DEFAULT 0,
                youtube_video_id TEXT DEFAULT '',
                FOREIGN KEY(story_id) REFERENCES stories(id) ON DELETE CASCADE
            )
        """)

        # Migration: Add columns to chapters if missing (Start-from-Fail robustness)
        try:
            conn.execute("ALTER TABLE chapters ADD COLUMN description TEXT DEFAULT ''")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE chapters ADD COLUMN tags TEXT DEFAULT ''")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE chapters ADD COLUMN category_id TEXT DEFAULT ''")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE chapters ADD COLUMN published INTEGER DEFAULT 0")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE chapters ADD COLUMN youtube_video_id TEXT DEFAULT ''")
        except Exception:
            pass

        # Comment Auto-Reply Settings table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS comment_auto_reply_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                is_enabled INTEGER DEFAULT 1,
                check_interval_minutes INTEGER DEFAULT 5,
                ai_tone TEXT DEFAULT 'Enthusiastic & Friendly',
                include_cta INTEGER DEFAULT 1,
                cta_text TEXT DEFAULT 'Thanks for watching! Subscribe for daily viral Shorts! 🔔'
            )
        """)

        # Comment Rules table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS comment_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                keyword TEXT,
                reply_mode TEXT DEFAULT 'ai',
                template_text TEXT DEFAULT '',
                is_active INTEGER DEFAULT 1,
                created_at TEXT
            )
        """)

        # Comments History table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS comments_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                comment_id TEXT UNIQUE,
                video_id TEXT,
                video_title TEXT,
                author_name TEXT,
                author_profile_image TEXT,
                comment_text TEXT,
                reply_text TEXT,
                reply_status TEXT DEFAULT 'pending',
                replied_at TEXT,
                rule_id INTEGER,
                error TEXT,
                created_at TEXT
            )
        """)

        # Seed default auto reply settings if missing
        cursor = conn.execute("SELECT 1 FROM comment_auto_reply_settings WHERE id = 1")
        if not cursor.fetchone():
            conn.execute(
                "INSERT INTO comment_auto_reply_settings (id, is_enabled, check_interval_minutes, ai_tone, include_cta, cta_text) "
                "VALUES (1, 1, 5, 'Enthusiastic & Friendly', 1, 'Thanks for watching! Subscribe for daily viral Shorts! 🔔')"
            )

        # Seed initial sample rules if empty
        cursor = conn.execute("SELECT 1 FROM comment_rules LIMIT 1")
        if not cursor.fetchone():
            conn.execute(
                "INSERT INTO comment_rules (name, keyword, reply_mode, template_text, is_active, created_at) "
                "VALUES (?, ?, ?, ?, 1, ?)",
                (
                    "Part 2 Request",
                    "part 2",
                    "template",
                    "Part 2 is coming out tomorrow! Make sure you subscribe and turn on notifications so you don't miss it! 🚀",
                    datetime.datetime.now().isoformat()
                )
            )
            conn.execute(
                "INSERT INTO comment_rules (name, keyword, reply_mode, template_text, is_active, created_at) "
                "VALUES (?, ?, ?, ?, 1, ?)",
                (
                    "Video Creation Query",
                    "how to make",
                    "template",
                    "We generated this Short using Helios AI Studio! Check our channel description to create your own! 🎬✨",
                    datetime.datetime.now().isoformat()
                )
            )

        # 8. Scenes table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS scenes (
                id TEXT PRIMARY KEY,
                chapter_id TEXT,
                scene_idx INTEGER,
                title TEXT,
                narration TEXT,
                image_prompt TEXT,
                image_prompts TEXT,
                image_url TEXT,
                image_urls TEXT,
                FOREIGN KEY(chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
            )
        """)

        # 9. Autopost automation state table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS automation_state (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)

        # 10. Autopost automation logs table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS automation_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                log_text TEXT,
                level TEXT DEFAULT 'INFO',
                created_at TEXT
            )
        """)

        # 11. Autopost processed videos table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS automation_processed_videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_youtube_id TEXT UNIQUE,
                original_title TEXT,
                original_description TEXT,
                regenerated_title TEXT,
                youtube_video_id TEXT,
                processed_at TEXT
            )
        """)

        # Seed default templates into stories table if empty
        cursor = conn.execute("SELECT COUNT(*) FROM stories")
        if cursor.fetchone()[0] == 0:
            DEFAULT_STORIES = [
                {
                    "id": "fox_key",
                    "title": "The Brave Little Fox and the Moon Key",
                    "style": "kids_cartoon",
                    "chapters": [
                        {
                            "id": "fox_ch1",
                            "title": "Chapter 1: Discovery of the Key",
                            "scenes": [
                                { "title": "The Silver Key", "narration": "Once upon a time, in the heart of the Whispering Woods, a little red fox named Rusty found a glowing silver key.", "image_prompt": "A cute little red fox with big bright eyes holding a glowing silver key in a dense, magical forest, cartoon style" },
                                { "title": "The Giant Oak Tree", "narration": "Rusty looked up at the giant ancient oak tree and noticed a tiny keyhole carved into its bark.", "image_prompt": "A close-up of a tiny, ancient keyhole glowing softly on the bark of a massive old oak tree, cartoon style" },
                                { "title": "The Spiral Staircase", "narration": "As he turned the key, the tree trunk gently opened, revealing a hidden spiral staircase glowing with starlight.", "image_prompt": "Rusty stepping into a secret doorway in the side of a massive tree, revealing a glowing spiral staircase winding upwards, cartoon style" },
                                { "title": "The City of Clouds", "narration": "He climbed up and found himself in a beautiful city built on top of the softest, fluffy clouds.", "image_prompt": "A beautiful city with houses made of glowing clouds under a bright starry sky, cozy cartoon style" }
                            ]
                        }
                    ]
                },
                {
                    "id": "boy_star",
                    "title": "The Boy Who Befriended a Star",
                    "style": "anime",
                    "chapters": [
                        {
                            "id": "star_ch1",
                            "title": "Chapter 1: Wish Upon a Star",
                            "scenes": [
                                { "title": "A Wish", "narration": "Leo spent every night sitting on his balcony, looking up at the sky and wishing he had a friend to share his secrets with.", "image_prompt": "A young boy with dark messy hair sitting on a balcony looking at the starry night sky, cozy anime style" },
                                { "title": "Stella's Arrival", "narration": "One evening, a tiny, bright star detached itself from the heavens and gently floated down to rest on his palm.", "image_prompt": "A small glowing star resting on the palm of a young boy's hand, warm ambient glow, anime style" },
                                { "title": "Nebula Tales", "narration": "The star was called Stella, and she whispered tales of cosmic oceans, nebula storms, and flying space whales.", "image_prompt": "A projection of space whales flying through colorful pink and blue nebulas, dreamlike anime scene" },
                                { "title": "A Guide in the Dark", "narration": "Together, they realized that even the smallest light can guide you through the darkest nights.", "image_prompt": "The young boy walking down a dark path guided by a small glowing star on his shoulder, anime style" }
                            ]
                        }
                    ]
                },
                {
                    "id": "forest_guardian",
                    "title": "The Forest Guardian and the Magic River",
                    "style": "kids_cartoon",
                    "chapters": [
                        {
                            "id": "forest_ch1",
                            "title": "Chapter 1: The Magic Whispering River",
                            "scenes": [
                                { "title": "The River Call", "narration": "Beneath the canopy of the Emerald Valley, a golden river whispered ancient secrets to those who listened closely.", "image_prompt": "A glittering golden river winding through a lush green valley with mossy trees and flowers, cartoon style" },
                                { "title": "Pip the Squirrel", "narration": "Pip, the adventurous little squirrel, ran to the edge of the river bank and dipped his paw into the warm, glowing water.", "image_prompt": "A cute fluffy squirrel with large tail standing at a river edge dipping a paw in glowing golden water, cartoon style" },
                                { "title": "The Water Sprite", "narration": "A cheerful water sprite made of pure starlight popped out of the bubbles, giggling and dancing in circles.", "image_prompt": "A small glowing blue and gold water sprite floating above river bubbles, smiling, magical atmosphere, cartoon style" }
                            ]
                        }
                    ]
                }
            ]
            for story in DEFAULT_STORIES:
                conn.execute(
                    "INSERT OR IGNORE INTO stories (id, title, style) VALUES (?, ?, ?)",
                    (story["id"], story["title"], story["style"])
                )
                for ch_idx, chapter in enumerate(story["chapters"]):
                    conn.execute(
                        "INSERT OR IGNORE INTO chapters (id, story_id, title, chapter_idx, compiled_video) VALUES (?, ?, ?, ?, ?)",
                        (chapter["id"], story["id"], chapter["title"], ch_idx, chapter.get("compiled_video"))
                    )
                    for sc_idx, scene in enumerate(chapter["scenes"]):
                        scene_id = f"{chapter['id']}_sc{sc_idx}"
                        image_prompt = scene.get("image_prompt", "")
                        image_prompts = scene.get("image_prompts") or []
                        if not image_prompts and image_prompt:
                            image_prompts = [p.strip() for p in image_prompt.split("\n") if p.strip()]
                        if not image_prompts:
                            image_prompts = ["a beautiful fantasy scene illustration"]

                        conn.execute(
                            "INSERT OR IGNORE INTO scenes (id, chapter_id, scene_idx, title, narration, image_prompt, image_prompts, image_url, image_urls) "
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            (
                                scene_id,
                                chapter["id"],
                                sc_idx,
                                scene["title"],
                                scene["narration"],
                                image_prompt,
                                json.dumps(image_prompts),
                                scene.get("image_url"),
                                json.dumps(scene.get("image_urls", []))
                            )
                        )

        conn.commit()

def reset_db_connections():
    with get_connection() as conn:
        conn.execute("DROP TABLE IF EXISTS video_history")
        conn.execute("DROP TABLE IF EXISTS jobs")
        conn.execute("DROP TABLE IF EXISTS viral_ideas")
        conn.execute("DROP TABLE IF EXISTS quality_reviews")
        conn.execute("DROP TABLE IF EXISTS scheduled_uploads")
        conn.execute("DROP TABLE IF EXISTS scenes")
        conn.execute("DROP TABLE IF EXISTS chapters")
        conn.execute("DROP TABLE IF EXISTS stories")
        conn.execute("DROP TABLE IF EXISTS automation_state")
        conn.execute("DROP TABLE IF EXISTS automation_logs")
        conn.execute("DROP TABLE IF EXISTS automation_processed_videos")
        conn.commit()
    init_db()
