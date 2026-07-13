import os
import re
import math
import random
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# MoviePy imports (supporting both v1.x and v2.x styles)
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

from app.config import TEMP_DIR, OUTPUT_DIR, ASSETS_DIR

# Sub-module imports
from app.services.video.speech import synthesize_speech_async
from app.services.video.image_gen import generate_story_image
from app.services.video.video_gen import (
    download_pexels_video, generate_pastel_gradient_frame,
    generate_local_simulation_frame, generate_ai_video
)
from app.services.video.subtitle import (
    group_words_into_phrases, render_subtitle_image,
    generate_emoji_clip, overlay_text_on_story_image
)

class VideoEngine:
    def __init__(self):
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

        draw.rounded_rectangle(
            [(10, 10), (width - 10, height - 10)],
            radius=25,
            fill=(30, 30, 47, 220),
            outline=(255, 255, 255, 50),
            width=2
        )

        draw.rounded_rectangle(
            [(390, 40), (560, 100)],
            radius=15,
            fill=(220, 50, 50, 255)
        )

        try:
            font_title = ImageFont.truetype("arialbd.ttf", 26)
            font_sub = ImageFont.truetype("arial.ttf", 16)
            font_btn = ImageFont.truetype("arialbd.ttf", 18)
        except Exception:
            font_title = ImageFont.load_default()
            font_sub = ImageFont.load_default()
            font_btn = ImageFont.load_default()

        draw.text((40, 35), "Enjoying the content?", fill=(255, 255, 255, 255), font=font_title)
        draw.text((40, 75), "Like & Subscribe for more!", fill=(180, 180, 190, 255), font=font_sub)
        draw.text((422, 58), "SUBSCRIBE", fill=(255, 255, 255, 255), font=font_btn)

        img.save(self.subscribe_badge_path, "PNG")

    async def synthesize_speech(self, text: str, voice: str = "en-US-EmmaMultilingualNeural", temp_prefix: str = "") -> List[Dict[str, Any]]:
        return await synthesize_speech_async(text, voice, temp_prefix)

    def _generate_story_image(self, prompt: str, style: str, temp_prefix: str = "") -> Optional[Path]:
        return generate_story_image(prompt, style, self.temp_dir, temp_prefix)

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
        segments: Optional[List[dict]] = None,
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

            # Step 2: Set up background visual clip (multi-scene support)
            if progress_callback:
                progress_callback(22)
            background_clip = None
            
            # Map words to segments if segments list is provided
            mapped_segments = []
            if segments:
                current_word_idx = 0
                for seg_idx, segment in enumerate(segments):
                    narration_text = segment.get("narration", "")
                    segment_words = [w.lower() for w in re.findall(r'\b\w+\b', narration_text) if w]
                    num_words = len(segment_words)
                    
                    if num_words == 0:
                        continue
                        
                    start_time = words[current_word_idx]["start"]
                    end_time = words[min(current_word_idx + num_words - 1, len(words) - 1)]["end"]
                    
                    if seg_idx == 0:
                        start_time = 0.0
                    
                    current_word_idx = min(current_word_idx + num_words, len(words))
                    
                    if seg_idx == len(segments) - 1 or current_word_idx >= len(words):
                        end_time = duration
                        
                    mapped_segments.append({
                        "start_time": start_time,
                        "end_time": end_time,
                        "pexels_query": segment.get("pexels_query") or pexels_query,
                        "video_description": segment.get("video_description") or visual_prompt or pexels_query
                    })
            else:
                sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', script_text) if s.strip()]
                current_word_idx = 0
                for seg_idx, sentence in enumerate(sentences):
                    sentence_words = [w.lower() for w in re.findall(r'\b\w+\b', sentence) if w]
                    num_words = len(sentence_words)
                    if num_words == 0:
                        continue
                    
                    start_time = words[current_word_idx]["start"]
                    end_time = words[min(current_word_idx + num_words - 1, len(words) - 1)]["end"]
                    
                    if seg_idx == 0:
                        start_time = 0.0
                    
                    current_word_idx = min(current_word_idx + num_words, len(words))
                    
                    if seg_idx == len(sentences) - 1 or current_word_idx >= len(words):
                        end_time = duration
                        
                    mapped_segments.append({
                        "start_time": start_time,
                        "end_time": end_time,
                        "pexels_query": pexels_query,
                        "video_description": visual_prompt or pexels_query
                    })

            # Download or generate assets for each segment
            segment_clips = []
            for seg_idx, seg in enumerate(mapped_segments):
                seg_duration = seg["end_time"] - seg["start_time"]
                if seg_duration <= 0:
                    continue
                    
                seg_clip = None
                p_query = seg["pexels_query"]
                v_desc = seg["video_description"]
                
                if background_source == "ai_video":
                    # Generate AI video clip via Replicate
                    local_ai_path = generate_ai_video(v_desc, self.temp_dir, f"{temp_prefix}_seg{seg_idx}")
                    if local_ai_path and local_ai_path.exists():
                        temp_files_to_clean.append(local_ai_path)
                        seg_clip = VideoFileClip(str(local_ai_path))
                elif background_source == "pexels":
                    # Download stock clip from Pexels API
                    local_vid_path = download_pexels_video(p_query, self.temp_dir, f"{temp_prefix}_seg{seg_idx}")
                    if local_vid_path and local_vid_path.exists():
                        temp_files_to_clean.append(local_vid_path)
                        seg_clip = VideoFileClip(str(local_vid_path))
                elif background_source == "local_model":
                    # Generate mathematical visual simulation frames
                    seg_clip = VideoClip(
                        make_frame=lambda t, d=seg_duration, q=p_query: generate_local_simulation_frame(t, d, q),
                        duration=seg_duration
                    )

                # Fallback to shifting pastel gradients if download/generation failed
                if not seg_clip:
                    print(f"Fallback gradient loop initialized for segment {seg_idx + 1}")
                    seg_clip = VideoClip(
                        make_frame=lambda t, d=seg_duration: generate_pastel_gradient_frame(t, d),
                        duration=seg_duration
                    )

                # Loop visual clip if it is shorter than target narration duration
                if seg_clip.duration < seg_duration:
                    from moviepy.video.fx.Loop import Loop
                    seg_clip = Loop(duration=seg_duration).apply(seg_clip)
                else:
                    seg_clip = seg_clip.with_duration(seg_duration)

                # Fit resolution and aspect ratio (forces vertical crop center)
                if seg_clip.w != 1080 or seg_clip.h != 1920:
                    # Calculate vertical cropping margins
                    target_aspect = 1080 / 1920
                    current_aspect = seg_clip.w / seg_clip.h
                    if current_aspect > target_aspect:
                        # Video is wider: crop horizontal margins
                        new_w = int(seg_clip.h * target_aspect)
                        x_offset = (seg_clip.w - new_w) // 2
                        seg_clip = seg_clip.cropped(x1=x_offset, y1=0, width=new_w, height=seg_clip.h)
                    else:
                        # Video is taller: crop vertical margins
                        new_h = int(seg_clip.w / target_aspect)
                        y_offset = (seg_clip.h - new_h) // 2
                        seg_clip = seg_clip.cropped(x1=0, y1=y_offset, width=seg_clip.w, height=new_h)
                    
                    # Safe resize fallback chain supporting MoviePy v1.x and v2.x
                    try:
                        seg_clip = seg_clip.resized(width=1080, height=1920)
                    except (TypeError, AttributeError):
                        try:
                            seg_clip = seg_clip.resized(new_size=(1080, 1920))
                        except (TypeError, AttributeError):
                            try:
                                seg_clip = seg_clip.resize(new_width=1080, new_height=1920)
                            except (TypeError, AttributeError):
                                seg_clip = seg_clip.resize(width=1080, height=1920)

                seg_clip = seg_clip.with_start(seg["start_time"])
                segment_clips.append(seg_clip)

            if not segment_clips:
                raise RuntimeError("Failed to build any visual background segments.")

            background_clip = concatenate_videoclips(segment_clips, method="compose")

            if progress_callback:
                progress_callback(35)

            # Step 3: Parse and generate Subtitle clips
            print("Rendering Subtitle frames...")
            subtitle_clips = []
            phrases = group_words_into_phrases(words, max_words=3)
            
            for phrase in phrases:
                phrase_duration = phrase[-1]["end"] - phrase[0]["start"]
                for w_idx, word in enumerate(phrase):
                    # Start and end boundaries for each word highlight frame
                    w_start = word["start"]
                    w_end = word["end"]
                    w_dur = w_end - w_start
                    if w_dur <= 0:
                        continue
                        
                    # Fix spacing overlaps
                    if phrase.index(word) == len(phrase) - 1:
                        # Extends last word highlight until the end of the full phrase duration
                        w_end = phrase[-1]["end"]
                        w_dur = w_end - w_start
                    
                    sub_img = render_subtitle_image(phrase, w_idx, highlight_color, self.temp_dir, temp_prefix)
                    temp_files_to_clean.append(sub_img)
                    
                    sub_clip = (ImageClip(str(sub_img))
                                .with_start(w_start)
                                .with_duration(w_dur)
                                .with_position(("center", 1400))) # Pushed to bottom vertical Short area
                    subtitle_clips.append(sub_clip)

            if progress_callback:
                progress_callback(45)

            # Step 4: Parse and generate Floating Emojis
            print("Extracting emojis & synthesizing animated cards...")
            emoji_clips = []
            # Scan text for emoji triggers
            trigger_words = ["fire", "rocket", "brain", "money", "warning", "check", "graph", "timer", "alert", "heart"]
            for idx, w in enumerate(words):
                w_clean = re.sub(r'[^\w]', '', w["word"].lower())
                if w_clean in trigger_words:
                    emoji_data = generate_emoji_clip(w_clean, w["start"], duration, self.temp_dir, temp_prefix)
                    if emoji_data:
                        e_clip, e_path = emoji_data
                        emoji_clips.append(e_clip)
                        temp_files_to_clean.append(e_path)

            # Step 5: Render Subscribe watermark badge
            overlays = []
            if enable_subscribe and duration > 6.0:
                sub_badge = (ImageClip(str(self.subscribe_badge_path))
                            .with_start(duration - 5.5)
                            .with_duration(4.5)
                            .with_position(("center", 350))) # Top vertical Short area
                
                # Apply custom opacity mask mapping for glassmorphic card fade in
                if sub_badge.mask:
                    orig_mask = sub_badge.mask
                    # Fade-in over 0.6 seconds, fade-out over 0.6 seconds
                    def fade_mask(t):
                        if t < 0.6:
                            factor = t / 0.6
                        elif t > (4.5 - 0.6):
                            factor = (4.5 - t) / 0.6
                        else:
                            factor = 1.0
                        return orig_mask.get_frame(t) * factor
                    sub_badge.mask = orig_mask.with_updated_frame_function(fade_mask)
                overlays.append(sub_badge)

            if progress_callback:
                progress_callback(50)

            # Step 6: Render progress bar overlay at the very bottom
            orig_bg = background_clip
            def progress_bar_modifier(t, clip=orig_bg):
                frame = clip.get_frame(t).copy()
                bar_h = 14
                bar_y = 1920 - bar_h
                progress_pct = t / duration
                bar_w = int(1080 * progress_pct)
                if bar_w > 0:
                    # Draw a nice bright violet progress bar at bottom
                    frame[bar_y:1920, 0:bar_w] = [139, 92, 246]
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

            video.close()
            voice_audio_clip.close()
            final_audio.close()
            background_clip.close()
            
            for clip in segment_clips:
                try:
                    clip.close()
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

    async def compile_story_video(
        self,
        story_package: dict,
        style: str,
        voice: str = "en-US-EmmaMultilingualNeural",
        progress_callback: Optional[Callable[[int], None]] = None,
        story_id: Optional[str] = None,
        chapter_idx: Optional[int] = None
    ) -> Path:
        """
        Compiles a long-form 4-5 minute storytelling video using generated AI images and audio narration.
        """
        import uuid
        temp_prefix = uuid.uuid4().hex
        temp_files_to_clean = []
        open_audio_clips = []
        
        try:
            chapters = story_package.get("chapters", [])
            total_chapters = len(chapters)
            clips = []

            # Create structured folders if story_id and chapter_idx are present
            if story_id is not None and chapter_idx is not None:
                voice_dir = self.temp_dir / f"story_{story_id}" / f"chapter_{chapter_idx}" / "voice"
                videos_dir = self.temp_dir / f"story_{story_id}" / f"chapter_{chapter_idx}" / "videos"
                voice_dir.mkdir(parents=True, exist_ok=True)
                videos_dir.mkdir(parents=True, exist_ok=True)
            else:
                voice_dir = self.temp_dir
                videos_dir = self.temp_dir
            
            # Phase 1: Ensure all scene images are generated and saved to SQLite
            print("[Compilation Phase 1] Ensuring all scene images are generated...")
            if progress_callback:
                progress_callback(5)
                
            from app.services.db_service import DBService
            db_svc = DBService()
            
            chapter_id = None
            if story_id is not None and chapter_idx is not None:
                stories = db_svc.get_stories()
                story = next((s for s in stories if s["id"] == story_id), None)
                if story and chapter_idx < len(story["chapters"]):
                    chapter_id = story["chapters"][chapter_idx]["id"]
            
            for idx, chap in enumerate(chapters):
                if progress_callback:
                    prog = 5 + int((idx / total_chapters) * 40)
                    progress_callback(prog)
                
                img_prompts = chap.get("image_prompts") or []
                if not img_prompts:
                    single_prompt = chap.get("image_prompt", "")
                    if single_prompt:
                        img_prompts = [p.strip() for p in single_prompt.split("\n") if p.strip()]
                    else:
                        img_prompts = ["a beautiful fantasy scene illustration"]
                
                scene_image_urls = chap.get("image_urls") or []
                if len(scene_image_urls) != len(img_prompts):
                    scene_image_urls = []
                    
                files_exist = True
                for url in scene_image_urls:
                    if not url:
                        files_exist = False
                        break
                    p_temp = self.temp_dir / url
                    p_out = self.output_dir / url
                    if not (p_temp.exists() or p_out.exists()):
                        files_exist = False
                        break
                        
                if scene_image_urls and files_exist:
                    print(f"[Start-from-Fail] Scene {idx + 1}/{total_chapters} already has generated preview. Skipping.")
                    # Recalculate first non-empty url
                    first_url = None
                    for url in scene_image_urls:
                        if url:
                            first_url = url
                            break
                    chap["image_url"] = first_url
                    chap["image_urls"] = scene_image_urls
                    continue
                    
                scene_image_urls = []
                for p_idx, prompt_str in enumerate(img_prompts):
                    print(f"[Local Image Gen] Generating scene {idx + 1}, frame {p_idx + 1}/{len(img_prompts)}...")
                    img_path = self._generate_story_image(prompt_str, style, f"{temp_prefix}_ch{idx}_sub{p_idx}")
                    if img_path and img_path.exists():
                        temp_files_to_clean.append(img_path)
                        
                        if story_id is not None and chapter_idx is not None:
                            folder_rel = f"story_{story_id}/chapter_{chapter_idx}"
                            (self.temp_dir / folder_rel).mkdir(parents=True, exist_ok=True)
                            thumb_filename = f"{folder_rel}/thumb_{story_id}_{chapter_idx}_{idx}_sub{p_idx}.png"
                            persistent_path = self.temp_dir / thumb_filename
                        else:
                            thumb_filename = f"thumb_{story_id or 'anon'}_{chapter_idx or 0}_{idx}_sub{p_idx}.png"
                            persistent_path = self.output_dir / thumb_filename
                        
                        import shutil
                        shutil.copy(str(img_path), str(persistent_path))
                        scene_image_urls.append(thumb_filename)
                    else:
                        fallback_filename = f"fallback_{temp_prefix}_ch{idx}_sub{p_idx}.png"
                        fallback_path = self.output_dir / fallback_filename
                        img = Image.new("RGB", (1280, 720), (30, 30, 45))
                        img.save(fallback_path)
                        scene_image_urls.append(fallback_filename)
                
                first_url = None
                for url in scene_image_urls:
                    if url:
                        first_url = url
                        break
                chap["image_url"] = first_url
                chap["image_urls"] = scene_image_urls
                
                if chapter_id:
                    scene_id = f"{chapter_id}_sc{idx}"
                    db_svc.update_scene_image(scene_id, chap["image_url"], chap["image_urls"])
                    print(f"[Start-from-Fail] Saved Scene {idx + 1} images to DB: {chap['image_url']}")

            # Phase 2: Generate TTS Voiceover audios
            print("[Compilation Phase 2] Generating voiceover TTS speech audios...")
            if progress_callback:
                progress_callback(45)
                
            audio_clips_list = []
            for idx, chap in enumerate(chapters):
                if progress_callback:
                    prog = 45 + int((idx / total_chapters) * 20)
                    progress_callback(prog)
                
                narration = chap["narration"]
                print(f"[TTS] Synthesizing speech for Scene {idx + 1}/{total_chapters}...")
                words = await self.synthesize_speech(narration, voice, f"{temp_prefix}_ch{idx}")
                original_audio_path = self.temp_dir / f"voiceover_{temp_prefix}_ch{idx}.mp3"
                
                if story_id is not None and chapter_idx is not None:
                    audio_path = voice_dir / f"voiceover_ch{idx}.mp3"
                    if original_audio_path.exists():
                        import shutil
                        shutil.move(str(original_audio_path), str(audio_path))
                else:
                    audio_path = original_audio_path
                    
                temp_files_to_clean.append(audio_path)
                
                if not audio_path.exists() or audio_path.stat().st_size == 0:
                    print(f"[TTS Error] Voiceover failed for Scene {idx + 1}.")
                    continue
                    
                audio_clip = AudioFileClip(str(audio_path))
                open_audio_clips.append(audio_clip)
                audio_clips_list.append((idx, audio_clip))

            # Phase 3: Video Assembly
            print("[Compilation Phase 3] Assembling narration audio and illustration images...")
            if progress_callback:
                progress_callback(65)
                
            for index, (idx, audio_clip) in enumerate(audio_clips_list):
                if progress_callback:
                    prog = 65 + int((index / len(audio_clips_list)) * 20)
                    progress_callback(prog)
                    
                chap = chapters[idx]
                seg_duration = audio_clip.duration
                scene_image_urls = chap.get("image_urls") or []
                
                slice_duration = seg_duration / len(scene_image_urls) if scene_image_urls else seg_duration
                
                sub_image_clips = []
                for url in scene_image_urls:
                    p_temp = self.temp_dir / url
                    p_out = self.output_dir / url
                    img_file_path = p_temp if p_temp.exists() else p_out
                    
                    if img_file_path.exists():
                        sub_image_clips.append(ImageClip(str(img_file_path)).with_duration(slice_duration))
                    else:
                        sub_image_clips.append(ColorClip(size=(1280, 720), color=(30, 30, 45)).with_duration(slice_duration))
                        
                if not sub_image_clips:
                    sub_image_clips.append(ColorClip(size=(1280, 720), color=(30, 30, 45)).with_duration(seg_duration))
                    
                segment_video_clip = concatenate_videoclips(sub_image_clips, method="compose")
                sub_clip = segment_video_clip.with_audio(audio_clip)
                clips.append(sub_clip)
            
            if not clips:
                raise RuntimeError("No storytelling clips were compiled successfully.")
                
            if progress_callback:
                progress_callback(85)
                
            final_story_video = concatenate_videoclips(clips, method="compose")
            
            if story_id is not None and chapter_idx is not None:
                dest_folder = self.output_dir / f"story_{story_id}" / f"chapter_{chapter_idx}"
                dest_folder.mkdir(parents=True, exist_ok=True)
                output_file_path = dest_folder / "compiled_video.mp4"
            else:
                output_file_path = self.output_dir / f"story_{temp_prefix}.mp4"
            
            if progress_callback:
                progress_callback(90)
                
            logger_instance = None
            try:
                from proglog import ProgressBarLogger
                class MoviePyProgressLogger(ProgressBarLogger):
                    def __init__(self):
                        super().__init__()
                    def callback(self, **changes):
                        for bar_name, bar in self.state.get('bars', {}).items():
                            if bar.get('total', 0) > 0:
                                percentage = int((bar.get('index', 0) / bar.get('total', 1)) * 100)
                                if progress_callback:
                                    progress_callback(90 + int(percentage * 0.09))
                logger_instance = MoviePyProgressLogger()
            except ImportError:
                class MoviePyProgressLoggerV1:
                    def __call__(self, *args, **kwargs):
                        pass
                    def log_value(self, value):
                        pass
                    def log_progress(self, current, total):
                        if progress_callback and total > 0:
                            percentage = int((current / total) * 100)
                            progress_callback(90 + int(percentage * 0.09))
                logger_instance = MoviePyProgressLoggerV1()

            final_story_video.write_videofile(
                str(output_file_path),
                fps=24,
                codec="libx264",
                audio_codec="aac",
                logger=logger_instance
            )
            
            final_story_video.close()
            for c in clips:
                if c.audio:
                    c.audio.close()
                c.close()
                
            if progress_callback:
                progress_callback(100)
                
            return output_file_path
            
        finally:
            print("Cleaning up temporary story compile assets...")
            for clip in open_audio_clips:
                try:
                    clip.close()
                except Exception as e:
                    print(f"Error closing audio clip: {e}")

            for temp_file in temp_files_to_clean:
                if temp_file.exists():
                    try:
                        temp_file.unlink()
                        print(f"Cleaned up temp file: {temp_file.name}")
                    except Exception as err:
                        print(f"Error deleting temp file {temp_file}: {err}")
