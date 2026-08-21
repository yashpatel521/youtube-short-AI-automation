from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Body

from app.services import youtube_service, ai_service
from app.services.db import comments as db_comments
from app.services.comment_worker import comment_worker
from app.models import (
    CommentSettingsRequest,
    CommentRuleRequest,
    CommentReplyPostRequest,
    GenerateAIReplyRequest
)

router = APIRouter(prefix="/api/comments", tags=["comments"])

@router.get("")
@router.get("/")
def get_comments(status: Optional[str] = Query(None, description="Filter by status: pending, replied, failed")):
    """Retrieves saved YouTube comments and reply history from database."""
    history = db_comments.get_comments_history(status_filter=status)
    if not history:
        # Initial sync if history is completely empty
        comment_worker.run_auto_reply_cycle()
        history = db_comments.get_comments_history(status_filter=status)
    return {"comments": history}

@router.post("/fetch")
def fetch_comments_now():
    """Manually triggers fetching latest YouTube comments and running auto-reply matching."""
    res = comment_worker.run_auto_reply_cycle()
    history = db_comments.get_comments_history()
    return {
        "summary": res,
        "comments": history
    }

@router.post("/generate-ai-reply")
def generate_ai_reply(req: GenerateAIReplyRequest):
    """Generates an AI draft reply using Gemini 2.5 Flash without posting it immediately."""
    result = ai_service.generate_comment_reply(
        comment_text=req.comment_text,
        video_title=req.video_title,
        tone=req.tone or "Enthusiastic & Friendly",
        cta_text=req.cta_text
    )
    return result

@router.post("/reply")
def reply_to_comment(req: CommentReplyPostRequest):
    """Posts a reply to a YouTube comment and marks it as replied in database."""
    if not req.reply_text.strip():
        raise HTTPException(status_code=400, detail="Reply text cannot be empty.")
    
    post_res = youtube_service.post_comment_reply(comment_id=req.comment_id, reply_text=req.reply_text)
    if post_res.get("success"):
        db_comments.mark_comment_replied(comment_id=req.comment_id, reply_text=req.reply_text, rule_id=req.rule_id)
        comment_item = db_comments.get_comment_by_id(req.comment_id)
        return {
            "success": True,
            "message": "Reply posted successfully!",
            "comment": comment_item
        }
    else:
        error_msg = post_res.get("error", "Failed to post reply")
        db_comments.mark_comment_failed(comment_id=req.comment_id, error_msg=error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

@router.get("/settings")
def get_settings():
    """Retrieves current comment auto-reply configuration and bot status."""
    settings = db_comments.get_comment_settings()
    settings["bot_running"] = comment_worker.is_running()
    return settings

@router.post("/settings")
def update_settings(req: CommentSettingsRequest):
    """Updates comment auto-reply configuration settings."""
    updated = db_comments.update_comment_settings(
        is_enabled=req.is_enabled,
        check_interval_minutes=req.check_interval_minutes,
        ai_tone=req.ai_tone,
        include_cta=req.include_cta,
        cta_text=req.cta_text
    )
    updated["bot_running"] = comment_worker.is_running()
    return updated

@router.get("/rules")
def get_rules():
    """Lists all active and inactive comment trigger rules."""
    rules = db_comments.get_comment_rules()
    return {"rules": rules}

@router.post("/rules")
def create_rule(req: CommentRuleRequest):
    """Creates a new comment trigger rule."""
    if not req.name or not req.keyword:
        raise HTTPException(status_code=400, detail="Rule name and keyword are required.")
    
    new_rule = db_comments.create_comment_rule(
        name=req.name,
        keyword=req.keyword,
        reply_mode=req.reply_mode,
        template_text=req.template_text or "",
        is_active=req.is_active
    )
    return new_rule

@router.put("/rules/{rule_id}")
def update_rule(rule_id: int, req: CommentRuleRequest):
    """Updates an existing comment trigger rule."""
    updated = db_comments.update_comment_rule(
        rule_id=rule_id,
        name=req.name,
        keyword=req.keyword,
        reply_mode=req.reply_mode,
        template_text=req.template_text or "",
        is_active=req.is_active
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Rule not found")
    return updated

@router.delete("/rules/{rule_id}")
def delete_rule(rule_id: int):
    """Deletes a comment trigger rule."""
    deleted = db_comments.delete_comment_rule(rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"success": True, "message": f"Rule {rule_id} deleted."}

@router.post("/toggle-bot")
def toggle_bot(active: bool = Body(..., embed=True)):
    """Starts or stops the background auto-reply bot worker thread."""
    db_comments.update_comment_settings(is_enabled=active)
    if active:
        comment_worker.start()
    else:
        comment_worker.stop()
    return {
        "success": True,
        "is_enabled": active,
        "bot_running": comment_worker.is_running()
    }
