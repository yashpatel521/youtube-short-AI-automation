from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

class ScriptRequest(BaseModel):
    topic: str
    style: Optional[str] = "dark_mystery" # "dark_mystery", "psychology_tricks", "would_you_rather", "sci_fi_what_if", "reddit_story_twist", "funny_comedy", "mind_bending_facts"
    previous_shorts: List[dict] = []
    competitor_shorts: List[dict] = []
    gemini_key: Optional[str] = None

class FunnyScriptRequest(BaseModel):
    topic: Optional[str] = None
    funny_format: Optional[str] = "pov"  # "pov", "expectation_vs_reality", "sarcastic", "plot_twist", "meme"
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

class UploadThumbnailRequest(BaseModel):
    video_id: str
    image_filename: str

class RemixRequest(BaseModel):
    topic: str
    voice: str = "en-US-GuyNeural"
    max_duration_mins: Optional[int] = 10

class AnalyticsRequest(BaseModel):
    previous_shorts: List[dict] = []
    gemini_key: Optional[str] = None

class AnalyticsShortsSuggestion(BaseModel):
    title: str = Field(description="Attention-grabbing title for the new Short.")

class CommentSettingsRequest(BaseModel):
    is_enabled: Optional[bool] = None
    check_interval_minutes: Optional[int] = None
    ai_tone: Optional[str] = None
    include_cta: Optional[bool] = None
    cta_text: Optional[str] = None

class CommentRuleRequest(BaseModel):
    name: str
    keyword: str
    reply_mode: str = "ai" # "ai", "template", "ai_with_cta"
    template_text: Optional[str] = ""
    is_active: bool = True

class CommentReplyPostRequest(BaseModel):
    comment_id: str
    reply_text: str
    rule_id: Optional[int] = None

class GenerateAIReplyRequest(BaseModel):
    comment_text: str
    video_title: str
    tone: Optional[str] = "Enthusiastic & Friendly"
    cta_text: Optional[str] = None

    concept: str = Field(description="The underlying concept or storyline.")
    hook: str = Field(description="The opening 2-second scroll-stopping hook.")
    pexels_query: str = Field(description="2-3 word search query for stock backgrounds.")
    rationale: str = Field(description="Why this specific idea was generated based on the top-viewed shorts analysis.")
    predicted_virality_score: int = Field(description="A score from 1-100 representing how viral this is likely to go.")

class ShortsAnalysisReport(BaseModel):
    top_performing_topics: List[str] = Field(description="The top 2-3 topics/themes that performed best on the channel.")
    success_factors: List[str] = Field(description="Key patterns (e.g. style, timing, pacing, hooks) found in high-view count videos.")
    optimum_duration_range: str = Field(description="Estimated best duration range based on views (e.g., '20-25 seconds').")
    growth_tips: List[str] = Field(description="Actionable tips to increase subscriber retention and CTR.")
    suggestions: List[AnalyticsShortsSuggestion] = Field(description="Exactly 5 highly optimized viral short suggestions based on the analysis.")

