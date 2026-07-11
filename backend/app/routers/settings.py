import os
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

from app.config import (
    CLIENT_SECRETS_FILE, GEMINI_API_KEY, PEXELS_API_KEY, REPLICATE_API_TOKEN, PORT
)
from app.services import db_service, youtube_service
from app.models import SettingsRequest, QualityReviewRequest

router = APIRouter(prefix="/api", tags=["settings"])

@router.get("/status")
def get_status():
    """Checks overall backend and YouTube OAuth authentication status."""
    return {
        "status": "online",
        "youtube_authenticated": youtube_service.is_authenticated(),
        "client_secrets_configured": CLIENT_SECRETS_FILE.exists()
    }

@router.get("/settings")
def get_keys_settings():
    """Returns local API key names and configurations (without showing full key values)."""
    client_secrets = {}
    if CLIENT_SECRETS_FILE.exists():
        try:
            with open(CLIENT_SECRETS_FILE, "r") as f:
                client_secrets = json.load(f)
        except Exception:
            pass

    return {
        "gemini_api_key_configured": bool(GEMINI_API_KEY),
        "pexels_api_key_configured": bool(PEXELS_API_KEY),
        "replicate_api_token_configured": bool(os.getenv("REPLICATE_API_TOKEN") or REPLICATE_API_TOKEN),
        "youtube_client_secrets_configured": CLIENT_SECRETS_FILE.exists(),
        "client_id": client_secrets.get("web", {}).get("client_id", "") or client_secrets.get("installed", {}).get("client_id", "")
    }

@router.post("/settings")
def update_settings(req: SettingsRequest):
    """Updates API keys and Google client_secrets.json files dynamically."""
    try:
        env_path = Path(__file__).resolve().parent.parent.parent / ".env"
        env_lines = []
        
        if env_path.exists():
            with open(env_path, "r") as f:
                env_lines = f.readlines()

        config_map = {}
        for line in env_lines:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                config_map[k.strip()] = v.strip()

        # Update values
        if req.gemini_api_key is not None:
            config_map["GEMINI_API_KEY"] = req.gemini_api_key
            os.environ["GEMINI_API_KEY"] = req.gemini_api_key
        if req.pexels_api_key is not None:
            config_map["PEXELS_API_KEY"] = req.pexels_api_key
            os.environ["PEXELS_API_KEY"] = req.pexels_api_key
        if req.replicate_api_token is not None:
            config_map["REPLICATE_API_TOKEN"] = req.replicate_api_token
            os.environ["REPLICATE_API_TOKEN"] = req.replicate_api_token

        with open(env_path, "w") as f:
            for k, v in config_map.items():
                f.write(f"{k}={v}\n")

        # Dynamically write client secrets if provided
        if req.youtube_client_id and req.youtube_client_secret:
            secrets_data = {
                "installed": {
                    "client_id": req.youtube_client_id,
                    "client_secret": req.youtube_client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "redirect_uris": [f"http://localhost:{PORT}/api/youtube/callback"]
                }
            }
            with open(CLIENT_SECRETS_FILE, "w") as f:
                json.dump(secrets_data, f, indent=4)

        return {"success": True, "message": "Settings updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")

@router.post("/database/reset")
def reset_database_endpoint():
    """Drops all database tables and recreates/re-seeds the default templates."""
    try:
        db_service.reset_db()
        return {"success": True, "message": "Database reset completed successfully and default data re-seeded."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset database: {str(e)}")

@router.get("/quality/reviews")
def get_quality_reviews():
    """Retrieves all submitted quality ratings and scored history logs."""
    return {"reviews": db_service.get_quality_reviews()}

@router.post("/quality/review")
def save_quality_review(req: QualityReviewRequest):
    """Saves or updates a user quality and animation review for a video."""
    try:
        db_service.save_quality_review(
            filename=req.filename,
            script_text=req.script_text,
            visual_rating=req.visual_rating,
            audio_rating=req.audio_rating,
            pacing_rating=req.pacing_rating,
            notes=req.notes
        )
        return {"success": True, "message": "Quality review saved successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save quality review: {str(e)}")
