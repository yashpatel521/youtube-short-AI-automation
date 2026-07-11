import re
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from PIL import Image, ImageDraw, ImageFont

# MoviePy imports (supporting both v1.x and v2.x styles)
try:
    from moviepy.editor import ImageClip
except ImportError:
    from moviepy import ImageClip

def group_words_into_phrases(words: List[Dict[str, Any]], max_words: int = 3) -> List[List[Dict[str, Any]]]:
    """Groups a chronological list of word timestamps into short phrases."""
    phrases = []
    current_phrase = []
    for w in words:
        w["word"] = w["word"].strip()
        current_phrase.append(w)
        if len(current_phrase) >= max_words or w["word"].endswith((".", "?", "!")):
            phrases.append(current_phrase)
            current_phrase = []
    if current_phrase:
        phrases.append(current_phrase)
    return phrases

def render_subtitle_image(phrase: List[Dict[str, Any]], active_idx: int, highlight_color: str, temp_dir: Path, temp_prefix: str = "") -> Path:
    """
    Renders a transparent PNG containing the phrase, with the active word colored and styled.
    Returns the path to the temporary PNG file.
    """
    canvas_w, canvas_h = 1080, 250
    img = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    try:
        font_path = "C:\\Windows\\Fonts\\impact.ttf"
        font = ImageFont.truetype(font_path, 80)
    except Exception:
        font = ImageFont.load_default()

    space_width = draw.textlength(" ", font=font)
    
    words_widths = []
    for w in phrase:
        w_text = w["word"].upper()
        w_width = draw.textlength(w_text, font=font)
        words_widths.append(w_width)

    total_width = sum(words_widths) + space_width * (len(phrase) - 1)
    start_x = (canvas_w - total_width) / 2
    y = 50

    current_x = start_x
    for idx, w in enumerate(phrase):
        w_text = w["word"].upper()
        
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

    prefix = f"{temp_prefix}_" if temp_prefix else ""
    unique_id = f"sub_{prefix}{phrase[0]['start']:.3f}_{active_idx}"
    img_path = temp_dir / f"{unique_id}.png"
    img.save(img_path, "PNG")
    return img_path

def generate_emoji_clip(emoji: str, start_time: float, video_duration: float, temp_dir: Path, temp_prefix: str = "") -> Optional[tuple]:
    """Creates a floating transparent emoji clip that floats up and fades. Returns (clip, path)."""
    w, h = 250, 250
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    emoji_font_path = "C:\\Windows\\Fonts\\seguiemj.ttf"
    try:
        font = ImageFont.truetype(emoji_font_path, 110)
    except Exception:
        try:
            font = ImageFont.truetype("arial.ttf", 90)
        except Exception:
            font = ImageFont.load_default()

    emoji_map = {
        "fire": "🔥", "rocket": "🚀", "brain": "💡", "money": "💰", 
        "warning": "⚠️", "check": "✅", "graph": "📈", "timer": "⏱️",
        "alert": "🚨", "heart": "❤️"
    }
    emoji_char = emoji_map.get(emoji.lower(), "✨")

    try:
        draw.text((w // 2, h // 2), emoji_char, font=font, fill=(255, 255, 255, 255), anchor="mm")
    except Exception:
        draw.text((w // 2 - 40, h // 2 - 40), emoji_char, font=font, fill=(255, 255, 255, 255))

    prefix = f"{temp_prefix}_" if temp_prefix else ""
    emoji_path = temp_dir / f"emoji_{prefix}{emoji}_{start_time}.png"
    img.save(emoji_path, "PNG")

    duration = min(2.0, video_duration - start_time)
    if duration <= 0:
        return None

    clip = ImageClip(str(emoji_path)).with_start(start_time).with_duration(duration)

    clip = clip.with_position(
        lambda t: (415, int(900 - 300 * (t / duration)))
    )

    if clip.mask:
        original_mask = clip.mask
        clip.mask = original_mask.with_updated_frame_function(
            lambda t: original_mask.get_frame(t) * (1.0 - t / duration)
        )

    return (clip, emoji_path)

def overlay_text_on_story_image(img_path: Path, text: str):
    """Overlays a clean, centered storytelling narration subtitle at the bottom of the PIL image."""
    try:
        img = Image.open(img_path)
        draw = ImageDraw.Draw(img)
        w, h = img.size
        
        try:
            font = ImageFont.truetype("arialbd.ttf", 36)
        except Exception:
            font = ImageFont.load_default()
            
        words = text.split()
        lines = []
        current_line = []
        for word in words:
            current_line.append(word)
            test_line = " ".join(current_line)
            if draw.textlength(test_line, font=font) > (w - 120):
                current_line.pop()
                lines.append(" ".join(current_line))
                current_line = [word]
        if current_line:
            lines.append(" ".join(current_line))
            
        line_height = 45
        card_h = len(lines) * line_height + 40
        draw.rounded_rectangle(
            [(60, h - card_h - 40), (w - 60, h - 40)],
            radius=15,
            fill=(0, 0, 0, 160)
        )
        
        for idx, line in enumerate(lines):
            text_w = draw.textlength(line, font=font)
            tx = (w - text_w) / 2
            ty = h - card_h - 20 + idx * line_height
            draw.text((tx, ty), line, fill=(255, 255, 255, 255), font=font)
            
        img.save(img_path)
    except Exception as e:
        print(f"Error overlaying text on image: {e}")
