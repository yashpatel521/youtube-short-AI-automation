from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List

from app.services import db_service, automation_worker

router = APIRouter(prefix="/api/automation", tags=["Autopost Automation"])

class AutomationConfigRequest(BaseModel):
    keywords: str
    interval_seconds: int

@router.post("/start")
def start_automation():
    """Starts the autopost automation background loop."""
    try:
        automation_worker.start()
        return {"status": "success", "message": "Automation worker loop started."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start automation: {str(e)}")

@router.post("/stop")
def stop_automation():
    """Stops the autopost automation background loop."""
    try:
        automation_worker.stop()
        return {"status": "success", "message": "Automation worker loop stopped."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop automation: {str(e)}")

@router.get("/status")
def get_automation_status() -> Dict[str, Any]:
    """Retrieves current running status, logs, settings, and processed videos history."""
    try:
        running = automation_worker.is_running()
        keywords = db_service.get_automation_state("keywords", automation_worker.default_keywords)
        interval = int(db_service.get_automation_state("interval_seconds", str(automation_worker.default_interval)))
        
        logs = db_service.get_automation_logs(limit=100)
        processed = db_service.get_processed_videos()
        
        return {
            "running": running,
            "keywords": keywords,
            "interval_seconds": interval,
            "logs": logs,
            "processed": processed
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve status: {str(e)}")

@router.post("/config")
def update_automation_config(req: AutomationConfigRequest):
    """Updates search keywords and loop interval timings."""
    try:
        if req.interval_seconds < 60:
            raise HTTPException(status_code=400, detail="Sleep interval must be at least 60 seconds (1 minute).")
            
        db_service.set_automation_state("keywords", req.keywords)
        db_service.set_automation_state("interval_seconds", str(req.interval_seconds))
        db_service.add_automation_log(
            f"Updated configuration: Keywords='{req.keywords}', Interval={req.interval_seconds}s.",
            "INFO"
        )
        return {"status": "success", "message": "Automation configuration updated successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")

@router.post("/clear-logs")
def clear_logs():
    """Clears automation logs history."""
    try:
        db_service.clear_automation_logs()
        db_service.add_automation_log("Automation log stream cleared by user.", "INFO")
        return {"status": "success", "message": "Logs cleared."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear logs: {str(e)}")
