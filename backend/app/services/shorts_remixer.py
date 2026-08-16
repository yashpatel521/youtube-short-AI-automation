import os
import re
import json
import random
import asyncio
import urllib.parse
import traceback
import requests
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# MoviePy imports supporting both v1.x and v2.x
try:
    from moviepy.editor import (
        VideoFileClip, AudioFileClip, ImageClip, CompositeVideoClip,
        CompositeAudioClip, VideoClip, ColorClip, concatenate_videoclips
    )
except ImportError:
    from moviepy import (
        VideoFileClip, AudioFileClip, ImageClip, CompositeVideoClip,
        CompositeAudioClip, concatenate_videoclips
    )
    from moviepy.video.VideoClip import VideoClip, ColorClip

from google import genai
from google.genai import types

from app.config import TEMP_DIR, OUTPUT_DIR, GEMINI_API_KEY
from app.services import db_service, youtube_service, ai_service
from app.services.video.speech import synthesize_speech_async
from app.services.video.subtitle import (
    group_words_into_phrases, render_subtitle_image, generate_emoji_clip
)

class EngagingSegmentResponse(BaseModel):
    start_time: float = Field(description="The start time of the best consecutive 30-second window in seconds, e.g. 45.0")
    end_time: float = Field(description="The end time of the segment, start_time + 30.0")
    reasoning: str = Field(description="Brief explanation of why this segment is the most engaging and viral.")

class EnglishRemixResponse(BaseModel):
    title: str = Field(description="A highly clickable vertical Short title (under 50 characters) in English.")
    description: str = Field(description="A brief description for YouTube Shorts with popular hashtags in English.")
    tags: List[str] = Field(description="5 to 10 relevant, high-traffic YouTube tags.")
    english_narration: str = Field(description="The exact spoken script text in high-energy, engaging English. Spoken word count must be strictly between 50 and 65 words so that the duration fits between 20 and 30 seconds. It should narrate what is happening in the clip with a strong scroll-stopping hook.")

def clean_vtt_subtitle(vtt_text: str) -> str:
    lines = vtt_text.splitlines()
    clean_lines = []
    seen = set()
    for line in lines:
        line = line.strip()
        # Skip VTT headers, metadata and timecodes
        if not line or "-->" in line or line.startswith("WEBVTT") or line.startswith("Kind:") or line.startswith("Language:"):
            continue
        # Remove XML tags (e.g. <c>)
        line = re.sub(r'<[^>]+>', '', line)
        if line not in seen:
            clean_lines.append(line)
            seen.add(line)
    return " ".join(clean_lines)

def search_youtube_videos_public(keyword: str) -> list:
    import yt_dlp
    shorts_query = f"{keyword} #shorts" if "#shorts" not in keyword.lower() else keyword
    videos = []
    seen_ids = set()
    
    # 1. Try yt-dlp flat search (most reliable)
    try:
        ydl_opts = {
            'skip_download': True,
            'extract_flat': True,
            'quiet': True,
            'no_warnings': True,
        }
        search_target = f"ytsearch8:{shorts_query}"
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(search_target, download=False)
            entries = info.get('entries', []) if info else []
            for entry in entries:
                if entry:
                    v_id = entry.get('id')
                    v_title = entry.get('title', 'Viral Short')
                    v_views = entry.get('view_count') or 100000
                    v_dur = entry.get('duration') or 30
                    if v_id and v_id not in seen_ids:
                        seen_ids.add(v_id)
                        videos.append({
                            "id": v_id,
                            "title": str(v_title),
                            "views": int(v_views),
                            "duration_secs": int(v_dur),
                            "description": str(v_title)
                        })
    except Exception as yt_err:
        print(f"yt-dlp search error: {yt_err}")

    if videos:
        return videos

    # 2. HTML Scrape Fallback
    url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(shorts_query)}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
    }
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code != 200:
            return []
        
        match = re.search(r"ytInitialData\s*=\s*({.*?});", r.text)
        if not match:
            match = re.search(r"var ytInitialData\s*=\s*({.*?});", r.text)
            
        if not match:
            return []
            
        data = json.loads(match.group(1))
        
        def find_videos(obj):
            if isinstance(obj, dict):
                # Check reelItemRenderer (YouTube Shorts native object)
                if "reelItemRenderer" in obj:
                    ri = obj["reelItemRenderer"]
                    video_id = ri.get("videoId", "")
                    title = ri.get("headline", {}).get("simpleText", "") or ri.get("title", {}).get("runs", [{}])[0].get("text", "")
                    if video_id and video_id not in seen_ids:
                        seen_ids.add(video_id)
                        videos.append({
                            "id": video_id,
                            "title": title or "Viral Short",
                            "views": 100000,
                            "duration_secs": 30,
                            "description": title or "YouTube Short"
                        })
                # Check videoRenderer (Standard video result, keep if duration < 60s)
                elif "videoRenderer" in obj:
                    vr = obj["videoRenderer"]
                    video_id = vr.get("videoId", "")
                    title = vr.get("title", {}).get("runs", [{}])[0].get("text", "")
                    views_text = vr.get("viewCountText", {}).get("simpleText", "0 views")
                    views = 0
                    digits = re.sub(r'[^\d]', '', views_text)
                    if digits:
                        views = int(digits)
                        
                    duration_text = vr.get("lengthText", {}).get("simpleText", "0:00")
                    duration_secs = 0
                    parts = duration_text.split(":")
                    if len(parts) == 2:
                        duration_secs = int(parts[0]) * 60 + int(parts[1])
                    elif len(parts) == 3:
                        duration_secs = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                        
                    if video_id and video_id not in seen_ids and (duration_secs == 0 or duration_secs <= 60):
                        seen_ids.add(video_id)
                        desc_runs = vr.get("descriptionSnippet", {}).get("runs", [])
                        desc = "".join([run.get("text", "") for run in desc_runs]) if desc_runs else ""
                        videos.append({
                            "id": video_id,
                            "title": title,
                            "views": views,
                            "duration_secs": duration_secs or 30,
                            "description": desc
                        })
                else:
                    for k, v in obj.items():
                        find_videos(v)
            elif isinstance(obj, list):
                for item in obj:
                    find_videos(item)
                    
        find_videos(data)
        return videos
    except Exception as e:
        print(f"Error scraping YouTube: {e}")
        return []

def get_youtube_video_transcript(video_id: str) -> str:
    import yt_dlp
    ydl_opts = {
        'writeautomaticsub': True,
        'writesubtitles': True,
        'skip_download': True,
        'subtitlesformat': 'vtt',
        'quiet': True,
        'no_warnings': True,
    }
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            subtitles = info.get('subtitles') or {}
            auto_captions = info.get('automatic_captions') or {}
            
            vtt_url = None
            for lang in ['en', 'en-US', 'en-GB']:
                if lang in subtitles:
                    vtt_url = subtitles[lang][0]['url']
                    break
                if lang in auto_captions:
                    vtt_url = auto_captions[lang][0]['url']
                    break
            
            if not vtt_url:
                for lang in subtitles:
                    vtt_url = subtitles[lang][0]['url']
                    break
            if not vtt_url:
                for lang in auto_captions:
                    vtt_url = auto_captions[lang][0]['url']
                    break
                    
            if vtt_url:
                r = requests.get(vtt_url)
                if r.status_code == 200:
                    return clean_vtt_subtitle(r.text)
    except Exception as e:
        print(f"Error fetching transcript for {video_id}: {e}")
    return ""

async def remix_video_async(job_id: str, topic: str, voice: str, max_duration_mins: int = 10):
    db_service.update_job(job_id, status="generating", progress=5, add_log=f"Starting Remix automation for topic: '{topic}'...")
    
    temp_files_to_clean = []
    
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        db_service.update_job(job_id, status="failed", error="Gemini API Key missing or invalid.", add_log="Gemini configuration error.")
        return

    try:
        # Step 1: Search YouTube Shorts Specifically
        db_service.update_job(job_id, progress=15, add_log=f"Searching YouTube Shorts for query: '{topic} #shorts'...")
        videos = search_youtube_videos_public(topic)
        
        # Filter for YouTube Shorts (duration <= 90s or unknown duration)
        filtered = [v for v in videos if v.get("duration_secs", 30) <= 90]
        if not filtered:
            filtered = videos
            
        if not filtered:
            raise RuntimeError(f"No viral YouTube Shorts found for topic: '{topic}'. Please try another search prompt.")
            
        # Select most viewed video
        selected_video = max(filtered, key=lambda x: x["views"])
        video_id = selected_video["id"]
        video_title = selected_video["title"]
        video_url = f"https://www.youtube.com/watch?v={video_id}"
        
        db_service.update_job(job_id, progress=25, add_log=f"Selected video: '{video_title}' (ID: {video_id}) with {selected_video['views']} views.")

        # Step 2: Extract subtitle transcript
        db_service.update_job(job_id, progress=30, add_log="Downloading and cleaning video captions/transcript...")
        transcript = get_youtube_video_transcript(video_id)
        
        start_time = 0.0
        end_time = 30.0
        
        if transcript:
            db_service.update_job(job_id, add_log=f"Transcript successfully extracted ({len(transcript.split())} words). Analyzing with Gemini...")
            # Step 3: Ask Gemini for best 30s segment
            prompt_segment = f"""
            Here is the text transcript of a highly viewed YouTube video titled "{video_title}":
            ---
            {transcript[:6000]}
            ---
            Analyze the content and identify the single most engaging, interesting, or punchy consecutive 25-second window (strictly 20-30 seconds) in this transcript.
            Provide the start_time (seconds from the beginning) and end_time (start_time + 25.0).
            The total duration must be strictly between 20 and 30 seconds.
            """
            try:
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt_segment,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=EngagingSegmentResponse,
                        temperature=0.2
                    )
                )
                segment_data = json.loads(response.text)
                start_time = float(segment_data.get("start_time", 0.0))
                end_time = start_time + 30.0
                
                # Bounds check
                if start_time < 0 or start_time > selected_video["duration_secs"] - 30:
                    start_time = max(0.0, float(selected_video["duration_secs"]) * 0.15) # Default to 15% in
                    end_time = start_time + 30.0
                    
                db_service.update_job(job_id, add_log=f"Gemini selected segment: {start_time:.1f}s to {end_time:.1f}s. Reasoning: {segment_data.get('reasoning')}")
            except Exception as ex:
                db_service.update_job(job_id, add_log=f"Failed to parse Gemini segment reasoning. Using default segment: {start_time}-{end_time}s.")
        else:
            # Fallback when no captions are available
            start_time = max(0.0, float(selected_video["duration_secs"]) * 0.1) # 10% in
            end_time = start_time + 30.0
            db_service.update_job(job_id, add_log=f"No subtitles found. Falling back to default video segment: {start_time:.1f}s to {end_time:.1f}s.")

        # Step 4: Download YouTube video in MP4 container (under 720p to save space)
        db_service.update_job(job_id, progress=45, add_log="Downloading selected video stream...")
        import yt_dlp
        download_filename = f"remix_download_{video_id}.mp4"
        download_path = TEMP_DIR / download_filename
        temp_files_to_clean.append(download_path)
        
        ydl_opts = {
            'format': 'best[ext=mp4][height<=720]/best[height<=720]',
            'outtmpl': str(download_path),
            'quiet': True,
            'no_warnings': True,
        }
        
        # Download video synchronously in thread
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: yt_dlp.YoutubeDL(ydl_opts).download([video_url]))
        
        if not download_path.exists():
            raise FileNotFoundError("Video download failed. Output file not generated.")
            
        db_service.update_job(job_id, progress=60, add_log="Video downloaded successfully. Initializing MoviePy editing pipeline...")

        # Step 5: Generate English Script and Metadata
        db_service.update_job(job_id, add_log="Gemini generating viral English narration script and SEO details...")
        prompt_english = f"""
        You are a viral YouTube Shorts creator targeting a global English audience.
        We are remixing a popular vertical Short: "{video_title}".
        Here is the transcript context of the segment we are cropping:
        "{transcript[int(start_time)*10:int(end_time)*10] if transcript else 'Abstract visual context'}"
        
        Generate an engaging narration script strictly in English.
        
        CRITICAL CONSTRAINTS:
        1. The narration script MUST be between 50 and 65 words so it spoken in 20-30 seconds.
        2. Keep the script high energy, punchy, with a strong scroll-stopping hook in the first 2 seconds.
        3. End with an open curiosity loop.
        """
        response_remix = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt_english,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=EnglishRemixResponse,
                temperature=0.75
            )
        )
        remix_data = json.loads(response_remix.text)
        english_script = remix_data.get("english_narration") or remix_data.get("narration") or remix_data.get("script") or "Check out this incredible viral funny moment! You won't believe what happens."
        
        db_service.update_job(job_id, add_log=f"Generated English script: '{remix_data['title']}' | Description: '{remix_data['description']}'")

        # Step 6: Speech Synthesis (English narrator)
        effective_voice = voice if voice and "en-US" in voice else "en-US-GuyNeural"
        db_service.update_job(job_id, progress=70, add_log=f"Synthesizing English speech using narrator: '{effective_voice}'...")
        import uuid
        temp_prefix = uuid.uuid4().hex
        
        words = await synthesize_speech_async(english_script, voice=effective_voice, temp_prefix=temp_prefix)
        voice_audio_path = TEMP_DIR / f"voiceover_{temp_prefix}.mp3"
        temp_files_to_clean.append(voice_audio_path)
        
        if not voice_audio_path.exists():
            raise FileNotFoundError("Speech synthesis failed to generate audio output.")
            
        voice_audio_clip = AudioFileClip(str(voice_audio_path))
        raw_voice_duration = voice_audio_clip.duration
        voice_duration = min(30.0, max(20.0, raw_voice_duration))
        db_service.update_job(job_id, add_log=f"Narration audio duration: {raw_voice_duration:.2f}s (enforcing 20-30s target: {voice_duration:.2f}s).")

        # Step 7: Load full Short clip, crop 9:16, apply mirror flip
        clip = VideoFileClip(str(download_path))
        db_service.update_job(job_id, progress=80, add_log=f"Loading full YouTube Short clip ({clip.duration:.1f}s full duration)...")
        
        # Use full Short duration (or cap at 60s for Shorts standard)
        full_duration = min(60.0, clip.duration)
        try:
            sub_clip = clip.subclipped(0, full_duration)
        except AttributeError:
            sub_clip = clip.subclip(0, full_duration)
            
        # crop to 9:16 aspect ratio
        w, h = sub_clip.w, sub_clip.h
        target_aspect = 1080 / 1920
        current_aspect = w / h
        if current_aspect > target_aspect:
            # Crop horizontal margins
            new_w = int(h * target_aspect)
            x_offset = (w - new_w) // 2
            sub_clip = sub_clip.cropped(x1=x_offset, y1=0, width=new_w, height=h)
        else:
            # Crop vertical margins
            new_h = int(w / target_aspect)
            y_offset = (h - new_h) // 2
            sub_clip = sub_clip.cropped(x1=0, y1=y_offset, width=w, height=new_h)
            
        # resize to 1080x1920
        try:
            sub_clip = sub_clip.resized(width=1080, height=1920)
        except (TypeError, AttributeError):
            try:
                sub_clip = sub_clip.resized(new_size=(1080, 1920))
            except (TypeError, AttributeError):
                try:
                    sub_clip = sub_clip.resize(new_width=1080, new_height=1920)
                except (TypeError, AttributeError):
                    sub_clip = sub_clip.resize(width=1080, height=1920)

        # Apply horizontal mirroring to bypass automated Content ID matching
        try:
            from moviepy.video.fx.MirrorX import MirrorX
            sub_clip = MirrorX().apply(sub_clip)
            db_service.update_job(job_id, add_log="Applied horizontal mirroring to bypass Content ID copyright detection.")
        except Exception as fx_err:
            try:
                from moviepy.video.fx.all import mirror_x
                sub_clip = mirror_x(sub_clip)
                db_service.update_job(job_id, add_log="Applied horizontal mirroring via legacy FX wrapper.")
            except Exception as legacy_err:
                db_service.update_job(job_id, add_log="Could not apply visual mirroring. Proceeding with standard cropped visuals.")

        # Mute original video audio and set new Hindi audio
        sub_clip = sub_clip.without_audio()
        sub_clip = sub_clip.with_audio(voice_audio_clip)

        # Step 8: Render Subtitles
        db_service.update_job(job_id, add_log="Rendering Devanagari/Hindi text subtitles...")
        subtitle_clips = []
        phrases = group_words_into_phrases(words, max_words=3)
        for phrase in phrases:
            phrase_duration = phrase[-1]["end"] - phrase[0]["start"]
            for w_idx, word in enumerate(phrase):
                w_start = word["start"]
                w_end = word["end"]
                w_dur = w_end - w_start
                if w_dur <= 0:
                    continue
                if phrase.index(word) == len(phrase) - 1:
                    w_end = phrase[-1]["end"]
                    w_dur = w_end - w_start
                
                # Subtitle background rendering
                sub_img = render_subtitle_image(phrase, w_idx, "#FFD700", TEMP_DIR, temp_prefix)
                temp_files_to_clean.append(sub_img)
                
                sub_label_clip = (ImageClip(str(sub_img))
                            .with_start(w_start)
                            .with_duration(w_dur)
                            .with_position(("center", 1400))) # Bottom vertical Short area
                subtitle_clips.append(sub_label_clip)

        # Composite video
        video = CompositeVideoClip([sub_clip] + subtitle_clips, size=(1080, 1920))
        video = video.with_duration(voice_duration)

        # Output filename
        output_filename = f"remix_{int(random.random() * 100000)}.mp4"
        output_file_path = OUTPUT_DIR / output_filename
        
        db_service.update_job(job_id, progress=85, add_log="Compiling final MP4 video file...")
        
        temp_audio_path = TEMP_DIR / f"temp_audio_{temp_prefix}.m4a"
        temp_files_to_clean.append(temp_audio_path)
        
        # Render video
        await loop.run_in_executor(None, lambda: video.write_videofile(
            str(output_file_path),
            fps=30,
            codec="libx264",
            audio_codec="aac",
            temp_audiofile=str(temp_audio_path),
            remove_temp=True,
            threads=4,
            logger="bar"
        ))
        
        video.close()
        clip.close()
        voice_audio_clip.close()
        for c in subtitle_clips:
            c.close()
            
        db_service.add_history_entry(output_filename, remix_data["title"])
        db_service.update_job(job_id, progress=90, add_log="Short compilation complete. Uploading to YouTube channel...")

        # Step 9: Upload to YouTube
        res = youtube_service.upload_short(
            video_path=str(output_file_path),
            title=remix_data["title"],
            description=remix_data["description"],
            tags=remix_data["tags"],
            privacy_status="public",
            category_id="28"  # Tech/Science default
        )
        
        if res.get("success", False):
            yt_id = res.get("video_id")
            db_service.mark_history_as_posted(output_filename, yt_id)
            db_service.update_job(
                job_id,
                status="completed",
                progress=100,
                video_path=str(output_file_path),
                video_filename=output_filename,
                add_log=f"Short posted successfully to YouTube! Watch URL: https://youtube.com/watch?v={yt_id}"
            )
        else:
            raise RuntimeError(res.get("error", "YouTube upload failed"))

    except Exception as e:
        error_msg = str(e)
        print(f"Error in Remix automation job {job_id}: {error_msg}")
        db_service.update_job(
            job_id,
            status="failed",
            error=error_msg,
            add_log=f"Remix process failed: {error_msg}\n{traceback.format_exc()}"
        )
    finally:
        # Cleanup
        for path in temp_files_to_clean:
            if path.exists():
                try:
                    os.remove(path)
                except Exception as err:
                    print(f"Error deleting temp file {path}: {err}")
