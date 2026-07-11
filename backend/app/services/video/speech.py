from typing import List, Dict, Any
import edge_tts
from app.config import TEMP_DIR

async def synthesize_speech_async(text: str, voice: str = "en-US-EmmaMultilingualNeural", temp_prefix: str = "") -> List[Dict[str, Any]]:
    """
    Synthesizes text into speech and extracts word-level boundary timestamps.
    Returns list of dicts with word, start, and end times in seconds.
    """
    suffix = f"_{temp_prefix}" if temp_prefix else ""
    audio_path = TEMP_DIR / f"voiceover{suffix}.mp3"
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
