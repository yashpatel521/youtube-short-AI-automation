import time
import threading
from typing import Dict, Any, List, Optional

from app.services import youtube_service, ai_service
from app.services.db import comments as db_comments

class CommentAutoReplyWorker:
    def __init__(self):
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._is_active = False

    def start(self):
        """Starts the background comment auto-reply polling loop."""
        if self._thread and self._thread.is_alive():
            print("[Comment Worker] Worker thread is already running.")
            return

        self._stop_event.clear()
        self._is_active = True
        self._thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._thread.start()
        print("[Comment Worker] Background comment auto-reply worker started.")

    def stop(self):
        """Stops the background worker thread."""
        self._is_active = False
        self._stop_event.set()
        print("[Comment Worker] Stopping background comment worker...")

    def is_running(self) -> bool:
        return self._is_active and self._thread is not None and self._thread.is_alive()

    def _worker_loop(self):
        while not self._stop_event.is_set():
            try:
                settings = db_comments.get_comment_settings()
                if settings.get("is_enabled", 1) == 1:
                    print("[Comment Worker] Running automated comment reply check...")
                    self.run_auto_reply_cycle()
                else:
                    print("[Comment Worker] Auto-reply is currently paused in settings.")

                interval_minutes = settings.get("check_interval_minutes", 5)
                # Sleep in 5-second increments to remain responsive to stop signals
                for _ in range(max(1, interval_minutes * 12)):
                    if self._stop_event.is_set():
                        break
                    time.sleep(5)

            except Exception as e:
                print(f"[Comment Worker] Error in worker loop: {e}")
                time.sleep(30)

    def run_auto_reply_cycle(self) -> Dict[str, Any]:
        """Runs a single pass of fetching unreplied YouTube comments and posting replies."""
        try:
            settings = db_comments.get_comment_settings()
            rules = [r for r in db_comments.get_comment_rules() if r.get("is_active", 1) == 1]
            
            comments = youtube_service.fetch_channel_comments(max_results=30)
            processed_count = 0
            replied_count = 0

            ai_tone = settings.get("ai_tone", "Enthusiastic & Friendly")
            include_cta = settings.get("include_cta", 1) == 1
            cta_text = settings.get("cta_text", "") if include_cta else None

            for c in comments:
                cid = c["comment_id"]
                vid = c["video_id"]
                vtitle = c.get("video_title", "Short Video")
                author = c.get("author_name", "Viewer")
                avatar = c.get("author_profile_image", "")
                text = c.get("comment_text", "")

                # Check if comment exists in DB
                existing = db_comments.get_comment_by_id(cid)
                if existing and existing.get("reply_status") == "replied":
                    continue

                processed_count += 1

                # Check for matching rule
                matched_rule = None
                reply_text = ""
                for r in rules:
                    kw = r.get("keyword", "").strip().lower()
                    if kw and kw in text.lower():
                        matched_rule = r
                        break

                rule_id = matched_rule["id"] if matched_rule else None

                if matched_rule:
                    mode = matched_rule.get("reply_mode", "ai")
                    if mode == "template" and matched_rule.get("template_text"):
                        reply_text = matched_rule.get("template_text")
                    else:
                        ai_res = ai_service.generate_comment_reply(
                            comment_text=text,
                            video_title=vtitle,
                            tone=ai_tone,
                            cta_text=cta_text
                        )
                        reply_text = ai_res.get("reply_text", "")
                else:
                    ai_res = ai_service.generate_comment_reply(
                        comment_text=text,
                        video_title=vtitle,
                        tone=ai_tone,
                        cta_text=cta_text
                    )
                    reply_text = ai_res.get("reply_text", "")

                # Save or update initial pending record
                db_comments.save_or_update_comment(
                    comment_id=cid,
                    video_id=vid,
                    video_title=vtitle,
                    author_name=author,
                    author_profile_image=avatar,
                    comment_text=text,
                    reply_text=reply_text,
                    reply_status="pending",
                    rule_id=rule_id
                )

                # Post reply if auto-reply is enabled globally
                if settings.get("is_enabled", 1) == 1:
                    post_res = youtube_service.post_comment_reply(comment_id=cid, reply_text=reply_text)
                    if post_res.get("success"):
                        db_comments.mark_comment_replied(comment_id=cid, reply_text=reply_text, rule_id=rule_id)
                        replied_count += 1
                        print(f"[Comment Worker] Auto-replied to comment {cid} by {author}")
                    else:
                        err = post_res.get("error", "Failed to post reply")
                        db_comments.mark_comment_failed(comment_id=cid, error_msg=err)

            return {
                "success": True,
                "fetched": len(comments),
                "processed": processed_count,
                "replied": replied_count
            }

        except Exception as e:
            print(f"[Comment Worker] Error running auto-reply cycle: {e}")
            return {"success": False, "error": str(e)}

comment_worker = CommentAutoReplyWorker()
