import os
from pathlib import Path
from typing import Optional
from app.config import TEMP_DIR

_local_pipe = None

def generate_story_image_locally(prompt: str, style: str, temp_dir: Path, temp_prefix: str = "") -> Path:
    """Generates a high-quality scene illustration locally using diffusers (Stable Diffusion Turbo)."""
    import torch
    from diffusers import AutoPipelineForText2Image
    
    global _local_pipe
    if _local_pipe is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[Local Image Gen] Loading offline model pipeline on device: {device} (first-time initialization)...")
        
        torch_dtype = torch.float16 if device == "cuda" else torch.float32
        
        pipe = AutoPipelineForText2Image.from_pretrained(
            "stabilityai/sd-turbo",
            torch_dtype=torch_dtype,
            variant="fp16" if device == "cuda" else None
        )
        pipe.to(device)
        _local_pipe = pipe
    else:
        pipe = _local_pipe
        print("[Local Image Gen] Reusing cached offline model pipeline in memory...")
    
    # Style prompts
    if style == "anime":
        styled_prompt = f"Cozy beautiful anime illustration, high resolution, detailed manga scene artwork, {prompt}"
    else: # kids_cartoon
        styled_prompt = f"Bright eye-catching kids illustration cartoon style, friendly character, vivid colors, playful drawing, {prompt}"
        
    print(f"[Local Image Gen] Running inference for prompt: '{styled_prompt}'...")
    
    image = pipe(
        prompt=styled_prompt,
        num_inference_steps=1,
        guidance_scale=0.0
    ).images[0]
    
    suffix = f"_{temp_prefix}" if temp_prefix else ""
    img_path = temp_dir / f"local_story_img{suffix}_{hash(prompt)}.png"
    image.save(img_path)
    
    print(f"[Local Image Gen] Success! Image saved to: {img_path}")
    return img_path

def generate_story_image(prompt: str, style: str, temp_dir: Path, temp_prefix: str = "") -> Optional[Path]:
    """Generates a storytelling scene image using local diffusers model."""
    try:
        return generate_story_image_locally(prompt, style, temp_dir, temp_prefix)
    except ImportError as e:
        msg = (
            "Local image generation packages ('torch' or 'diffusers') are not installed in the environment.\n"
            "To enable 100% free local image generation on your PC, please run this command in your terminal:\n\n"
            "  venv\\Scripts\\pip.exe install torch diffusers transformers accelerate\n"
        )
        print(f"[Local Image Gen ERROR] {msg}")
        raise RuntimeError(msg) from e
    except Exception as e:
        print(f"[Local Image Gen ERROR] Failed local generation: {e}")
        raise e
