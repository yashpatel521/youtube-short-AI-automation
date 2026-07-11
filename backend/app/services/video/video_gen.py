import os
import math
import requests
import numpy as np
from pathlib import Path
from typing import Optional
from PIL import Image, ImageDraw

from app.config import PEXELS_API_KEY, REPLICATE_API_TOKEN

def download_pexels_video(query: str, temp_dir: Path, temp_prefix: str = "") -> Optional[Path]:
    """Downloads a portrait stock video loop from Pexels API."""
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

        video_files = videos[0].get("video_files", [])
        selected_file = None
        
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
        video_path = temp_dir / f"pexels{suffix}_{hash(query)}.mp4"
        
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

def generate_pastel_gradient_frame(t: float, duration: float) -> np.ndarray:
    """Generates a shifting pastel color gradient frame for background loops."""
    w, h = 120, 213
    x = np.linspace(0, 1, w)
    y = np.linspace(0, 1, h)
    xv, yv = np.meshgrid(x, y)

    phase = 2 * math.pi * t / duration
    r = 0.55 + 0.45 * np.sin(xv * 3 + yv * 2 + phase)
    g = 0.55 + 0.45 * np.sin(xv * 1 - yv * 3 + phase + 2.0)
    b = 0.60 + 0.40 * np.sin(xv * 2 + yv * 4 - phase + 4.0)

    frame = np.stack([r, g, b], axis=-1) * 255
    frame = frame.astype(np.uint8)

    img = Image.fromarray(frame)
    img_resized = img.resize((1080, 1920), Image.Resampling.BILINEAR)
    return np.array(img_resized)

def generate_local_simulation_frame(t: float, duration: float, query: str) -> np.ndarray:
    """Generates dynamic abstract simulation animations locally using math and numpy."""
    query_lower = query.lower()
    w, h = 1080, 1920

    if any(k in query_lower for k in ["space", "venus", "star", "galaxy", "universe", "planet", "orbit"]):
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
            
            glow_color = (color[0] // 3, color[1] // 3, color[2] // 3)
            draw.ellipse([x - r_size * 2, y - r_size * 2, x + r_size * 2, y + r_size * 2], fill=glow_color)
            draw.ellipse([x - r_size, y - r_size, x + r_size, y + r_size], fill=color)
            
        return np.array(img)
        
    elif any(k in query_lower for k in ["animal", "nature", "forest", "ocean", "sea", "earth", "plant", "life", "water"]):
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

def generate_ai_video(prompt: str, temp_dir: Path, temp_prefix: str = "") -> Optional[Path]:
    """Generates a vertical video clip using Replicate (Wan 2.1)."""
    replicate_token = os.environ.get("REPLICATE_API_TOKEN") or REPLICATE_API_TOKEN
        
    if not replicate_token:
        print("REPLICATE_API_TOKEN not configured.")
        return None

    import replicate
    try:
        client = replicate.Client(api_token=replicate_token)
        print(f"Generating AI video with prompt: '{prompt}'...")
        
        output = client.run(
            "wavespeedai/wan-2.1-t2v-720p",
            input={
                "prompt": prompt,
                "aspect_ratio": "9:16",
                "num_frames": 81,  # ~5 seconds
                "frames_per_second": 16,
                "sample_steps": 30,
                "fast_mode": "Balanced",
                "sample_guide_scale": 5
            }
        )
        
        video_url = output
        if isinstance(output, list):
            video_url = output[0]
        elif hasattr(output, "url"):
            video_url = output.url
            
        if not video_url:
            print("Failed to get output URL from Replicate.")
            return None
            
        suffix = f"_{temp_prefix}" if temp_prefix else ""
        video_path = temp_dir / f"ai_video{suffix}_{hash(prompt)}.mp4"
        
        print(f"Downloading generated video from: {video_url}")
        with requests.get(str(video_url), stream=True, timeout=30) as r:
            r.raise_for_status()
            with open(video_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        
        return video_path
    except Exception as e:
        print(f"Error generating video on Replicate: {e}")
        return None
