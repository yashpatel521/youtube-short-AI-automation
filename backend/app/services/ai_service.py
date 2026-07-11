from typing import List, Optional
import json
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from app.config import GEMINI_API_KEY

class VideoMetadataResponse(BaseModel):
    tags: List[str] = Field(description="A list of 10 to 15 optimized, search-friendly tags/keywords for this YouTube Short.")
    category_id: str = Field(description="The numeric YouTube Category ID (e.g., '28' for Science & Technology, '27' for Education, '24' for Entertainment, '22' for People & Blogs, etc.) that best fits the video content.")

# Define the structured output schemas
class ScriptSegment(BaseModel):
    video_description: str = Field(description="A descriptive summary of the video visuals for this segment.")
    pexels_query: str = Field(description="A simple 2-3 word search query for a realistic stock video matching this segment (e.g. 'rocket launch', 'laptop coding', 'person smiling').")
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

class CustomVideoDetails(BaseModel):
    idea_description: str = Field(description="A detailed explanation of the core concept and theme of this custom video idea.")
    visual_prompt: str = Field(description="A detailed frame-by-frame visual motion prompt describing elements, coordinates, particle animations, or video visual flow that will be passed directly to the video generator.")
    narration: str = Field(description="The complete spoken narration script. Spoken word count must be strictly between 50 and 70 words.")

class ShortIdea(BaseModel):
    title: str = Field(description="A highly clickable, viral title for the suggested Short (under 50 chars)")
    concept: str = Field(description="The core lesson, premise, or concept of the suggested video")
    hook: str = Field(description="The opening 2-second hook line to stop the scroll")
    rationale: str = Field(description="Why this idea is suggested based on data performance or competitor patterns")
    prompt_query: str = Field(description="A simple topic keyword representation suitable for the video studio prompt, e.g., 'python else statement trick'")

class IdeaList(BaseModel):
    suggestions: List[ShortIdea] = Field(description="List of suggested viral video concepts")

class StorySegment(BaseModel):
    title: str = Field(description="The short title of this chapter (e.g. 'Discovery', 'The Forest Portal', 'The Flying Ship').")
    narration: str = Field(description="The spoken narration text for this chapter/segment of the story. Must be highly descriptive and readable (approx 25-30 words).")
    image_prompts: List[str] = Field(description="A list of exactly 3 sequential illustration prompts representing consecutive visual beats to keep the video dynamically moving.")

class StoryPackage(BaseModel):
    title: str = Field(description="The title of the story.")
    chapters: List[StorySegment] = Field(description="The sequential chapters/segments of the story. For a 4-5 minute video, generate exactly 24 chapters. Each chapter's narration should be around 25-30 words, totaling 600-720 words.")


class SceneNarrationResponse(BaseModel):
    narration: str = Field(description="The spoken narration text for this scene. Must be highly descriptive and readable, approx 25-30 words.")

class SceneImagePromptsResponse(BaseModel):
    image_prompts: List[str] = Field(description="Exactly 3 sequential illustration prompts representing consecutive visual beats matching the narration.")

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
6. In the 'pexels_query' fields, output a simple 2-3 word search query representing a highly realistic stock video matching this segment's visual description.
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
You are an expert YouTube Shorts Channel Growth Consultant and viral content creator.
Analyze our channel's performance and competitor trends, and suggest exactly 3 viral Short fact-based ideas.
Rather than generic topics or animals, focus on top trending mind-bending facts (e.g. in space, psychology, historical mysteries, futuristic science, brain facts) that have extreme clickability and high viral potential.

Our channel's previous performance:
{prev_context}

Top viral competitor Shorts:
{comp_context}

Task:
Suggest exactly 3 viral Short fact-based ideas. Return them structured in JSON matching the response schema.
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
You are an expert YouTube Shorts Channel Growth Consultant and viral content creator.
Analyze our channel's performance and competitor trends, and suggest exactly 10 viral Short fact-based ideas.
Avoid generic topics or overused animal categories. Focus on mind-bending, highly engaging facts (e.g. unknown historical secrets, psychology hacks, cosmic mysteries, human body anomalies, technology mysteries) that naturally make viewers stop scrolling and rewatch.

Our channel's previous performance:
{prev_context}

Top viral competitor Shorts:
{comp_context}

Task:
Suggest exactly 10 viral Short fact-based ideas. Return them structured in JSON matching the response schema, containing exactly 10 items in the list.
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

    def generate_custom_details(
        self,
        title: str,
        description: str,
        api_key_override: Optional[str] = None
    ) -> CustomVideoDetails:
        """
        Generates custom video details (Idea details, visual prompt, and narration) from a user-supplied title and description.
        """
        client = self._get_client(api_key_override)
        if not client:
            raise ValueError("Gemini API key is not configured. Please add it to settings.")

        prompt = f"""
You are an expert AI Video Producer. 
I am designing a viral Short video. I will give you a title and description, and you will generate:
1. 'idea_description': A detailed description explaining the core concept/idea and the hook strategy.
2. 'visual_prompt': A detailed, frame-by-frame visual prompt describing particle movements, coordinates, vortexes, waves, or camera zooms to pass to the video generator.
3. 'narration': The exact voiceover narration script. The total spoken text must be strictly between 50 and 70 words (guaranteeing a 20-30s duration).

Input Video Title: "{title}"
Input Video Description: "{description}"

Task:
Generate the CustomVideoDetails JSON package. Make the narration text highly engaging and natural.
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CustomVideoDetails,
                temperature=0.75,
            ),
        )

        try:
            data = json.loads(response.text)
            return CustomVideoDetails(**data)
        except Exception as e:
            raise RuntimeError(f"Failed to generate structured custom details: {str(e)}")

    def generate_youtube_metadata(
        self,
        title: str,
        description: str,
        api_key_override: Optional[str] = None
    ) -> VideoMetadataResponse:
        """
        Uses Gemini to suggest YouTube tags and the best Category ID based on title and description.
        """
        client = self._get_client(api_key_override)
        if not client:
            # Fallback defaults if key is not configured
            return VideoMetadataResponse(tags=["shorts", "video"], category_id="22")

        prompt = f"""
You are an expert YouTube SEO optimizer assistant.
Based on the following video Title and Description, generate:
1. 'tags': A list of 10 to 15 optimized, search-friendly tags (keywords).
2. 'category_id': The best-fitting numeric YouTube category ID. Choose from:
   - '28' (Science & Technology)
   - '27' (Education)
   - '24' (Entertainment)
   - '20' (Gaming)
   - '22' (People & Blogs)
   - '17' (Sports)
   - '10' (Music)
   - '1' (Film & Animation)
   - '2' (Autos & Vehicles)
   - '15' (Pets & Animals)

Video Title: "{title}"
Video Description: "{description}"

Task:
Generate the VideoMetadataResponse JSON. Make tags highly relevant to search traffic.
"""
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=VideoMetadataResponse,
                    temperature=0.7,
                ),
            )
            data = json.loads(response.text)
            return VideoMetadataResponse(**data)
        except Exception as e:
            print(f"Error generating YouTube metadata via Gemini: {e}")
            return VideoMetadataResponse(tags=["shorts", "video"], category_id="24")

    def generate_story_script(
        self,
        topic: str,
        style: str,
        duration: int,
        story_title: Optional[str] = None,
        previous_context: Optional[str] = None,
        api_key_override: Optional[str] = None
    ) -> StoryPackage:
        """
        Generates a structured storytelling script and image storyboard using Gemini.
        """
        client = self._get_client(api_key_override)
        if not client:
            raise ValueError("Gemini API key is not configured. Please add it to settings.")

        style_context = "anime manga illustration style" if style == "anime" else "kids cartoon colorful drawing style"
        
        prompt = f"""
You are an expert children's book author and storyboard designer.
I want to write a beautiful storytelling script about the topic: "{topic}".
The desired target video duration is {duration} seconds (approx 4-5 minutes).
"""

        if story_title:
            prompt += f"\nThis chapter is part of the story/playlist: '{story_title}'.\n"
        if previous_context:
            prompt += f"\nHere is the storyline progression of the previous chapters so far:\n{previous_context}\n\nCRITICAL: The narration and characters in the new chapters MUST continue seamlessly from the plot established in the previous chapters above to maintain narrative continuity!\n"

        prompt += f"""
Task:
Generate exactly 24 story chapters/segments. For each chapter, generate:
1. 'title': A short title for this segment.
2. 'narration': The spoken narration story text (exactly 25 to 30 words per segment).
3. 'image_prompts': A list of exactly 3 sequential text-to-image illustration prompts in {style_context}. Each prompt should describe sequential action/beats to keep the video dynamically moving without visual stalls. Describe character, action, setting, colors, and background. Do not use generic style terms.

Make sure the storyline flows logically and keeps children or listeners engaged. Return the output structured in JSON matching the StoryPackage response schema.
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=StoryPackage,
                temperature=0.8,
            ),
        )

        try:
            data = json.loads(response.text)
            return StoryPackage(**data)
        except Exception as e:
            raise RuntimeError(f"Failed to generate structured story script: {str(e)}")

    def generate_scene_narration(
        self,
        previous_context: str,
        scene_title: str,
        api_key_override: Optional[str] = None
    ) -> str:
        client = self._get_client(api_key_override)
        if not client:
            raise ValueError("Gemini API key is not configured.")

        prompt = f"""
You are an expert children's story writer.
I need to write a narration for a scene titled "{scene_title}".
Here is the context of the story so far (previous scenes and chapters):
{previous_context}

Task:
Write a single paragraph of spoken narration for this new scene. It must continue the story plot seamlessly and logically from the context above.
Keep the narration length strictly between 25 and 30 words.
"""
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=SceneNarrationResponse,
                temperature=0.8,
            ),
        )
        try:
            data = json.loads(response.text)
            return data.get("narration", "")
        except Exception as e:
            raise RuntimeError(f"Failed to generate structured scene narration: {e}")

    def generate_scene_image_prompts(
        self,
        narration: str,
        style: str,
        api_key_override: Optional[str] = None
    ) -> List[str]:
        client = self._get_client(api_key_override)
        if not client:
            raise ValueError("Gemini API key is not configured.")

        style_context = "anime manga illustration style" if style == "anime" else "kids cartoon colorful drawing style"
        prompt = f"""
You are an expert storyboard artist.
I have a scene with the following narration:
"{narration}"

Task:
Generate exactly 3 sequential text-to-image illustration prompts in {style_context} representing the sequential visual beats / action flow matching this narration.
Each prompt should describe the characters, action, setting, colors, and background. Do not use generic style terms.
"""
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=SceneImagePromptsResponse,
                temperature=0.85,
            ),
        )
        try:
            data = json.loads(response.text)
            return data.get("image_prompts", [])
        except Exception as e:
            raise RuntimeError(f"Failed to generate structured scene image prompts: {e}")

