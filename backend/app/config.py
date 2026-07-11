import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_DIR = BASE_DIR.parent

# Configured paths
TEMP_DIR = BASE_DIR / "temp"
OUTPUT_DIR = BASE_DIR / "output"
ASSETS_DIR = BASE_DIR / "assets"

# Ensure directories exist
TEMP_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

# API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")


# YouTube configuration
CLIENT_SECRETS_FILE = BASE_DIR / "client_secrets.json"

# Auto-detect Google credentials file with long client_secret_*.json filename
if not CLIENT_SECRETS_FILE.exists():
    for f in BASE_DIR.glob("client_secret*.json"):
        if f.name != "client_secrets.json":
            try:
                import shutil
                shutil.copy(str(f), str(CLIENT_SECRETS_FILE))
                print(f"Auto-detected and configured Google credentials file: {f.name}")
                break
            except Exception as e:
                print(f"Error copying client secret file: {e}")

TOKEN_FILE = BASE_DIR / "token.json"

# Server configuration
PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "127.0.0.1")

# YouTube Video Categories Map (Consolidated from main.py and youtube_service.py)
YOUTUBE_CATEGORIES = {
    "1": "Film & Animation",
    "2": "Autos & Vehicles",
    "10": "Music",
    "15": "Pets & Animals",
    "17": "Sports",
    "18": "Short Movies",
    "19": "Travel & Events",
    "20": "Gaming",
    "21": "Videoblogging",
    "22": "People & Blogs",
    "23": "Comedy",
    "24": "Entertainment",
    "25": "News & Politics",
    "26": "Howto & Style",
    "27": "Education",
    "28": "Science & Technology",
    "29": "Nonprofits & Activism",
    "30": "Movies",
    "31": "Anime/Animation"
}

