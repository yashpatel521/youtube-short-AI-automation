from typing import List, Dict, Any
import edge_tts
from app.config import TEMP_DIR

async def synthesize_speech_async(text: str, voice: str = "en-US-GuyNeural", temp_prefix: str = "") -> List[Dict[str, Any]]:
    """
    Synthesizes text into speech and extracts word-level boundary timestamps.
    Handles empty text, voice fallbacks, and edge-tts error recovery cleanly.
    """
    clean_text = (text or "").strip()
    if not clean_text:
        clean_text = "Check out this hilarious viral moment! You won't believe what happens next."
        
    safe_voice = voice if voice and isinstance(voice, str) and len(voice) > 3 else "en-US-GuyNeural"
    suffix = f"_{temp_prefix}" if temp_prefix else ""
    audio_path = TEMP_DIR / f"voiceover{suffix}.mp3"
    
    words_data = []

    async def _try_synthesize(v: str) -> bool:
        nonlocal words_data
        words_data = []
        try:
            communicate = edge_tts.Communicate(clean_text, v, boundary="WordBoundary")
            with open(audio_path, "wb") as f:
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        f.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        start_sec = chunk["offset"] / 10000000.0
                        duration_sec = chunk["duration"] / 10000000.0
                        words_data.append({
                            "word": chunk["text"],
                            "start": start_sec,
                            "end": start_sec + duration_sec
                        })
            return audio_path.exists() and audio_path.stat().st_size > 0
        except Exception as err:
            print(f"Edge-TTS synthesis error with voice '{v}': {err}")
            return False

    # Attempt synthesis with requested voice
    success = await _try_synthesize(safe_voice)
    
    # Fallback to standard robust voice if requested voice failed or received no audio
    if not success and safe_voice != "en-US-GuyNeural":
        print(f"Retrying speech synthesis with fallback voice 'en-US-GuyNeural'...")
        success = await _try_synthesize("en-US-GuyNeural")

    # If still no word boundary timestamps were yielded, generate synthetic word timings
    if not words_data and audio_path.exists():
        import moviepy.editor as mp
        try:
            from moviepy.audio.io.AudioFileClip import AudioFileClip
            ac = AudioFileClip(str(audio_path))
            total_dur = ac.duration
            ac.close()
        except Exception:
            total_dur = 15.0
            
        raw_words = clean_text.split()
        if raw_words:
            step = total_dur / len(raw_words)
            for idx, w in enumerate(raw_words):
                words_data.append({
                    "word": w,
                    "start": idx * step,
                    "end": (idx + 1) * step
                })

    return words_data
