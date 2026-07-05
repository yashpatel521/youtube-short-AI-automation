from typing import List, Optional
import json
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from app.config import GEMINI_API_KEY

# Define the structured output schemas
class ScriptSegment(BaseModel):
    video_description: str = Field(description="A descriptive summary of the video visuals for this segment.")
    animation_details: str = Field(description="Detailed frame-by-frame description of caption animations, camera movements, overlays, or special effects for this segment.")
    narration: str = Field(description="The exact spoken text/script to narrate in this segment. Keep it punchy.")
    tone: str = Field(description="The recommended voice tone, pace, or mood of narration (e.g. energetic, dramatic whisper, bold statement, cinematic).")
    emoji: str = Field(description="Name of the emoji (e.g., 'fire', 'rocket', 'brain', 'money', 'warning', 'check', 'graph') to float on screen during this segment, or empty string.")

class ScriptPackage(BaseModel):
    analysis_reasoning: str = Field(description="Brief reasoning of why this script layout was chosen based on the competitive data.")
    title: str = Field(description="An attention-grabbing, highly-clickable Short title (under 50 chars) incorporating high-ranking keywords.")
    description: str = Field(description="Short description optimized for YouTube SEO containing keywords and relevant hashtags.")
    tags: List[str] = Field(description="List of 5-10 high-search-volume tags.")
    segments: List[ScriptSegment] = Field(description="The sequential segments of the Short. The total spoken word count of all segments combined (narration fields) must be between 50 and 70 words to guarantee a 20-30 second video.")

class ShortIdea(BaseModel):
    title: str = Field(description="A highly clickable, viral title for the suggested Short (under 50 chars)")
    concept: str = Field(description="The core lesson, premise, or concept of the suggested video")
    hook: str = Field(description="The opening 2-second hook line to stop the scroll")
    rationale: str = Field(description="Why this idea is suggested based on data performance or competitor patterns")
    prompt_query: str = Field(description="A simple topic keyword representation suitable for the video studio prompt, e.g., 'python else statement trick'")

class IdeaList(BaseModel):
    suggestions: List[ShortIdea] = Field(description="List of suggested viral video concepts")

class AIService:
    def __init__(self):
        self.client = None
        if GEMINI_API_KEY:
            self.client = genai.Client(api_key=GEMINI_API_KEY)

    def _get_client(self, override_key: Optional[str] = None):
        import os
        key = override_key or os.getenv("GEMINI_API_KEY") or GEMINI_API_KEY
        if key:
            return genai.Client(api_key=key)
        return self.client

    def generate_script(
        self,
        topic: str,
        previous_shorts: List[dict],
        competitor_shorts: List[dict],
        api_key_override: Optional[str] = None
    ) -> ScriptPackage:
        """
        Generates a viral script package based on competitor research and channel history using Gemini.
        """
        client = self._get_client(api_key_override)
        if not client:
            raise ValueError("Gemini API key is not configured. Please add it to your settings or .env file.")

        # Prepare context summaries
        prev_context = ""
        if previous_shorts:
            prev_context = "My previous Shorts performance:\n"
            for s in previous_shorts[:10]:
                prev_context += f"- Title: '{s.get('title')}' | Views: {s.get('views', 0)} | Likes: {s.get('likes', 0)}\n"
        else:
            prev_context = "No previous Shorts data available. This is a fresh channel.\n"

        comp_context = ""
        if competitor_shorts:
            comp_context = "Top viral competitor Shorts in this niche:\n"
            for s in competitor_shorts[:10]:
                comp_context += f"- Title: '{s.get('title')}' | Views: {s.get('views', 0)} | Description: {s.get('description', '')[:100]}... | Tags: {', '.join(s.get('tags', []))}\n"
        else:
            comp_context = "No competitor Shorts data provided. Focus on industry-standard viral hooks.\n"

        prompt = f"""
You are an expert YouTube Shorts Algorithm Growth Strategist.
I want to make a viral 20-30 second vertical video about the topic: "{topic}".

Here is our channel's performance history:
{prev_context}

Here are the highest performing competitor Shorts in this niche:
{comp_context}

Analyze the hooks, keyword structure, visual pacing, and tag strategies that made the competitor videos go viral, and consider what worked (or didn't) in our previous videos.

Task:
Generate a ScriptPackage that will rank highly, engage viewers in the first 2 seconds, hold their attention, and prompt them to like/subscribe.

CRITICAL CONSTRAINTS:
1. The total spoken text across ALL segments (the sum of the 'narration' fields) MUST be between 50 and 70 words. This is vital to keep the video duration strictly within 20 to 30 seconds.
2. In the 'video_description' fields, describe vivid looping motion graphics, abstract particle simulations, or dynamic 3D renders.
3. In the 'animation_details' fields, provide frame-by-frame details for caption transitions, text scales, camera movements, or aesthetic effects.
4. In the 'tone' fields, specify the exact emotional delivery, pace, and vocal tone instructions.
5. Keep the language natural, punchy, and conversational.
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ScriptPackage,
                temperature=0.7,
            ),
        )

        # Parse the structured JSON response
        try:
            # The SDK parses this automatically if response_schema is provided,
            # but we can also load it safely.
            data = json.loads(response.text)
            return ScriptPackage(**data)
        except Exception as e:
            # Fallback parsing/wrapping in case of edge cases
            if hasattr(response, "text"):
                raw_json = json.loads(response.text)
                return ScriptPackage(**raw_json)
            raise RuntimeError(f"Failed to generate structured script: {str(e)}")

    def suggest_viral_ideas(
        self,
        previous_shorts: List[dict],
        competitor_shorts: List[dict],
        api_key_override: Optional[str] = None
    ) -> List[dict]:
        """
        Suggests 3 viral Short concepts based on channel history and competitors.
        """
        client = self._get_client(api_key_override)
        if not client:
            raise ValueError("Gemini API key is not configured. Please add it to your settings.")

        # Prepare context summaries
        prev_context = ""
        if previous_shorts:
            prev_context = "My previous Shorts performance:\n"
            for s in previous_shorts[:10]:
                prev_context += f"- Title: '{s.get('title')}' | Views: {s.get('views', 0)} | Likes: {s.get('likes', 0)}\n"
        else:
            prev_context = "No previous Shorts data available. This is a fresh channel.\n"

        comp_context = ""
        if competitor_shorts:
            comp_context = "Top viral competitor Shorts in our niche:\n"
            for s in competitor_shorts[:10]:
                comp_context += f"- Title: '{s.get('title')}' | Views: {s.get('views', 0)} | Description: {s.get('description', '')[:100]}...\n"
        else:
            comp_context = "No competitor Shorts data provided. Focus on universal high-converting hook patterns.\n"

        prompt = f"""
You are an expert YouTube Shorts Channel Growth Consultant.
Analyze our channel's previous performance data and competitor trends to suggest exactly 3 viral Short ideas that we should create next to maximize views and subscribers.

Our channel's previous performance:
{prev_context}

Top viral competitor Shorts:
{comp_context}

Task:
Suggest exactly 3 viral Short ideas. Return them structured in JSON matching the response schema.
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=IdeaList,
                temperature=0.8,
            ),
        )

        try:
            data = json.loads(response.text)
            return data.get("suggestions", [])
        except Exception as e:
            print(f"Error parsing viral ideas suggestions: {e}")
            if hasattr(response, "text"):
                try:
                    raw = json.loads(response.text)
                    return raw.get("suggestions", [])
                except:
                    pass
            return []

    def generate_10_viral_ideas(
        self,
        previous_shorts: List[dict],
        competitor_shorts: List[dict],
        api_key_override: Optional[str] = None
    ) -> List[dict]:
        """
        Suggests exactly 10 viral Short concepts based on channel history and competitors using Gemini.
        """
        client = self._get_client(api_key_override)
        if not client:
            raise ValueError("Gemini API key is not configured. Please add it to your settings.")

        # Prepare context summaries
        prev_context = ""
        if previous_shorts:
            prev_context = "My previous Shorts performance:\n"
            for s in previous_shorts[:15]:
                prev_context += f"- Title: '{s.get('title')}' | Views: {s.get('views', 0)} | Likes: {s.get('likes', 0)}\n"
        else:
            prev_context = "No previous Shorts data available. This is a fresh channel.\n"

        comp_context = ""
        if competitor_shorts:
            comp_context = "Top viral competitor Shorts in our niche:\n"
            for s in competitor_shorts[:15]:
                comp_context += f"- Title: '{s.get('title')}' | Views: {s.get('views', 0)} | Description: {s.get('description', '')[:100]}...\n"
        else:
            comp_context = "No competitor Shorts data provided. Focus on universal high-converting hook patterns.\n"

        prompt = f"""
You are an expert YouTube Shorts Channel Growth Consultant.
Analyze our channel's previous performance data and competitor trends to suggest exactly 10 viral Short ideas that we should create next to maximize views and subscribers.

Our channel's previous performance:
{prev_context}

Top viral competitor Shorts:
{comp_context}

Task:
Suggest exactly 10 viral Short ideas. Return them structured in JSON matching the response schema, containing exactly 10 items in the list.
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=IdeaList,
                temperature=0.85,
            ),
        )

        try:
            data = json.loads(response.text)
            return data.get("suggestions", [])
        except Exception as e:
            print(f"Error parsing 10 viral ideas suggestions: {e}")
            if hasattr(response, "text"):
                try:
                    raw = json.loads(response.text)
                    return raw.get("suggestions", [])
                except:
                    pass
            return []
