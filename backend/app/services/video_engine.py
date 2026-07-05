import os
import re
import math
import random
import asyncio
import requests
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Edge TTS imports
import edge_tts

# MoviePy imports (supporting both v1.x and v2.x styles)
try:
    from moviepy.editor import (
        VideoFileClip, AudioFileClip, ImageClip, CompositeVideoClip, 
        CompositeAudioClip, VideoClip, ColorClip
    )
except ImportError:
    from moviepy import VideoFileClip, AudioFileClip, ImageClip, CompositeVideoClip, CompositeAudioClip
    from moviepy.video.VideoClip import VideoClip, ColorClip

from app.config import TEMP_DIR, OUTPUT_DIR, ASSETS_DIR, PEXELS_API_KEY

class VideoEngine:
    def __init__(self):
        # Setup paths
        self.assets_dir = ASSETS_DIR
        self.temp_dir = TEMP_DIR
        self.output_dir = OUTPUT_DIR
        self.subscribe_badge_path = self.assets_dir / "subscribe.png"
        self._ensure_subscribe_badge()

    def _ensure_subscribe_badge(self):
        """Generates a glassmorphic Subscribe card image if not already present."""
        if self.subscribe_badge_path.exists():
            return

        width, height = 600, 140
        img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Draw semi-transparent card body
        draw.rounded_rectangle(
            [(10, 10), (width - 10, height - 10)],
            radius=25,
            fill=(30, 30, 47, 220),       # Dark slate blue with opacity
            outline=(255, 255, 255, 50),   # Subtle border
            width=2
        )

        # Draw Red Subscribe Button
        draw.rounded_rectangle(
            [(390, 40), (560, 100)],
            radius=15,
            fill=(220, 50, 50, 255)        # Vivid Red
        )

        # Try to load Windows system fonts, fallback to default if missing
        try:
            font_title = ImageFont.truetype("arialbd.ttf", 26)
            font_sub = ImageFont.truetype("arial.ttf", 16)
            font_btn = ImageFont.truetype("arialbd.ttf", 18)
        except Exception:
            font_title = ImageFont.load_default()
            font_sub = ImageFont.load_default()
            font_btn = ImageFont.load_default()

        # Text overlays
        draw.text((40, 35), "Enjoying the content?", fill=(255, 255, 255, 255), font=font_title)
        draw.text((40, 75), "Like & Subscribe for more!", fill=(180, 180, 190, 255), font=font_sub)
        draw.text((422, 58), "SUBSCRIBE", fill=(255, 255, 255, 255), font=font_btn)

        img.save(self.subscribe_badge_path, "PNG")

    async def synthesize_speech(self, text: str, voice: str = "en-US-EmmaMultilingualNeural", temp_prefix: str = "") -> List[Dict[str, Any]]:
        """
        Synthesizes text into speech and extracts word-level boundary timestamps.
        Returns list of dicts with word, start, and end times in seconds.
        """
        suffix = f"_{temp_prefix}" if temp_prefix else ""
        audio_path = self.temp_dir / f"voiceover{suffix}.mp3"
        communicate = edge_tts.Communicate(text, voice, boundary="WordBoundary")
        words_data = []

        with open(audio_path, "wb") as f:
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    f.write(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    # Time is in ticks (1 tick = 100 nanoseconds = 1e-7 seconds)
                    start_sec = chunk["offset"] / 10000000.0
                    duration_sec = chunk["duration"] / 10000000.0
                    words_data.append({
                        "word": chunk["text"],
                        "start": start_sec,
                        "end": start_sec + duration_sec
                    })
        return words_data

    def _download_pexels_video(self, query: str, temp_prefix: str = "") -> Optional[Path]:
        """Downloads a portrait stock video loop from Pexels API."""
        # Check environment variable first to pick up dynamic config updates
        pexels_key = os.environ.get("PEXELS_API_KEY") or PEXELS_API_KEY
        if not pexels_key:
            print("Pexels API key not configured. Using gradient fallback.")
            return None

        headers = {"Authorization": pexels_key}
        url = f"https://api.pexels.com/v1/videos/search?query={query}&per_page=3&orientation=portrait"
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code != 200:
                print(f"Pexels API returned status code {response.status_code}")
                return None

            data = response.json()
            videos = data.get("videos", [])
            if not videos:
                print(f"No videos found on Pexels for query: {query}")
                return None

            # Pick the first video and select an HD file
            video_files = videos[0].get("video_files", [])
            selected_file = None
            
            # Prefer files with HD/FHD resolutions
            for f in video_files:
                width = f.get("width", 0) or 0
                height = f.get("height", 0) or 0
                if 720 <= width <= 1080 or 1280 <= height <= 1920:
                    selected_file = f
                    break
            
            if not selected_file and video_files:
                selected_file = video_files[0]

            if not selected_file:
                return None

            video_url = selected_file["link"]
            suffix = f"_{temp_prefix}" if temp_prefix else ""
            video_path = self.temp_dir / f"pexels{suffix}_{hash(query)}.mp4"
            
            # Download file
            print(f"Downloading video from Pexels: {video_url}")
            with requests.get(video_url, stream=True, timeout=30) as r:
                r.raise_for_status()
                with open(video_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
            
            return video_path
        except Exception as e:
            print(f"Error downloading from Pexels: {e}")
            return None

    def _generate_pastel_gradient_frame(self, t: float, duration: float) -> np.ndarray:
        """Generates a shifting pastel color gradient frame for background loops."""
        w, h = 120, 213  # Low res canvas for fast math rendering
        x = np.linspace(0, 1, w)
        y = np.linspace(0, 1, h)
        xv, yv = np.meshgrid(x, y)

        # Dynamic sine wave colors shifts
        phase = 2 * math.pi * t / duration
        r = 0.55 + 0.45 * np.sin(xv * 3 + yv * 2 + phase)
        g = 0.55 + 0.45 * np.sin(xv * 1 - yv * 3 + phase + 2.0)
        b = 0.60 + 0.40 * np.sin(xv * 2 + yv * 4 - phase + 4.0)

        # Compile and scale
        frame = np.stack([r, g, b], axis=-1) * 255
        frame = frame.astype(np.uint8)

        # Resize to 1080x1920 using PIL bilinear filtering for smooth gradients
        img = Image.fromarray(frame)
        img_resized = img.resize((1080, 1920), Image.Resampling.BILINEAR)
        return np.array(img_resized)

    def _group_words_into_phrases(self, words: List[Dict[str, Any]], max_words: int = 3) -> List[List[Dict[str, Any]]]:
        """Groups a chronological list of word timestamps into short phrases."""
        phrases = []
        current_phrase = []
        for w in words:
            # Clean up the word text
            w["word"] = w["word"].strip()
            current_phrase.append(w)
            if len(current_phrase) >= max_words or w["word"].endswith((".", "?", "!")):
                phrases.append(current_phrase)
                current_phrase = []
        if current_phrase:
            phrases.append(current_phrase)
        return phrases

    def _render_subtitle_image(self, phrase: List[Dict[str, Any]], active_idx: int, highlight_color: str = "#FFD700", temp_prefix: str = "") -> Path:
        """
        Renders a transparent PNG containing the phrase, with the active word colored and styled.
        Returns the path to the temporary PNG file.
        """
        # Create transparent canvas
        canvas_w, canvas_h = 1080, 250
        img = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Try to load a premium font
        try:
            font_path = "C:\\Windows\\Fonts\\impact.ttf"  # Standard highly visible impact font
            font = ImageFont.truetype(font_path, 80)
        except Exception:
            font = ImageFont.load_default()

        # Gather spacing and widths
        space_width = draw.textlength(" ", font=font)
        
        words_widths = []
        for w in phrase:
            w_text = w["word"].upper()
            w_width = draw.textlength(w_text, font=font)
            words_widths.append(w_width)

        total_width = sum(words_widths) + space_width * (len(phrase) - 1)
        start_x = (canvas_w - total_width) / 2
        y = 50

        # Draw word by word
        current_x = start_x
        for idx, w in enumerate(phrase):
            w_text = w["word"].upper()
            
            # Active word has yellow/green highlight, regular words are white
            if idx == active_idx:
                color = highlight_color
                stroke_width = 8
            else:
                color = "#FFFFFF"
                stroke_width = 6

            draw.text(
                (current_x, y),
                w_text,
                fill=color,
                font=font,
                stroke_width=stroke_width,
                stroke_fill="#000000"
            )
            current_x += words_widths[idx] + space_width

        # Save to temp
        prefix = f"{temp_prefix}_" if temp_prefix else ""
        unique_id = f"sub_{prefix}{phrase[0]['start']:.3f}_{active_idx}"
        img_path = self.temp_dir / f"{unique_id}.png"
        img.save(img_path, "PNG")
        return img_path

    def _generate_emoji_clip(self, emoji: str, start_time: float, video_duration: float, temp_prefix: str = "") -> Optional[tuple]:
        """Creates a floating transparent emoji clip that floats up and fades. Returns (clip, path)."""
        w, h = 250, 250
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Load Windows Segoe UI Emoji font for native colored emojis
        emoji_font_path = "C:\\Windows\\Fonts\\seguiemj.ttf"
        try:
            font = ImageFont.truetype(emoji_font_path, 110)
        except Exception:
            try:
                font = ImageFont.truetype("arial.ttf", 90)
            except Exception:
                font = ImageFont.load_default()

        # Map semantic tags to emojis
        emoji_map = {
            "fire": "🔥", "rocket": "🚀", "brain": "💡", "money": "💰", 
            "warning": "⚠️", "check": "✅", "graph": "📈", "timer": "⏱️",
            "alert": "🚨", "heart": "❤️"
        }
        emoji_char = emoji_map.get(emoji.lower(), "✨")

        # Draw centered emoji
        try:
            draw.text((w // 2, h // 2), emoji_char, font=font, fill=(255, 255, 255, 255), anchor="mm")
        except Exception:
            draw.text((w // 2 - 40, h // 2 - 40), emoji_char, font=font, fill=(255, 255, 255, 255))

        prefix = f"{temp_prefix}_" if temp_prefix else ""
        emoji_path = self.temp_dir / f"emoji_{prefix}{emoji}_{start_time}.png"
        img.save(emoji_path, "PNG")

        duration = min(2.0, video_duration - start_time)
        if duration <= 0:
            return None

        # Load into MoviePy and position
        clip = ImageClip(str(emoji_path)).with_start(start_time).with_duration(duration)

        # Position animation (float upwards)
        clip = clip.with_position(
            lambda t: (415, int(900 - 300 * (t / duration)))
        )

        # Fade out opacity modifier
        if clip.mask:
            original_mask = clip.mask
            clip.mask = original_mask.with_updated_frame_function(
                lambda t: original_mask.get_frame(t) * (1.0 - t / duration)
            )

        return (clip, emoji_path)

    def _generate_local_simulation_frame(self, t: float, duration: float, query: str) -> np.ndarray:
        """Generates dynamic abstract simulation animations locally using math and numpy."""
        query_lower = query.lower()
        w, h = 1080, 1920

        if any(k in query_lower for k in ["space", "venus", "star", "galaxy", "universe", "planet", "orbit"]):
            # Starry Particle Vortex Zoom (Space Style)
            img = Image.new("RGB", (w, h), (10, 10, 20))
            draw = ImageDraw.Draw(img)
            cx, cy = w // 2, h // 2
            
            for i in range(150):
                seed = i * 73
                r_angle = (seed % 360) * math.pi / 180.0
                r_dist = 50 + (seed * 13) % 800
                r_speed = 0.5 + (seed % 10) / 10.0
                r_size = 2 + (seed % 5)
                
                color_type = seed % 4
                if color_type == 0:
                    color = (255, 200, 255)
                elif color_type == 1:
                    color = (150, 200, 255)
                elif color_type == 2:
                    color = (200, 150, 255)
                else:
                    color = (255, 255, 255)
                
                angle = r_angle + t * r_speed
                dist = r_dist - (t * 40) % r_dist
                
                x = cx + dist * math.cos(angle)
                y = cy + dist * math.sin(angle)
                
                # Glow effect
                glow_color = (color[0] // 3, color[1] // 3, color[2] // 3)
                draw.ellipse([x - r_size * 2, y - r_size * 2, x + r_size * 2, y + r_size * 2], fill=glow_color)
                draw.ellipse([x - r_size, y - r_size, x + r_size, y + r_size], fill=color)
                
            return np.array(img)
            
        elif any(k in query_lower for k in ["animal", "nature", "forest", "ocean", "sea", "earth", "plant", "life", "water"]):
            # Organic Fluid Cellular Waves (Nature / Ocean Style)
            grid_w, grid_h = 100, 180
            x = np.linspace(-3, 3, grid_w)
            y = np.linspace(-5, 5, grid_h)
            xv, yv = np.meshgrid(x, y)
            
            z1 = np.sin(xv * 1.5 + t * 1.2) * np.cos(yv * 1.0 - t * 0.8)
            z2 = np.cos(np.sqrt(xv**2 + yv**2) * 2.0 - t * 1.5)
            z = z1 * 0.5 + z2 * 0.5
            
            g = np.uint8((z + 1.0) * 100 + 40)
            b = np.uint8((1.0 - z) * 120 + 60)
            r = np.uint8((z1 + 1.0) * 30 + 10)
            
            rgb = np.stack([r, g, b], axis=-1)
            img = Image.fromarray(rgb, "RGB")
            img = img.resize((w, h), Image.Resampling.BILINEAR)
            return np.array(img)
            
        else:
            # Plasma Chaotic Fractal Waves (Abstract Style)
            grid_w, grid_h = 100, 180
            x = np.linspace(-2, 2, grid_w)
            y = np.linspace(-3.5, 3.5, grid_h)
            xv, yv = np.meshgrid(x, y)
            
            p1 = np.sin(xv * 10.0 + t)
            p2 = np.sin(10.0 * (xv * np.sin(t / 2.0) + yv * np.cos(t / 3.0)) + t)
            cx = xv + 0.5 * np.sin(t / 5.0)
            cy = yv + 0.5 * np.cos(t / 3.0)
            p3 = np.sin(np.sqrt(100.0 * (cx**2 + cy**2) + 1.0) + t)
            p = (p1 + p2 + p3) / 3.0
            
            r = np.uint8((np.sin(p * math.pi) + 1.0) * 100 + 50)
            g = np.uint8((np.cos(p * math.pi) + 1.0) * 50 + 20)
            b = np.uint8((np.sin(p * math.pi + math.pi / 2) + 1.0) * 120 + 80)
            
            rgb = np.stack([r, g, b], axis=-1)
            img = Image.fromarray(rgb, "RGB")
            img = img.resize((w, h), Image.Resampling.BILINEAR)
            return np.array(img)

    async def compile_video(
        self,
        script_text: str,
        voice: str = "en-US-EmmaMultilingualNeural",
        pexels_query: str = "abstract loop",
        highlight_color: str = "#FFD700",
        music_path: Optional[str] = None,
        music_volume: float = 0.15,
        enable_subscribe: bool = True,
        background_source: str = "pexels",
        visual_prompt: Optional[str] = None,
        progress_callback: Optional[Callable[[int], None]] = None
    ) -> Path:
        """
        Runs the full text-to-video synthesis pipeline.
        Compiles audio narration, subtitle highlights, animated overlays, background loops,
        and outputs the completed vertical MP4.
        """
        import uuid
        temp_prefix = uuid.uuid4().hex
        temp_files_to_clean = []

        try:
            # Step 1: Synthesize voice and extract word boundary timings
            print("Synthesizing speech...")
            if progress_callback:
                progress_callback(5)
            words = await self.synthesize_speech(script_text, voice, temp_prefix)

            if not words:
                raise RuntimeError("Failed to synthesize speech or extract word boundaries.")

            if progress_callback:
                progress_callback(20)

            voice_audio_path = self.temp_dir / f"voiceover_{temp_prefix}.mp3"
            temp_files_to_clean.append(voice_audio_path)
            voice_audio_clip = AudioFileClip(str(voice_audio_path))
            duration = voice_audio_clip.duration
            print(f"Speech duration: {duration:.2f} seconds")

            # Step 2: Set up background visual clip
            if progress_callback:
                progress_callback(22)
            background_clip = None
            stock_clip_ref = None

            if background_source == "local_model":
                print("Rendering local procedural simulation background...")
                query_text = visual_prompt or pexels_query or script_text
                background_clip = VideoClip(
                    frame_function=lambda t: self._generate_local_simulation_frame(t, duration, query_text),
                    duration=duration
                )
                if progress_callback:
                    progress_callback(35)
            else:
                pexels_video_path = self._download_pexels_video(pexels_query, temp_prefix)
                
                if progress_callback:
                    progress_callback(32)
                
                if pexels_video_path and pexels_video_path.exists():
                    temp_files_to_clean.append(pexels_video_path)
                    try:
                        # Load stock footage clip
                        stock_clip = VideoFileClip(str(pexels_video_path))
                        stock_clip_ref = stock_clip
                        
                        # Check aspect ratio, crop center if landscape (16:9 -> 9:16)
                        stock_w, stock_h = stock_clip.w, stock_clip.h
                        target_ratio = 9.0 / 16.0
                        current_ratio = stock_w / stock_h
                        
                        if hasattr(stock_clip, "cropped"):
                            if current_ratio > target_ratio:
                                crop_w = int(stock_h * target_ratio)
                                x1 = (stock_w - crop_w) // 2
                                stock_clip = stock_clip.cropped(x1=x1, y1=0, width=crop_w, height=stock_h)
                            elif current_ratio < target_ratio:
                                crop_h = int(stock_w / target_ratio)
                                y1 = (stock_h - crop_h) // 2
                                stock_clip = stock_clip.cropped(x1=0, y1=y1, width=stock_w, height=crop_h)
                        else:
                            if current_ratio > target_ratio:
                                crop_w = int(stock_h * target_ratio)
                                x1 = (stock_w - crop_w) // 2
                                stock_clip = stock_clip.crop(x1=x1, y1=0, width=crop_w, height=stock_h)
                            elif current_ratio < target_ratio:
                                crop_h = int(stock_w / target_ratio)
                                y1 = (stock_h - crop_h) // 2
                                stock_clip = stock_clip.crop(x1=0, y1=y1, width=stock_w, height=crop_h)
                        
                        # Scale to 1080x1920 (support both MoviePy 1.x and 2.x API)
                        if hasattr(stock_clip, "resized"):
                            stock_clip = stock_clip.resized(new_size=(1080, 1920))
                        else:
                            stock_clip = stock_clip.resize(newsize=(1080, 1920))
                        
                        # Loop or cut the video clip to match audio duration
                        if stock_clip.duration < duration:
                            from moviepy.video.fx.Loop import Loop
                            background_clip = Loop(duration=duration).apply(stock_clip)
                        else:
                            background_clip = stock_clip.with_duration(duration)
                    except Exception as e:
                        print(f"Error loading Pexels clip: {e}. Falling back to gradient.")
                        background_clip = None

                if progress_callback:
                    progress_callback(35)

            if not background_clip:
                # Fallback: Smooth moving color gradient background
                print("Rendering gradient loop background...")
                background_clip = VideoClip(
                    frame_function=lambda t: self._generate_pastel_gradient_frame(t, duration),
                    duration=duration
                )

            # Step 3: Render subtitle clips
            print("Rendering subtitles...")
            subtitle_clips = []
            phrases = self._group_words_into_phrases(words, max_words=3)
            
            total_words = len(words)
            word_count = 0

            for phrase in phrases:
                for idx, word_info in enumerate(phrase):
                    word_count += 1
                    if progress_callback and total_words > 0:
                        current_prog = 35 + int((word_count / total_words) * 15)
                        progress_callback(current_prog)

                    start = word_info["start"]
                    end = word_info["end"]
                    
                    img_path = self._render_subtitle_image(phrase, idx, highlight_color, temp_prefix)
                    temp_files_to_clean.append(img_path)
                    
                    # Create ImageClip overlay
                    sub_clip = (ImageClip(str(img_path))
                                .with_start(start)
                                .with_duration(end - start)
                                .with_position(("center", 900)))
                    subtitle_clips.append(sub_clip)

            # Step 4: Render emoji animations based on word positions
            print("Scanning script for animated emoji cues...")
            emoji_clips = []
            keywords_emoji = ["fire", "rocket", "brain", "money", "warning", "check", "graph", "timer", "alert"]
            for w_idx, w in enumerate(words):
                if progress_callback and total_words > 0:
                    current_prog = 50 + int((w_idx / total_words) * 3)
                    progress_callback(current_prog)

                clean_word = re.sub(r'[^\w]', '', w["word"].lower())
                if clean_word in keywords_emoji:
                    e_res = self._generate_emoji_clip(clean_word, w["start"], duration, temp_prefix)
                    if e_res:
                        e_clip, emoji_path = e_res
                        emoji_clips.append(e_clip)
                        temp_files_to_clean.append(emoji_path)

            if progress_callback:
                progress_callback(53)

            # Step 5: Render "Like & Subscribe" sliding badge
            overlays = []
            if enable_subscribe and duration > 10.0:
                print("Adding sliding Like & Subscribe badge...")
                badge_clip = ImageClip(str(self.subscribe_badge_path))
                badge_w, badge_h = 600, 140
                x_pos = 240
                badge_duration = 5.0
                badge_clip = badge_clip.with_start(5.0).with_duration(badge_duration)

                # Slide-up animation math
                def badge_pos(t):
                    if t < 0.5:
                        prog = t / 0.5
                        y = 1920 - int(prog * (1920 - 1450))
                    elif t > 4.5:
                        prog = (5.0 - t) / 0.5
                        y = 1920 - int(prog * (1920 - 1450))
                    else:
                        y = 1450 + int(6 * math.sin((t - 0.5) * 3 * math.pi))
                    return (x_pos, y)

                badge_clip = badge_clip.with_position(badge_pos)
                overlays.append(badge_clip)

            # Step 6: Render progress bar at bottom of the video
            print("Rendering progress bar...")
            orig_frame_func = background_clip.frame_function
            
            def progress_bar_modifier(t):
                frame = orig_frame_func(t).copy()
                progress = t / duration
                width = int(1080 * progress)
                if width > 0:
                    frame[1880:1890, 0:width] = [255, 120, 0] # Orange color
                return frame

            background_clip = background_clip.with_updated_frame_function(progress_bar_modifier)

            # Step 7: Combine Audio Tracks
            final_audio = voice_audio_clip
            if music_path and os.path.exists(music_path):
                try:
                    bg_music = AudioFileClip(music_path)
                    if bg_music.duration < duration:
                        from moviepy.audio.fx.AudioLoop import AudioLoop
                        bg_music = AudioLoop(duration=duration).apply(bg_music)
                    else:
                        bg_music = bg_music.with_duration(duration)
                    
                    bg_music = bg_music.with_volume_scaled(music_volume)
                    final_audio = CompositeAudioClip([voice_audio_clip, bg_music])
                except Exception as e:
                    print(f"Error loading background music: {e}. Playing narration only.")

            # Step 8: Assemble Composite Video
            print("Assembling video clips...")
            all_clips = [background_clip] + subtitle_clips + emoji_clips + overlays
            video = CompositeVideoClip(all_clips, size=(1080, 1920))
            video = video.with_audio(final_audio)

            # Step 9: Render final MP4
            output_filename = f"short_{int(random.random() * 100000)}.mp4"
            output_file_path = self.output_dir / output_filename
            
            print(f"Compiling video to {output_file_path}...")
            
            if progress_callback:
                from proglog import ProgressBarLogger
                class MoviePyProgressLogger(ProgressBarLogger):
                    def bars_callback(self, bar, attr, value, old_value=None):
                        if bar == "t" and attr == "index":
                            total = self.bars[bar]["total"]
                            if total > 0:
                                percentage = int((value / total) * 100)
                                # Map 0-100% rendering to 55-98% progress
                                progress_val = 55 + int(percentage * 0.43)
                                progress_callback(progress_val)
                render_logger = MoviePyProgressLogger()
            else:
                render_logger = "bar"

            temp_audio_path = self.temp_dir / f"temp_audio_{temp_prefix}.m4a"
            temp_files_to_clean.append(temp_audio_path)

            video.write_videofile(
                str(output_file_path),
                fps=30,
                codec="libx264",
                audio_codec="aac",
                temp_audiofile=str(temp_audio_path),
                remove_temp=True,
                threads=4,
                logger=render_logger
            )

            # Close all file streams
            video.close()
            voice_audio_clip.close()
            final_audio.close()
            background_clip.close()
            
            if stock_clip_ref:
                try:
                    stock_clip_ref.close()
                except:
                    pass
            
            for clip in subtitle_clips:
                clip.close()
                
            if progress_callback:
                progress_callback(100)

            print("Video synthesis complete!")
            return output_file_path

        finally:
            print("Cleaning up temporary video compile assets...")
            for path in temp_files_to_clean:
                if path.exists():
                    try:
                        os.remove(path)
                        print(f"Cleaned up temp file: {path.name}")
                    except Exception as err:
                        print(f"Error deleting temp file {path}: {err}")

