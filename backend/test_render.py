import asyncio
import os
import sys
from pathlib import Path

# Add backend directory to path
sys.path.append(str(Path(__file__).resolve().parent))

from app.services.video_engine import VideoEngine

async def main():
    print("Initializing Video Generator Test Render Pipeline...")
    
    # Instantiate engine
    engine = VideoEngine()
    
    # Configure test scripts and queries
    test_script = (
        "This is a local verification test of the viral YouTube Shorts compilation engine. "
        "We are testing word boundaries, custom subtitle outlines, and progress bar animations. "
        "Everything is working perfectly."
    )
    
    print("\n--- Configurations ---")
    print(f"Test script: {test_script}")
    print("Voice: en-US-EmmaMultilingualNeural")
    print("Highlight color: #FFD700 (Yellow)")
    print("Background Visuals: Fallback Color Gradients")
    print("----------------------\n")
    
    try:
        # Run compiler pipeline
        # Pexels query is set to empty to force local gradient fallback (avoids network requests)
        output_file = await engine.compile_video(
            script_text=test_script,
            voice="en-US-EmmaMultilingualNeural",
            pexels_query="",
            highlight_color="#FFD700",
            music_path=None,
            enable_subscribe=True
        )
        
        print("\n==============================================")
        print("[SUCCESS] Video compiled successfully!")
        print(f"Output File: {output_file}")
        print(f"File Size: {output_file.stat().st_size / (1024 * 1024):.2f} MB")
        print("==============================================")
        
    except Exception as e:
        print("\n==============================================")
        print("[FAILED] Video compilation encountered a fatal error:")
        import traceback
        traceback.print_exc()
        print("==============================================")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
