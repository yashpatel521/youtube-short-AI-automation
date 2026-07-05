import os
from pathlib import Path
import numpy as np
from moviepy.video.io.VideoFileClip import VideoFileClip

# Find the latest generated video in output/
output_dir = Path("output")
video_files = list(output_dir.glob("*.mp4"))

if not video_files:
    print("No generated videos found in output/")
    sys.exit(1)

# Sort by modification time to get the latest
video_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
target_video = video_files[0]
print(f"Inspecting latest compiled video: {target_video} (Size: {target_video.stat().st_size / (1024*1024):.2f} MB)")

try:
    clip = VideoFileClip(str(target_video))
    duration = clip.duration
    fps = clip.fps
    size = clip.size
    print(f"Video Properties:")
    print(f"- Duration: {duration}s")
    print(f"- FPS: {fps}")
    print(f"- Size: {size}")
    
    # Check if frames change over time
    frame_0 = clip.get_frame(0.0)
    frame_mid = clip.get_frame(duration / 2.0)
    frame_end = clip.get_frame(duration - 0.1)
    
    diff_mid = np.abs(frame_mid.astype(int) - frame_0.astype(int))
    diff_end = np.abs(frame_end.astype(int) - frame_0.astype(int))
    
    print(f"\nFrame differences:")
    print(f"- Max diff at mid: {np.max(diff_mid)}")
    print(f"- Mean diff at mid: {np.mean(diff_mid):.2f}")
    print(f"- Max diff at end: {np.max(diff_end)}")
    print(f"- Mean diff at end: {np.mean(diff_end):.2f}")
    
    if np.max(diff_end) < 2:
        print("[CRITICAL] The video frames are virtually identical! The background is static.")
    else:
        print("[OK] The background frames are changing (animating).")

    # Search for progress bar color [255, 120, 0] or subtitle white [255, 255, 255]
    print("\nOverlay Scan:")
    has_progress_bar = False
    has_text = False
    
    # Scan frame_mid for orange progress bar pixels
    # Progress bar should be at y in [1880, 1890]
    orange_pixels = np.where(
        (frame_mid[:, :, 0] == 255) & 
        (frame_mid[:, :, 1] == 120) & 
        (frame_mid[:, :, 2] == 0)
    )
    if len(orange_pixels[0]) > 0:
        print(f"- Progress bar color [255, 120, 0] found! Count: {len(orange_pixels[0])} pixels.")
        has_progress_bar = True
    else:
        print("- [FAIL] Progress bar color [255, 120, 0] NOT found in middle frame.")

    # Scan for white pixels (subtitles) or highlight color
    # Let's count high-intensity white pixels [>245, >245, >245]
    white_pixels = np.where(
        (frame_mid[:, :, 0] > 245) & 
        (frame_mid[:, :, 1] > 245) & 
        (frame_mid[:, :, 2] > 245)
    )
    if len(white_pixels[0]) > 200:
        print(f"- Subtitle text pixels found! Count: {len(white_pixels[0])} white pixels.")
        has_text = True
    else:
        print("- [FAIL] Subtitle text pixels NOT found in middle frame.")

    clip.close()

except Exception as e:
    print("Inspection error:", e)
