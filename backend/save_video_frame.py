import os
import sys
from pathlib import Path
from PIL import Image
from moviepy.video.io.VideoFileClip import VideoFileClip

# Find the latest generated video in output/
output_dir = Path("output")
video_files = list(output_dir.glob("*.mp4"))

if not video_files:
    print("No generated videos found in output/")
    sys.exit(1)

video_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
target_video = video_files[0]
print(f"Latest compiled video: {target_video}")

try:
    clip = VideoFileClip(str(target_video))
    duration = clip.duration
    
    # Get middle frame
    frame = clip.get_frame(duration / 2.0)
    
    # Save as PNG
    img = Image.fromarray(frame)
    output_path = Path("C:/Users/Admin/.gemini/antigravity-ide/brain/a52d1300-18ac-49f4-8ce4-9e624876dde9/scratch/frame_mid.png")
    img.save(output_path, "PNG")
    print(f"Saved middle frame to: {output_path}")
    
    clip.close()

except Exception as e:
    print("Error saving frame:", e)
