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
        self.default_keywords = "AI technology hacks, coding tips, cool tech gear, software engineering secrets"
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
                # Sleep for the configured interval, checking for stop event frequently
                interval = int(db_service.get_automation_state("interval_seconds", str(self.default_interval)))
                db_service.add_automation_log(f"No video was processed. Next search cycle in {interval} seconds...", "INFO")
                
                # Sleep in small increments of 1 second so we can shut down immediately on stop request
                for _ in range(interval):
                    if self._stop_event.is_set() or db_service.get_automation_state("running", "false") != "true":
                        break
                    time.sleep(1)

        db_service.add_automation_log("Autopost Automation background loop terminated.", "INFO")

    def _execute_automation_step(self) -> bool:
        from app.services import db_service, youtube_service, ai_service, video_engine
        db_service.add_automation_log("--- Starting New Automation Cycle ---", "INFO")
        
        # 1. Fetch keywords from settings
        keywords_str = db_service.get_automation_state("keywords", self.default_keywords)
        keywords = [k.strip() for k in keywords_str.split(",") if k.strip()]
        if not keywords:
            keywords = ["AI technology shorts"]
            
        selected_keyword = random.choice(keywords)
        db_service.add_automation_log(f"Selected niche keyword for this run: '{selected_keyword}'", "INFO")

        # 2. Search for viral competitor Shorts on YouTube
        db_service.add_automation_log(f"Searching YouTube for viral competitor Shorts matching '{selected_keyword}'...", "INFO")
        try:
            competitors = youtube_service.search_competitor_shorts(selected_keyword)
        except Exception as e:
            db_service.add_automation_log(f"Failed to query YouTube search: {str(e)}", "ERROR")
            raise e

        if not competitors:
            db_service.add_automation_log(f"No competitor Shorts found for '{selected_keyword}'. Skipping cycle.", "WARNING")
            return False

        # Sort by view count descending if available, otherwise just use order
        def get_views(item):
            try:
                return int(item.get("views", 0))
            except Exception:
                return 0
        competitors.sort(key=get_views, reverse=True)

        # 3. Find first video that hasn't been processed
        target_video = None
        for comp in competitors:
            vid_id = comp.get("id")
            title = comp.get("title")
            desc = comp.get("description", "")
            
            # Check duplicate database states
            if db_service.is_video_processed(vid_id):
                continue
            if db_service.is_video_processed_by_title_or_desc(title, desc):
                db_service.add_automation_log(f"Skipping video '{title}' - marked as already processed (duplicate title/content filter).", "INFO")
                continue

            target_video = comp
            break

        if not target_video:
            db_service.add_automation_log(f"All {len(competitors)} viral videos for '{selected_keyword}' in search results are already processed. Skipping.", "WARNING")
            return False

        db_service.add_automation_log(
            f"Found viral target video: '{target_video['title']}' (ID: {target_video['id']}) with {target_video.get('views', '0')} views.",
            "INFO"
        )

        # 4. Generate new script and metadata with Gemini
        db_service.add_automation_log("Prompting Gemini to write an optimized script and SEO details...", "INFO")
        prompt = (
            f"Write a script based on this trending viral video: '{target_video['title']}'. "
            f"Original Description: {target_video.get('description', '')}. "
            "Please regenerate this into a brand-new high-engagement vertical Short script. "
            "It must have a creative hook, body, and call to action. Keep narration punchy."
        )

        try:
            script_package = ai_service.generate_script(
                topic=prompt,
                previous_shorts=[],
                competitor_shorts=[target_video]
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
