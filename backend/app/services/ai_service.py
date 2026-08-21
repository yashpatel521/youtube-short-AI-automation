from typing import List, Optional, Dict, Any
import json
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from app.config import GEMINI_API_KEY

class CommentReplyResponse(BaseModel):
    reply_text: str = Field(description="A concise, highly engaging, YouTube comment reply under 200 characters with relevant emojis.")
    sentiment: str = Field(description="Estimated sentiment of the original comment: Positive, Neutral, Negative, Question, or Request.")

class VideoMetadataResponse(BaseModel):
    tags: List[str] = Field(description="A list of 10 to 15 optimized, search-friendly tags/keywords for this YouTube Short.")
    category_id: str = Field(description="The numeric YouTube Category ID (e.g., '28' for Science & Technology, '27' for Education, '24' for Entertainment, '22' for People & Blogs, etc.) that best fits the video content.")

class TrendingKeywordsResponse(BaseModel):
    keywords: List[str] = Field(description="List of 5 trending viral search keywords/topics for YouTube Shorts.")

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

class AnalyticsShortsSuggestion(BaseModel):
    title: str = Field(description="Attention-grabbing title for the new Short.")
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

    def analyze_previous_shorts(
        self,
        previous_shorts: List[dict],
        api_key_override: Optional[str] = None
    ) -> ShortsAnalysisReport:
        """
        Analyzes the user's historical YouTube Shorts to find success factors, optimum duration,
        and outputs a report alongside 5 viral recommended concepts.
        """
        client = self._get_client(api_key_override)
        if not client:
            raise ValueError("Gemini API key is not configured. Please add it to settings.")

        # Prepare context summaries
        prev_context = ""
        if previous_shorts:
            # Sort by views desc
            sorted_shorts = sorted(previous_shorts, key=lambda x: x.get('views', 0), reverse=True)
            prev_context = "My previous Shorts performance (sorted by view count descending):\n"
            for idx, s in enumerate(sorted_shorts[:15]):
                prev_context += f"{idx+1}. Title: '{s.get('title')}' | Views: {s.get('views', 0)} | Likes: {s.get('likes', 0)} | Comments: {s.get('comments', 0)} | Duration: {s.get('duration', 0)}s | Tags: {', '.join(s.get('tags', []))}\n"
        else:
            prev_context = "No previous Shorts data available. This is a fresh channel. Focus on current general viral trends in mind-bending facts/science/history.\n"

        prompt = f"""
You are an elite YouTube Shorts Growth Analyst and Viral Strategist.
I want you to analyze our channel's previous performance data to extract patterns of virality, and then generate 5 brand new high-performing Shorts recommendations.

Analyze:
1. What topics/hooks work best based on the views.
2. The optimal duration range that gets the highest views/engagement.
3. The common denominators in our most successful titles and tags.

Here is our performance history:
{prev_context}

Task:
Produce a detailed analysis report:
- Identify the top performing topics.
- Extract key success factors.
- Recommend optimum duration range.
- Provide general growth/retention tips.
- Generate exactly 5 highly viral Short recommendations tailored to these insights. Each suggested short must have:
  - Title (viral clickability under 50 chars)
  - Concept
  - Hook (opening 2-seconds)
  - Pexels Query (for stock backdrop assets)
  - Rationale (referencing the data)
  - Predicted Virality Score (1 to 100, where 100 is extremely likely to go viral based on standard algorithm metrics)

Return the structured response matching the ShortsAnalysisReport schema.
"""
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ShortsAnalysisReport,
                temperature=0.75,
            ),
        )

        try:
            data = json.loads(response.text)
            return ShortsAnalysisReport(**data)
        except Exception as e:
            print(f"Error parsing Shorts Analysis report: {e}")
            if hasattr(response, "text"):
                raw = json.loads(response.text)
                return ShortsAnalysisReport(**raw)
            raise RuntimeError(f"Failed to generate structured analysis report: {str(e)}")

    def generate_script(
        self,
        topic: str,
        previous_shorts: List[dict] = [],
        competitor_shorts: List[dict] = [],
        style: str = "dark_mystery",
        api_key_override: Optional[str] = None
    ) -> ScriptPackage:
        """
        Generates a viral script package based on competitor research, channel history, and viral format style.
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

        style_instructions = {
            "dark_mystery": (
                "FORMAT: Dark History & Eerie Unsolved Mysteries.\n"
                "Focus on chilling, eerie, or unexplained historical events, secret files, or ancient mysteries.\n"
                "HOOK (0-3s): Must evoke instant chills or intense mystery (e.g. 'In 1962, 3 men vanished from Alcatraz, but what police found 50 years later will chill you...').\n"
                "ENDING & SUBSCRIBER CTA: Build suspense until segment 3. End with a mind-blowing reveal + CTA: 'Subscribe for Part 2 before this gets erased.'"
            ),
            "psychology_tricks": (
                "FORMAT: Dark Psychology Hacks & Mind Games.\n"
                "Focus on subconscious tricks, body language reading, or dark psychological hacks.\n"
                "HOOK (0-3s): Direct viewer challenge (e.g. 'If someone looks at your lips while talking, do NOT ignore it. Here is what they are secretly thinking...').\n"
                "ENDING & SUBSCRIBER CTA: Deliver the psychological trick + CTA: 'Subscribe to master human psychology daily.'"
            ),
            "would_you_rather": (
                "FORMAT: High-Stakes Impossible Dilemmas & Would You Rather.\n"
                "Focus on 2 extreme survival choices or psychological dilemmas (Scenario A vs Scenario B).\n"
                "HOOK (0-3s): High-stakes survival hook (e.g. '99% of people fail this impossible survival test. Door 1 vs Door 2. Which do you pick?').\n"
                "ENDING & SUBSCRIBER CTA: Force viewers to comment ('Comment your choice below and subscribe to see if you survive tomorrow.')."
            ),
            "sci_fi_what_if": (
                "FORMAT: Sci-Fi 'What If?' & Mind-Bending Hypotheses.\n"
                "Focus on apocalyptic or crazy scientific possibilities (e.g. 'What if Earth stopped spinning for 5 seconds?' or 'What if humans slept for 100 years?').\n"
                "HOOK (0-3s): Instant apocalyptic hook with intense visual urgency.\n"
                "ENDING & SUBSCRIBER CTA: Mind-blowing scientific conclusion + CTA: 'Subscribe if you would survive this scenario.'"
            ),
            "reddit_story_twist": (
                "FORMAT: Reddit-Style Dark Suspense & Story Plot Twists.\n"
                "Focus on gripping storytelling with an unbelievable plot twist in the last 3 seconds.\n"
                "HOOK (0-3s): Suspenseful opening line ('My grandfather left me a locked box with one rule: NEVER open it after midnight...').\n"
                "ENDING & SUBSCRIBER CTA: Shocking final twist + CTA: 'Subscribe for true horror stories.'"
            ),
            "funny_comedy": (
                "FORMAT: Viral POV Comedy & Sarcastic Twists.\n"
                "Focus on hilarious everyday situations, sarcastic life advice, or unexpected comedy punchlines.\n"
                "HOOK (0-3s): Laugh-out-loud relatable POV hook.\n"
                "ENDING & SUBSCRIBER CTA: Comedic punchline + CTA: 'Subscribe for daily laughs.'"
            ),
            "meme_reaction": (
                "FORMAT: Current Viral Meme Content & Relatable Meme Reactions.\n"
                "Focus on popular viral meme trends, internet culture humor, funny relatable POV meme situations, and comedic commentary.\n"
                "HOOK (0-3s): Instant viral meme hook (e.g. 'POV: You try to do a simple task at 2 AM and the universe chooses violence...').\n"
                "ENDING & SUBSCRIBER CTA: Hilarious meme punchline or relatable reaction + CTA: 'Comment your reaction and subscribe for daily viral memes! 🎭'"
            ),
            "mind_bending_facts": (
                "FORMAT: Mind-Bending Cosmic & Human Anomalies.\n"
                "Focus on unbelievable secrets about the universe, human body, or high tech that shock the brain.\n"
                "HOOK (0-3s): Mind-blowing scroll stopper.\n"
                "ENDING & SUBSCRIBER CTA: CTA: 'Subscribe for daily brain upgrades.'"
            )
        }.get(style, "FORMAT: Dark History & Eerie Unsolved Mysteries.")

        prompt = f"""
You are an World-Class YouTube Shorts Algorithm Growth Strategist and Viral Content Creator.
I want to make a high-retention 20-30 second vertical Short about the topic: "{topic}".

Viral Style & Execution Guide:
{style_instructions}

Here is our channel's performance history:
{prev_context}

Here are top viral competitor Shorts in this niche:
{comp_context}

Task:
Generate a ScriptPackage optimized for extreme watch retention (>90%), high subscriber conversion, and viral click-through rate.

CRITICAL VIRAL CONSTRAINTS:
1. The total spoken text across ALL segments (sum of 'narration' fields) MUST be between 50 and 70 words (strictly 20-30 seconds speech duration).
2. The opening 2 seconds MUST grab attention instantly with a high-curiosity hook.
3. Include an explicit subscriber call-to-action in the final segment tailored to the style.
4. In 'video_description' fields, describe vivid looping visual scenes, dark atmospheric backgrounds, dramatic lighting, or abstract motion graphics.
5. In 'pexels_query' fields, output a simple 2-3 word search query representing cinematic stock video matching the segment (e.g. 'dark forest mist', 'brain glowing', 'storm ocean', 'scary doorway').
6. In 'tone' fields, specify vocal delivery instructions (e.g. 'dramatic whisper', 'urgent serious', 'mysterious slow', 'confident bold').
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

    def generate_funny_script(
        self,
        topic: Optional[str] = None,
        funny_format: str = "pov",
        previous_shorts: List[dict] = [],
        competitor_shorts: List[dict] = [],
        api_key_override: Optional[str] = None
    ) -> ScriptPackage:
        """
        Generates a hilarious comedy script optimized for viral YouTube Shorts (high temperature 0.85).
        """
        client = self._get_client(api_key_override)
        if not client:
            raise ValueError("Gemini API key is not configured. Please add it to your settings.")

        format_instructions = {
            "pov": "POV / Relatable Comedy style. Focus on funny everyday situations that everyone experiences but nobody talks about.",
            "expectation_vs_reality": "Expectation vs Reality style. Contrast an ideal situation with absurdly disappointing reality.",
            "sarcastic": "Sarcastic & Witty Life Advice. Use dry humor, ironies, and deadpan sarcasm.",
            "plot_twist": "Absurd Plot Twist. Start completely serious for 5 seconds, then deliver a hilarious unexpected turn.",
            "meme": "Meme Reaction style. Rapid funny commentary paired with funny stock reaction clips.",
            "animal_funny_fails": "Animal Funny Fails style. Hilarious animal clips (cats failing jumps, silly dogs, clumsy pets) with witty play-by-play commentary and comedic timing."
        }.get(funny_format, "POV / Relatable Comedy style.")

        topic_instruction = f'about the topic: "{topic}"' if topic and topic.strip() else 'about a brand new, wildly creative and viral comedy topic invented by you based on current internet humor trends'

        prompt = f"""
You are a World-Class Standup Comedian and Viral YouTube Shorts Creator.
Generate a hilarious, laugh-out-loud funny 20-30 second vertical video script {topic_instruction}.

Comedy Format: {format_instructions}

CRITICAL COMEDY CONSTRAINTS:
1. Opening Hook (0-3s): Must grab attention immediately with a relatable or absurd line.
2. Total word count across ALL segments MUST be between 50 and 70 words so the speech finishes in 20-30 seconds.
3. Include a hilarious punchline around the 15-20 second mark.
4. Ensure the final sentence loops seamlessly back into the first sentence for infinite replay value.
5. In 'pexels_query' fields, output search queries for funny stock videos, reaction memes, or humorous animal/human expressions (e.g. 'funny confused dog', 'dramatic reaction', 'shocked person').
6. In 'tone' fields, specify comedic delivery instructions (e.g., 'sarcastic', 'deadpan', 'dramatic whisper', 'over-enthusiastic').
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ScriptPackage,
                temperature=0.85,
            ),
        )

        try:
            data = json.loads(response.text)
            return ScriptPackage(**data)
        except Exception as e:
            if hasattr(response, "text"):
                raw_json = json.loads(response.text)
                return ScriptPackage(**raw_json)
            raise RuntimeError(f"Failed to generate funny script: {str(e)}")

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
Analyze our channel's performance and competitor trends, and suggest exactly 3 viral Short concepts.
Rather than overused simple facts, focus on high-converting viral formats (such as Dark History Mysteries, Dark Psychology Hacks, Impossible Survival Dilemmas / Would You Rather, Sci-Fi What-If Scenarios, or Reddit-style Story Twists) that naturally force viewers to stop scrolling, watch to the end, and subscribe.

Our channel's previous performance:
{prev_context}

Top viral competitor Shorts:
{comp_context}

Task:
Suggest exactly 3 viral Short concepts across these high-converting formats. Return them structured in JSON matching the response schema.
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
Analyze our channel's performance and competitor trends, and suggest exactly 10 viral Short concepts.
Avoid generic facts or overused categories. Focus on high-retention viral formats (e.g. Dark History Mysteries, Dark Psychology Secrets, Impossible Survival Dilemmas / Would You Rather, Sci-Fi What-If Scenarios, disturbing ocean mysteries, or Reddit Story Twists) that naturally make viewers stop scrolling, rewatch, and subscribe.

Our channel's previous performance:
{prev_context}

Top viral competitor Shorts:
{comp_context}

Task:
Suggest exactly 10 viral Short concepts across these formats. Return them structured in JSON matching the response schema, containing exactly 10 items in the list.
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

    def generate_trending_keywords(self, api_key_override: Optional[str] = None) -> List[str]:
        """
        Uses Gemini AI to dynamically generate 5 high-converting, trending search keywords for YouTube Shorts.
        """
        client = self._get_client(api_key_override)
        fallback = [
            "dark history secrets",
            "dark psychology tricks",
            "unsolved mysteries chilling",
            "impossible survival choices",
            "mind bending what if scenarios",
            "disturbing ocean mysteries",
            "viral funny pov meme trend",
            "relatable meme comedy moments",
            "current viral meme reaction"
        ]
        if not client:
            return fallback

        prompt = """
You are an expert YouTube Shorts Algorithm Growth Strategist & Viral Meme Culture Analyst.
Generate 5 high-converting, viral search keywords/topics for YouTube Shorts right now.
Must include a mix of high-retention viral niches AND current trending viral meme content, hilarious relatable POV meme concepts, trending internet humor, dark history secrets, dark psychology tricks, and shocking plot twists.

Return the structured response matching the TrendingKeywordsResponse schema.
"""
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=TrendingKeywordsResponse,
                    temperature=0.8,
                ),
            )
            data = json.loads(response.text)
            kw_list = data.get("keywords", [])
            if kw_list:
                return kw_list
        except Exception as e:
            print(f"Error generating trending keywords via Gemini: {e}")

        return fallback

    def generate_comment_reply(
        self,
        comment_text: str,
        video_title: str,
        tone: str = "Enthusiastic & Friendly",
        cta_text: Optional[str] = None,
        api_key_override: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates a personalized, engaging YouTube comment reply using Gemini 2.5 Flash.
        """
        client = self._get_client(api_key_override)
        
        # Smart fallback if AI client unavailable
        fallback_reply = f"Thanks for watching! Glad you enjoyed the Short! 🙌"
        if "part 2" in comment_text.lower():
            fallback_reply = "Part 2 is coming super soon! Make sure to subscribe so you don't miss it! 🚀"
        elif "how to" in comment_text.lower() or "make" in comment_text.lower():
            fallback_reply = "We create these Shorts using AI tools! Stay tuned for full creator tutorials! 🎬✨"
        
        if cta_text and cta_text.strip():
            fallback_reply = f"{fallback_reply} {cta_text.strip()}"

        if not client:
            return {"reply_text": fallback_reply, "sentiment": "Positive"}

        prompt = f"""
You are an engaging, popular YouTube Shorts creator responding to a fan's comment on your video.

Video Title: "{video_title}"
User Comment: "{comment_text}"
Desired Tone: "{tone}"

Requirements:
1. Write a punchy, warm, and natural reply in under 200 characters.
2. Match the specified tone ("{tone}").
3. Include 1-2 relevant emojis to boost community engagement.
4. Keep it friendly and scroll-stopping.
{"5. Attach this subtle call-to-action naturally at the end: '" + cta_text.strip() + "'" if cta_text and cta_text.strip() else ""}

Return the response matching the CommentReplyResponse schema.
"""
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=CommentReplyResponse,
                    temperature=0.7,
                ),
            )
            data = json.loads(response.text)
            reply = data.get("reply_text", "").strip()
            if reply:
                return {
                    "reply_text": reply,
                    "sentiment": data.get("sentiment", "Positive")
                }
        except Exception as e:
            print(f"Error generating comment reply via Gemini: {e}")

        return {"reply_text": fallback_reply, "sentiment": "Positive"}





