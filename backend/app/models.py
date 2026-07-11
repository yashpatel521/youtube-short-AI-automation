from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

class ScriptRequest(BaseModel):
    topic: str
    previous_shorts: List[dict] = []
    competitor_shorts: List[dict] = []
    gemini_key: Optional[str] = None

class CustomScriptRequest(BaseModel):
    title: str
    description: str
    gemini_key: Optional[str] = None

class CompileRequest(BaseModel):
    script_text: str
    title: Optional[str] = None
    voice: str = "en-US-EmmaMultilingualNeural"
    pexels_query: str = "abstract loop"
    highlight_color: str = "#FFD700"
    music_filename: Optional[str] = None
    music_volume: float = 0.15
    enable_subscribe: bool = True
    pexels_key: Optional[str] = None
    background_source: str = "pexels" # "pexels", "local_model", or "ai_video"
    visual_prompt: Optional[str] = None
    segments: Optional[List[dict]] = None

class UploadRequest(BaseModel):
    video_filename: str
    title: str
    description: str
    tags: List[str] = []
    category_id: Optional[str] = None
    privacy_status: str = "private"

class ScheduleRequest(BaseModel):
    video_filename: str
    title: str
    description: str
    tags: List[str] = []
    category_id: Optional[str] = None
    publish_at: str

class SuggestMetadataRequest(BaseModel):
    title: str
    description: str

class AutoGeneratePostRequest(BaseModel):
    prompt_query: str
    idea_title: str

class StoryGenerateRequest(BaseModel):
    topic: str
    style: str  # "anime" or "kids_cartoon"
    duration: int  # in seconds (e.g. 240, 300)
    story_title: Optional[str] = None
    previous_context: Optional[str] = None

class StoryCompileRequest(BaseModel):
    title: str
    style: str
    voice: str
    chapters: List[dict]
    story_id: Optional[str] = None
    chapter_idx: Optional[int] = None

class SettingsRequest(BaseModel):
    gemini_api_key: Optional[str] = None
    pexels_api_key: Optional[str] = None
    replicate_api_token: Optional[str] = None
    youtube_client_id: Optional[str] = None
    youtube_client_secret: Optional[str] = None

class SuggestionRequest(BaseModel):
    gemini_key: Optional[str] = None
    previous_shorts: Optional[List[dict]] = None
    competitor_shorts: Optional[List[dict]] = None

class ViralIdeasRequest(BaseModel):
    gemini_key: Optional[str] = None
    previous_shorts: Optional[List[dict]] = None
    competitor_shorts: Optional[List[dict]] = None

class QualityReviewRequest(BaseModel):
    filename: str
    script_text: str
    visual_rating: int
    audio_rating: int
    pacing_rating: int
    notes: str

class SceneNarrationRequest(BaseModel):
    story_id: str
    chapter_idx: int
    scene_title: str

class ScenePromptRequest(BaseModel):
    narration: str
    style: str

class SceneImageRequest(BaseModel):
    story_id: str
    chapter_idx: int
    scene_idx: int
    beat_idx: int
    prompt: str
    style: str

class SceneDeleteImageRequest(BaseModel):
    story_id: str
    chapter_idx: int
    scene_idx: int
    beat_idx: int

