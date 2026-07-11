import os
import json
from typing import List, Optional, Dict, Any
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

from app.config import CLIENT_SECRETS_FILE, TOKEN_FILE, YOUTUBE_CATEGORIES

# YouTube API Scopes required for analytics and uploading
SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl"
]

class YouTubeService:
    def __init__(self):
        self.credentials = self.load_credentials()
        self.code_verifier = None

    def load_credentials(self) -> Optional[Credentials]:
        """Loads saved OAuth2 credentials from token.json."""
        if not TOKEN_FILE.exists():
            return None
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
                self.save_credentials(creds)
            return creds
        except Exception as e:
            print(f"Error loading credentials: {e}")
            return None

    def save_credentials(self, credentials: Credentials) -> None:
        """Saves OAuth2 credentials to token.json."""
        with open(TOKEN_FILE, "w") as f:
            f.write(credentials.to_json())
        self.credentials = credentials

    def is_authenticated(self) -> bool:
        """Returns True if user has valid authenticated credentials."""
        self.credentials = self.load_credentials()
        return self.credentials is not None

    def get_auth_url(self, success_redirect_uri: str) -> str:
        """Generates the authorization URL for Google OAuth2."""
        if not CLIENT_SECRETS_FILE.exists():
            raise FileNotFoundError(
                "client_secrets.json is missing! Please download it from Google Cloud Console "
                "and save it in the backend directory."
            )
        
        flow = Flow.from_client_secrets_file(
            str(CLIENT_SECRETS_FILE),
            scopes=SCOPES,
            redirect_uri=success_redirect_uri
        )
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent"
        )
        # Store code_verifier in memory for stateless verification during callback
        self.code_verifier = flow.code_verifier
        return auth_url

    def fetch_token_from_code(self, code: str, success_redirect_uri: str) -> None:
        """Exchanges authorization code for an OAuth2 token."""
        flow = Flow.from_client_secrets_file(
            str(CLIENT_SECRETS_FILE),
            scopes=SCOPES,
            redirect_uri=success_redirect_uri
        )
        # Pass the stored code verifier to exchange for tokens
        flow.fetch_token(code=code, code_verifier=self.code_verifier)
        self.save_credentials(flow.credentials)

    def get_client(self):
        """Returns an authenticated YouTube Data API client."""
        if not self.is_authenticated():
            raise PermissionError("YouTube client is not authenticated. Please run OAuth flow.")
        return build("youtube", "v3", credentials=self.credentials)

    def get_channel_stats(self) -> Dict[str, Any]:
        """Fetches current channel statistics and past Shorts performance."""
        try:
            youtube = self.get_client()

            # 1. Get channel basic info
            channels_response = youtube.channels().list(
                part="snippet,statistics,contentDetails",
                mine=True
            ).execute()

            if not channels_response.get("items"):
                return {"error": "No channel found."}

            channel_item = channels_response["items"][0]
            channel_id = channel_item["id"]
            title = channel_item["snippet"]["title"]
            custom_url = channel_item["snippet"].get("customUrl", "")
            thumbnail = channel_item["snippet"]["thumbnails"]["default"]["url"]
            stats = channel_item["statistics"]

            subscribers = int(stats.get("subscriberCount", 0))
            views = int(stats.get("viewCount", 0))
            video_count = int(stats.get("videoCount", 0))

            # 2. Fetch recent videos to extract Shorts
            # Find the uploads playlist ID
            uploads_playlist_id = channel_item["contentDetails"]["relatedPlaylists"]["uploads"]

            playlist_items_response = youtube.playlistItems().list(
                part="snippet,contentDetails",
                playlistId=uploads_playlist_id,
                maxResults=20
            ).execute()

            video_ids = [
                item["contentDetails"]["videoId"]
                for item in playlist_items_response.get("items", [])
            ]

            shorts = []
            if video_ids:
                # Get full video details (durations and stats)
                videos_response = youtube.videos().list(
                    part="snippet,statistics,contentDetails",
                    id=",".join(video_ids)
                ).execute()

                categories_map = YOUTUBE_CATEGORIES.copy()
                try:
                    categories_res = youtube.videoCategories().list(
                        part="snippet",
                        regionCode="US"
                    ).execute()
                    for cat in categories_res.get("items", []):
                        categories_map[cat["id"]] = cat["snippet"]["title"]
                except Exception as e:
                    print(f"Error fetching YouTube categories dynamically: {e}")

                for item in videos_response.get("items", []):
                    # We classify a video as a Short if it is less than 65 seconds
                    # Duration format is ISO 8601 (e.g., PT23S, PT1M5S)
                    duration_str = item["contentDetails"]["duration"]
                    
                    # Basic parser for duration
                    seconds = 0
                    if "M" in duration_str:
                        parts = duration_str.split("M")
                        minutes = int(parts[0].replace("PT", ""))
                        seconds += minutes * 60
                        if "S" in parts[1]:
                            seconds += int(parts[1].replace("S", ""))
                    elif "S" in duration_str:
                        seconds += int(duration_str.replace("PT", "").replace("S", ""))

                    # Add video to list if it fits the Shorts criteria
                    if seconds <= 65:
                        cat_id = item["snippet"].get("categoryId", "24")
                        shorts.append({
                            "id": item["id"],
                            "title": item["snippet"]["title"],
                            "description": item["snippet"]["description"],
                            "publishedAt": item["snippet"]["publishedAt"],
                            "views": int(item["statistics"].get("viewCount", 0)),
                            "likes": int(item["statistics"].get("likeCount", 0)),
                            "comments": int(item["statistics"].get("commentCount", 0)),
                            "duration": seconds,
                            "tags": item["snippet"].get("tags", []),
                            "category_id": cat_id,
                            "category_name": categories_map.get(cat_id, "Entertainment")
                        })

            return {
                "channel_id": channel_id,
                "title": title,
                "custom_url": custom_url,
                "thumbnail": thumbnail,
                "subscribers": subscribers,
                "views": views,
                "video_count": video_count,
                "recent_shorts": shorts[:10]  # Return top 10 recent shorts
            }

        except Exception as e:
            return {"error": f"Failed to fetch channel statistics: {str(e)}"}

    def search_public_shorts(self, keyword: str) -> List[Dict[str, Any]]:
        """Scrapes public YouTube search results for Shorts without needing OAuth."""
        import requests
        import re
        import json
        import urllib.parse
        
        url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(keyword)}+shorts"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        }
        
        try:
            r = requests.get(url, headers=headers, timeout=10)
            if r.status_code != 200:
                return []
                
            # Search for ytInitialData JSON
            match = re.search(r"ytInitialData\s*=\s*({.*?});", r.text)
            if not match:
                match = re.search(r"var ytInitialData\s*=\s*({.*?});", r.text)
                
            if not match:
                return []
                
            data = json.loads(match.group(1))
            videos = []
            
            # Helper to recursively find videoRenderer items
            def find_videos(obj):
                if isinstance(obj, dict):
                    if "videoRenderer" in obj:
                        vr = obj["videoRenderer"]
                        video_id = vr.get("videoId", "")
                        title = vr.get("title", {}).get("runs", [{}])[0].get("text", "")
                        
                        views_text = vr.get("viewCountText", {}).get("simpleText", "0 views")
                        views = 0
                        digits = re.sub(r'[^\d]', '', views_text)
                        if digits:
                            views = int(digits)
                            
                        desc = ""
                        desc_runs = vr.get("detailedMetadataSnippets", [{}])[0].get("snippetText", {}).get("runs", [])
                        if desc_runs:
                            desc = "".join([run.get("text", "") for run in desc_runs])
                        else:
                            desc = "".join([run.get("text", "") for run in vr.get("descriptionSnippet", {}).get("runs", [])])
                            
                        # Format publishedTimeText
                        pub_time = "Recent"
                        if "publishedTimeText" in vr:
                            pub_time = vr["publishedTimeText"].get("simpleText", "Recent")
                            
                        videos.append({
                            "id": video_id,
                            "title": title,
                            "views": views,
                            "likes": int(views * 0.04), # Estimate likes
                            "comments": int(views * 0.002), # Estimate comments
                            "publishedAt": pub_time,
                            "description": desc,
                            "tags": [keyword]
                        })
                    else:
                        for k, v in obj.items():
                            find_videos(v)
                elif isinstance(obj, list):
                    for item in obj:
                        find_videos(item)
                        
            find_videos(data)
            return videos[:10]
            
        except Exception as e:
            print(f"Error scraping public search: {e}")
            return []

    def search_competitor_shorts(self, keyword: str) -> List[Dict[str, Any]]:
        """
        Searches YouTube for top competitor Shorts matching the keyword.
        Fetches statistics for analysis. Falls back to public scraper if not authenticated.
        """
        if not self.is_authenticated():
            print("OAuth not active. Falling back to public search scraper...")
            return self.search_public_shorts(keyword)

        try:
            youtube = self.get_client()

            # Search for videos with keyword, filtering for short videos (less than 4 min)
            search_response = youtube.search().list(
                part="snippet",
                q=f"{keyword} shorts",
                type="video",
                videoDuration="short",  # Less than 4 minutes
                maxResults=10,
                order="viewCount"  # Get high performing ones
            ).execute()

            video_ids = [
                item["id"]["videoId"]
                for item in search_response.get("items", [])
                if item["id"].get("videoId")
            ]

            competitors = []
            if video_ids:
                videos_response = youtube.videos().list(
                    part="snippet,statistics,contentDetails",
                    id=",".join(video_ids)
                ).execute()

                for item in videos_response.get("items", []):
                    competitors.append({
                        "id": item["id"],
                        "title": item["snippet"]["title"],
                        "description": item["snippet"]["description"],
                        "publishedAt": item["snippet"]["publishedAt"],
                        "views": int(item["statistics"].get("viewCount", 0)),
                        "likes": int(item["statistics"].get("likeCount", 0)),
                        "comments": int(item["statistics"].get("commentCount", 0)),
                        "tags": item["snippet"].get("tags", [])
                    })
            return competitors

        except Exception as e:
            print(f"Competitor API search error: {e}. Falling back to scraper...")
            return self.search_public_shorts(keyword)

    def upload_short(
        self,
        video_path: str,
        title: str,
        description: str,
        tags: List[str],
        privacy_status: str = "public",
        category_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Uploads a video file directly to YouTube and sets tags / Shorts metadata.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        try:
            youtube = self.get_client()

            body = {
                "snippet": {
                    "title": title,
                    "description": f"{description}\n\n#shorts",
                    "tags": tags,
                    "categoryId": category_id or "22"
                },
                "status": {
                    "privacyStatus": privacy_status or "public",
                    "selfDeclaredMadeForKids": False
                }
            }

            media = MediaFileUpload(
                video_path,
                chunksize=1024 * 1024,
                resumable=True,
                mimetype="video/mp4"
            )

            request = youtube.videos().insert(
                part="snippet,status",
                body=body,
                media_body=media
            )

            response = None
            while response is None:
                status, response = request.next_chunk()
                if status:
                    print(f"Uploaded {int(status.progress() * 100)}%")

            return {
                "success": True,
                "video_id": response["id"],
                "title": response["snippet"]["title"],
                "privacy": response["status"]["privacyStatus"]
            }

        except Exception as e:
            return {"success": False, "error": f"Failed to upload video: {str(e)}"}
