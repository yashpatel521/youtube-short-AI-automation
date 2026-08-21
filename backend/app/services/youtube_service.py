import os
import json
from typing import List, Optional, Dict, Any
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

from app.config import CLIENT_SECRETS_FILE, TOKEN_FILE, YOUTUBE_CATEGORIES, TEMP_DIR

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
                    part="snippet,statistics,contentDetails,status",
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
                        status_info = item.get("status", {})
                        content_details = item.get("contentDetails", {})
                        region_restriction = content_details.get("regionRestriction", {})
                        is_restricted = "blocked" in region_restriction or "allowed" in region_restriction
                        
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
                            "category_name": categories_map.get(cat_id, "Entertainment"),
                            "upload_status": status_info.get("uploadStatus"),
                            "rejection_reason": status_info.get("rejectionReason"),
                            "region_restricted": is_restricted,
                            "licensed_content": content_details.get("licensedContent", False)
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
        category_id: Optional[str] = None,
        playlist_id: Optional[str] = None
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

            video_id = response["id"]

            # Auto-detect playlist ID from database if story name is present in filename
            if not playlist_id and video_path:
                try:
                    normalized_path = str(video_path).replace("\\", "/")
                    if "story_" in normalized_path:
                        parts = normalized_path.split("/")
                        story_part = next((p for p in parts if p.startswith("story_")), None)
                        if story_part:
                            story_id = story_part.replace("story_", "")
                            from app.services.db_service import DBService
                            db_svc = DBService()
                            stories = db_svc.get_stories()
                            story = next((s for s in stories if s["id"] == story_id), None)
                            if story and story.get("youtube_playlist_id"):
                                playlist_id = story["youtube_playlist_id"]
                                print(f"[YouTube Playlist] Auto-detected playlist ID: {playlist_id}")
                except Exception as auto_err:
                    print(f"[YouTube Playlist] Auto-detect failed: {auto_err}")

            # Add to playlist if playlist ID is present
            if playlist_id:
                try:
                    self.add_video_to_playlist(playlist_id, video_id)
                    print(f"[YouTube Playlist] Added video {video_id} to playlist {playlist_id}")
                except Exception as pl_err:
                    print(f"[YouTube Playlist] Failed to add video to playlist: {pl_err}")

            # Auto-detect thumbnail path from first scene's image
            thumbnail_path = None
            if video_path:
                try:
                    normalized_path = str(video_path).replace("\\", "/")
                    if "story_" in normalized_path:
                        parts = normalized_path.split("/")
                        story_part = next((p for p in parts if p.startswith("story_")), None)
                        if story_part:
                            story_id = story_part.replace("story_", "")
                            chapter_part = next((p for p in parts if p.startswith("chapter_")), None)
                            if chapter_part:
                                chapter_idx = int(chapter_part.replace("chapter_", ""))
                                from app.services.db_service import DBService
                                db_svc = DBService()
                                stories = db_svc.get_stories()
                                story = next((s for s in stories if s["id"] == story_id), None)
                                if story and chapter_idx < len(story["chapters"]):
                                    chapter = story["chapters"][chapter_idx]
                                    first_scene = next((s for s in chapter.get("scenes", []) if s.get("image_url")), None)
                                    if first_scene:
                                        candidate_path = TEMP_DIR / first_scene["image_url"]
                                        if candidate_path.exists():
                                            thumbnail_path = str(candidate_path)
                                            print(f"[YouTube Thumbnail] Auto-detected thumbnail: {thumbnail_path}")
                except Exception as thumb_err:
                    print(f"[YouTube Thumbnail] Auto-detect failed: {thumb_err}")

            # Upload thumbnail if found
            if thumbnail_path:
                try:
                    self.upload_thumbnail(video_id, thumbnail_path)
                except Exception as thumb_up_err:
                    print(f"[YouTube Thumbnail] Upload failed: {thumb_up_err}")

            return {
                "success": True,
                "video_id": video_id,
                "title": response["snippet"]["title"],
                "privacy": response["status"]["privacyStatus"]
            }

        except Exception as e:
            return {"success": False, "error": f"Failed to upload video: {str(e)}"}

    def create_playlist(self, title: str, description: str = "") -> Optional[str]:
        """Creates a new YouTube playlist using the story title, returns the Playlist ID."""
        try:
            youtube = self.get_client()
            body = {
                "snippet": {
                    "title": title,
                    "description": description,
                    "tags": ["story", "shorts", "ai"],
                    "defaultLanguage": "en"
                },
                "status": {
                    "privacyStatus": "public"
                }
            }
            request = youtube.playlists().insert(
                part="snippet,status",
                body=body
            )
            response = request.execute()
            return response.get("id")
        except Exception as e:
            print(f"Error creating YouTube playlist: {e}")
            return None

    def add_video_to_playlist(self, playlist_id: str, video_id: str) -> bool:
        """Adds a video ID to the specified playlist ID."""
        try:
            youtube = self.get_client()
            body = {
                "snippet": {
                    "playlistId": playlist_id,
                    "resourceId": {
                       "kind": "youtube#video",
                       "videoId": video_id
                    }
                }
            }
            request = youtube.playlistItems().insert(
                part="snippet",
                body=body
            )
            request.execute()
            return True
        except Exception as e:
            print(f"Error adding video to playlist: {e}")
            return False

    def upload_thumbnail(self, video_id: str, thumbnail_path: str) -> bool:
        """Uploads a custom thumbnail image file for the specified video ID."""
        if not os.path.exists(thumbnail_path):
            print(f"[YouTube Thumbnail] File not found: {thumbnail_path}")
            return False
        try:
            youtube = self.get_client()
            media = MediaFileUpload(
                thumbnail_path,
                mimetype="image/png" if thumbnail_path.endswith(".png") else "image/jpeg"
            )
            request = youtube.thumbnails().set(
                videoId=video_id,
                media_body=media
            )
            request.execute()
            print(f"[YouTube Thumbnail] Successfully uploaded thumbnail for video {video_id}")
            return True
        except Exception as e:
            print(f"[YouTube Thumbnail] Failed to upload thumbnail: {e}")
            return False

    def fetch_channel_comments(self, max_results: int = 50) -> List[Dict[str, Any]]:
        """Fetches top-level comments across channel videos via YouTube Data API v3."""
        if not self.is_authenticated():
            print("[YouTube Service] Not authenticated. Returning realistic sample comments.")
            return self._get_sample_comments()

        try:
            youtube = self.get_client()
            channels_res = youtube.channels().list(mine=True, part="id").execute()
            if not channels_res.get("items"):
                return self._get_sample_comments()
            
            channel_id = channels_res["items"][0]["id"]

            response = youtube.commentThreads().list(
                part="snippet,replies",
                allThreadsRelatedToChannelId=channel_id,
                maxResults=max_results,
                textFormat="plainText"
            ).execute()

            items = response.get("items", [])
            comments = []
            video_ids = list(set([item["snippet"]["videoId"] for item in items if "snippet" in item and "videoId" in item["snippet"]]))
            
            video_titles = {}
            if video_ids:
                try:
                    v_res = youtube.videos().list(
                        part="snippet",
                        id=",".join(video_ids[:50])
                    ).execute()
                    for v in v_res.get("items", []):
                        video_titles[v["id"]] = v["snippet"]["title"]
                except Exception as e:
                    print(f"Error fetching video titles for comments: {e}")

            for item in items:
                top = item["snippet"]["topLevelComment"]["snippet"]
                cid = item["snippet"]["topLevelComment"]["id"]
                vid = item["snippet"]["videoId"]
                
                # Check if channel owner already replied in thread
                replies = item.get("replies", {}).get("comments", [])
                has_owner_reply = any(
                    r["snippet"].get("authorChannelId", {}).get("value") == channel_id
                    for r in replies
                )

                comments.append({
                    "comment_id": cid,
                    "video_id": vid,
                    "video_title": video_titles.get(vid, "YouTube Short"),
                    "author_name": top.get("authorDisplayName", "Anonymous"),
                    "author_profile_image": top.get("authorProfileImageUrl", ""),
                    "comment_text": top.get("textDisplay", ""),
                    "published_at": top.get("publishedAt", ""),
                    "like_count": int(top.get("likeCount", 0)),
                    "total_reply_count": int(item["snippet"].get("totalReplyCount", 0)),
                    "has_owner_reply": has_owner_reply
                })

            return comments if comments else self._get_sample_comments()
        except Exception as e:
            print(f"[YouTube Service] Error fetching comments from API: {e}. Falling back to sample comments.")
            return self._get_sample_comments()

    def post_comment_reply(self, comment_id: str, reply_text: str) -> Dict[str, Any]:
        """Posts a reply to a top-level comment using YouTube Data API v3."""
        if not self.is_authenticated() or comment_id.startswith("mock_"):
            print(f"[YouTube Service] Mock replying to comment {comment_id}: '{reply_text}'")
            return {"success": True, "reply_id": f"reply_mock_{comment_id}"}

        try:
            youtube = self.get_client()
            response = youtube.comments().insert(
                part="snippet",
                body={
                    "snippet": {
                        "parentId": comment_id,
                        "textOriginal": reply_text
                    }
                }
            ).execute()
            return {"success": True, "reply_id": response.get("id")}
        except Exception as e:
            print(f"[YouTube Service] Error posting comment reply: {e}")
            return {"success": False, "error": str(e)}

    def _get_sample_comments(self) -> List[Dict[str, Any]]:
        """Returns realistic sample comments for testing and offline demo mode."""
        return [
            {
                "comment_id": "mock_comment_101",
                "video_id": "short_dark_history_1",
                "video_title": "5 Creepy Dark History Facts You Never Learned in School 🤫",
                "author_name": "Alex Carter",
                "author_profile_image": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80",
                "comment_text": "Bro part 2 when??? This history fact at the end blew my mind! 🔥",
                "published_at": "2026-08-19T10:15:00Z",
                "like_count": 42,
                "total_reply_count": 0,
                "has_owner_reply": False
            },
            {
                "comment_id": "mock_comment_102",
                "video_id": "short_psychology_2",
                "video_title": "Dark Psychology Hack to Know if Someone is Lying 🧠",
                "author_name": "Sarah Miller",
                "author_profile_image": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80",
                "comment_text": "how to make videos like this? What AI program do you use?",
                "published_at": "2026-08-19T09:30:00Z",
                "like_count": 19,
                "total_reply_count": 0,
                "has_owner_reply": False
            },
            {
                "comment_id": "mock_comment_103",
                "video_id": "short_would_you_rather_3",
                "video_title": "Would You Rather: Infinite Wealth or 100 Years in Space? 🚀",
                "author_name": "David Chen",
                "author_profile_image": "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=80&q=80",
                "comment_text": "Definitely Option A! Infinite wealth lets me build my own spaceship anyway 😂",
                "published_at": "2026-08-19T08:45:00Z",
                "like_count": 88,
                "total_reply_count": 0,
                "has_owner_reply": False
            },
            {
                "comment_id": "mock_comment_104",
                "video_id": "short_reddit_twist_4",
                "video_title": "My Roommate Kept Leaving Notes Until I Found This Under the Floorboards 😱",
                "author_name": "Elena Rostova",
                "author_profile_image": "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=80&q=80",
                "comment_text": "Subscribed! Can you make one about mysterious ocean creatures next please?",
                "published_at": "2026-08-19T07:10:00Z",
                "like_count": 15,
                "total_reply_count": 0,
                "has_owner_reply": False
            },
            {
                "comment_id": "mock_comment_105",
                "video_id": "short_sci_fi_5",
                "video_title": "What If Jupiter Suddenly Disappeared From Our Solar System? 🌌",
                "author_name": "Marcus Vance",
                "author_profile_image": "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=80&q=80",
                "comment_text": "Is this scientific fact or just hypothetical speculation? Great video overall!",
                "published_at": "2026-08-19T06:20:00Z",
                "like_count": 31,
                "total_reply_count": 0,
                "has_owner_reply": False
            }
        ]

    def delete_live_video(self, video_id: str) -> Dict[str, Any]:
        """Permanently deletes a video from the user's YouTube channel via API."""
        if not self.is_authenticated() or video_id.startswith("mock_"):
            print(f"[YouTube Service] Mock deleting live video ID: {video_id}")
            return {"success": True, "message": f"Mock deleted video {video_id}"}

        try:
            youtube = self.get_client()
            youtube.videos().delete(id=video_id).execute()
            print(f"[YouTube Service] Successfully deleted live video {video_id} from YouTube.")
            return {"success": True, "message": f"Video {video_id} permanently deleted from YouTube."}
        except Exception as e:
            print(f"[YouTube Service] Error deleting live video {video_id}: {e}")
            return {"success": False, "error": str(e)}


