from app.services.video_engine import VideoEngine
from app.services.youtube_service import YouTubeService
from app.services.ai_service import AIService
from app.services.db_service import DBService
from app.services.automation_worker import AutopostAutomationWorker

# Singleton instances shared across the application
video_engine = VideoEngine()
youtube_service = YouTubeService()
ai_service = AIService()
db_service = DBService()
automation_worker = AutopostAutomationWorker()
