import threading
import time
import traceback
import random
import datetime
import asyncio
import os
from pathlib import Path
from typing import List, Dict, Any, Optional

from app.models import CompileRequest

TEMP_DIR = Path(__file__).resolve().parents[2] / "temp"

class AutopostAutomationWorker:
    def __init__(self):
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self.default_keywords = "Auto Gemini AI (Dynamic)"
        self.default_interval = 600  # 10 minutes

    def start(self):
        """Starts the background loop thread if it's not already running."""
        from app.services import db_service
        db_service.set_automation_state("running", "true")
        db_service.add_automation_log("Starting Autopost Automation background loop...", "INFO")

        if self._thread and self._thread.is_alive():
            db_service.add_automation_log("Autopost Automation loop is already running.", "WARNING")
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        db_service.add_automation_log("Background thread started successfully.", "INFO")

    def stop(self):
        """Halts the background loop thread."""
        from app.services import db_service
        db_service.set_automation_state("running", "false")
        db_service.add_automation_log("Stopping Autopost Automation background loop...", "INFO")
        self._stop_event.set()

    def is_running(self) -> bool:
        """Checks if the background loop thread is currently alive and active."""
        from app.services import db_service
        running_state = db_service.get_automation_state("running", "false") == "true"
        thread_alive = self._thread is not None and self._thread.is_alive()
        return running_state and thread_alive

    def _run_loop(self):
        from app.services import db_service
        while not self._stop_event.is_set():
            # Check state variable in SQLite to allow external stops
            if db_service.get_automation_state("running", "false") != "true":
                db_service.add_automation_log("Automation state disabled in database. Terminating worker loop.", "INFO")
                break

            processed_successfully = False
            try:
                processed_successfully = self._execute_automation_step()
            except Exception as e:
                err_msg = f"Automation step crashed: {str(e)}\n{traceback.format_exc()}"
                db_service.add_automation_log(err_msg, "ERROR")
                db_service.add_automation_log("Stopping automation bot due to critical error.", "ERROR")
                self.stop()
                break

            # Check again if stopped before sleeping or proceeding
            if self._stop_event.is_set() or db_service.get_automation_state("running", "false") != "true":
                break

            if processed_successfully:
                db_service.add_automation_log("Video uploaded/processed successfully. Starting next cycle immediately...", "INFO")
                # Sleep briefly (1 second) to yield execution and check stop event
                time.sleep(1)
            else:
                # Retrying in 10 seconds if no new video was found
                retry_interval = 10
                db_service.add_automation_log(f"No new unprocessed video found across search keywords. Retrying in {retry_interval} seconds...", "INFO")
                
                for _ in range(retry_interval):
                    if self._stop_event.is_set() or db_service.get_automation_state("running", "false") != "true":
                        break
                    time.sleep(1)

        db_service.add_automation_log("Autopost Automation background loop terminated.", "INFO")

    def _execute_automation_step(self) -> bool:
        from app.services import db_service, youtube_service, ai_service, video_engine
        db_service.add_automation_log("--- Starting New Automation Cycle ---", "INFO")
        
        # 1. Auto Gemini Keyword Generation
        db_service.add_automation_log("Asking Gemini AI to generate trending viral search topics...", "INFO")
        try:
            keywords = ai_service.generate_trending_keywords()
            db_service.add_automation_log(f"Gemini AI dynamically generated search keywords: {', '.join(keywords)}", "INFO")
        except Exception as e:
            db_service.add_automation_log(f"Gemini keyword generation fallback used: {str(e)}", "WARNING")
            keywords = [
                "trending trading market shock",
                "crypto trading price surge alert",
                "viral meme news internet drama",
                "current viral meme reaction",
                "relatable meme comedy moments",
                "latest geopolitical news breaking",
                "world power shift geopolitical tension",
                "dark history secrets", 
                "dark psychology tricks", 
                "unsolved mysteries chilling", 
                "impossible survival choices", 
                "mind bending what if scenarios", 
                "viral funny pov meme trend"
            ]
            
        # Include custom user keywords if configured
        custom_kw_str = db_service.get_automation_state("keywords", "")
        if custom_kw_str and not custom_kw_str.startswith("✨"):
            custom_list = [k.strip() for k in custom_kw_str.split(",") if k.strip()]
            if custom_list:
                keywords.extend(custom_list)

        # Shuffle keywords so every niche has equal probability and we don't always pick the same category
        random.shuffle(keywords)

        all_styles = [
            "geopolitical_news",
            "trading_financial",
            "meme_news",
            "dark_mystery", 
            "psychology_tricks", 
            "would_you_rather", 
            "sci_fi_what_if", 
            "reddit_story_twist",
            "funny_comedy",
            "meme_reaction"
        ]

        target_video = None
        selected_keyword = None
        selected_style = None

        # 2. Iterate through EVERY keyword in the list until an unprocessed video is found
        for kw in keywords:
            db_service.add_automation_log(f"Searching YouTube for viral competitor Shorts matching '{kw}'...", "INFO")
            try:
                competitors = youtube_service.search_competitor_shorts(kw)
            except Exception as e:
                db_service.add_automation_log(f"Failed to query YouTube search for '{kw}': {str(e)}", "WARNING")
                continue

            if not competitors:
                db_service.add_automation_log(f"No competitor Shorts found for '{kw}'. Trying next keyword...", "INFO")
                continue

            # Sort by view count descending if available
            def get_views(item):
                try:
                    return int(item.get("views", 0))
                except Exception:
                    return 0
            competitors.sort(key=get_views, reverse=True)

            # Find first video for this keyword that hasn't been processed
            for comp in competitors:
                vid_id = comp.get("id")
                title = comp.get("title")
                desc = comp.get("description", "")
                
                # Check duplicate database states
                if db_service.is_video_processed(vid_id):
                    continue
                if db_service.is_video_processed_by_title_or_desc(title, desc):
                    db_service.add_automation_log(f"Skipping video '{title}' - already processed.", "INFO")
                    continue

                target_video = comp
                selected_keyword = kw
                break

            if target_video:
                # Match style to selected keyword or select randomly
                kw_lower = kw.lower()
                if "geopolitical" in kw_lower or "power shift" in kw_lower:
                    selected_style = "geopolitical_news"
                elif "trading" in kw_lower or "market" in kw_lower or "crypto" in kw_lower:
                    selected_style = "trading_financial"
                elif "meme" in kw_lower or "comedy" in kw_lower or "reaction" in kw_lower:
                    selected_style = random.choice(["meme_news", "funny_comedy", "meme_reaction"])
                elif "psychology" in kw_lower:
                    selected_style = "psychology_tricks"
                elif "mystery" in kw_lower or "secrets" in kw_lower:
                    selected_style = "dark_mystery"
                else:
                    selected_style = random.choice(all_styles)
                break
            else:
                db_service.add_automation_log(f"All {len(competitors)} videos for '{kw}' already processed. Trying next keyword...", "INFO")

        if not target_video:
            db_service.add_automation_log("Checked all keywords but found no unprocessed viral videos.", "WARNING")
            return False

        db_service.set_automation_state("last_keyword", selected_keyword)
        db_service.set_automation_state("last_style", selected_style)
        db_service.add_automation_log(
            f"Selected target video: '{target_video['title']}' (ID: {target_video['id']}) | Keyword: '{selected_keyword}' | Style: '{selected_style}'",
            "INFO"
        )

        # 4. Generate new script and metadata with Gemini
        db_service.add_automation_log(f"Prompting Gemini to write a high-retention script in style '{selected_style}'...", "INFO")
        prompt = (
            f"Write a viral script based on this concept: '{target_video['title']}'. "
            f"Original Description: {target_video.get('description', '')}. "
            "Regenerate this into a high-engagement vertical Short script with a high-curiosity hook, storytelling arc, and subscriber CTA."
        )

        try:
            script_package = ai_service.generate_script(
                topic=prompt,
                previous_shorts=[],
                competitor_shorts=[target_video],
                style=selected_style
            )
        except Exception as e:
            db_service.add_automation_log(f"Gemini script generation failed: {str(e)}", "ERROR")
            raise e

        db_service.add_automation_log(f"Generated script: '{script_package.title}' with {len(script_package.segments)} segments.", "INFO")

        # 5. Compile the new Short video
        db_service.add_automation_log("Starting video compilation pipeline...", "INFO")
        
        # Prepare segment inputs
        segments_data = []
        full_narration = ""
        for seg in script_package.segments:
            segments_data.append({
                "video_description": seg.video_description,
                "pexels_query": seg.pexels_query,
                "animation_details": seg.animation_details,
                "narration": seg.narration,
                "tone": seg.tone,
                "emoji": seg.emoji
            })
            full_narration += " " + seg.narration

        full_narration = full_narration.strip()
        voice = random.choice(["en-US-AndrewNeural", "en-US-EricNeural", "en-US-GuyNeural", "en-US-AvaNeural"])
        highlight_color = "#FFD700"  # Yellow highlight
        pexels_query = selected_keyword
        
        db_service.add_automation_log(f"Compiling video using voice: '{voice}'...", "INFO")
        
        try:
            # We run the compile task synchronously inside the worker thread
            output_file = asyncio.run(video_engine.compile_video(
                script_text=full_narration,
                voice=voice,
                pexels_query=pexels_query,
                highlight_color=highlight_color,
                music_path=None,
                music_volume=0.15,
                enable_subscribe=True,
                background_source="pexels",
                visual_prompt="",
                segments=segments_data,
                progress_callback=lambda p: db_service.add_automation_log(f"Video compilation progress: {p}%", "INFO")
            ))
        except Exception as e:
            db_service.add_automation_log(f"Video compilation failed: {str(e)}", "ERROR")
            raise e

        db_service.add_automation_log(f"Video compiled successfully at {output_file}.", "INFO")
        db_service.add_history_entry(output_file.name, script_package.title)

        # 6. Upload compiled video to YouTube
        db_service.add_automation_log(f"Uploading new regenerated Short to YouTube: '{script_package.title}'...", "INFO")
        try:
            upload_result = youtube_service.upload_short(
                video_path=str(output_file),
                title=script_package.title,
                description=script_package.description or f"Regenerated Short based on viral trends! #{selected_keyword.replace(' ', '')}",
                tags=script_package.tags or [selected_keyword.replace(" ", "")],
                category_id="28"  # Tech & Science
            )
            youtube_video_id = upload_result.get("video_id", "")
            db_service.add_automation_log(f"Uploaded successfully to YouTube! Video ID: {youtube_video_id}", "INFO")
            db_service.mark_history_as_posted(output_file.name, youtube_video_id)
        except Exception as e:
            db_service.add_automation_log(f"YouTube upload failed: {str(e)}", "ERROR")
            raise e

        # 7. Record to automation database processed list
        try:
            db_service.add_processed_video(
                original_youtube_id=target_video["id"],
                original_title=target_video["title"],
                original_description=target_video.get("description", ""),
                regenerated_title=script_package.title,
                youtube_video_id=youtube_video_id
            )
            db_service.add_automation_log("Cycle completed and recorded in processed logs.", "INFO")
        except Exception as e:
            db_service.add_automation_log(f"Failed to save processed video to database: {str(e)}", "ERROR")
            raise e
            
        return True
