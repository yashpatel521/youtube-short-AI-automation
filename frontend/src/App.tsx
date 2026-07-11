import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Generator from './pages/Generator';
import Library from './pages/Library';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Ideas from './pages/Ideas';
import Quality from './pages/Quality';
import Queue from './pages/Queue';
import StoryStudio from './pages/StoryStudio';
import StoryDetail from './pages/StoryDetail';
import ChapterStoryboard from './pages/ChapterStoryboard';
import SceneEditor from './pages/SceneEditor';

import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active tab dynamically from URL pathname
  const activeTab = (() => {
    const path = location.pathname.replace('/', '');
    const validTabs = ['dashboard', 'generator', 'library', 'analytics', 'ideas', 'quality', 'settings', 'queue', 'story_studio'];
    
    // Auto-route to settings page if auth query parameters are present (from YouTube OAuth redirect)
    const params = new URLSearchParams(location.search);
    if (params.has('auth')) {
      return 'settings';
    }
    if (validTabs.includes(path)) {
      return path as any;
    }
    // Story-related sub-routes should highlight Story Studio
    if (location.pathname.startsWith('/story')) {
      return 'story_studio';
    }
    return 'dashboard';
  })() as 'dashboard' | 'generator' | 'library' | 'analytics' | 'ideas' | 'quality' | 'settings' | 'queue' | 'story_studio';

  const setActiveTab = (tab: 'dashboard' | 'generator' | 'library' | 'analytics' | 'ideas' | 'quality' | 'settings' | 'queue' | 'story_studio') => {
    navigate(`/${tab}`);
  };

  const [backendUrl] = useState<string>('http://localhost:8000');
  const [stories, setStoriesState] = useState<any[]>([]);

  // Fetch stories on mount from SQLite database
  useEffect(() => {
    const fetchStories = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/stories`);
        if (res.ok) {
          const data = await res.json();
          setStoriesState(data.stories || []);
        }
      } catch (err) {
        console.error('Failed to fetch stories from database:', err);
      }
    };
    fetchStories();
  }, [backendUrl]);

  // Transparent wrapper to sync updates/deletions with SQLite database
  const setStories = (value: React.SetStateAction<any[]>) => {
    setStoriesState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      
      // Sync deletions
      if (next.length < prev.length) {
        const nextIds = new Set(next.map(s => s.id));
        prev.forEach(story => {
          if (!nextIds.has(story.id)) {
            fetch(`${backendUrl}/api/stories/${story.id}`, { method: 'DELETE' }).catch(console.error);
          }
        });
      } else {
        // Sync insertions/updates
        next.forEach(story => {
          const prevStory = prev.find(p => p.id === story.id);
          if (!prevStory || JSON.stringify(prevStory) !== JSON.stringify(story)) {
            fetch(`${backendUrl}/api/stories`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(story)
            }).catch(console.error);
          }
        });
      }
      return next;
    });
  };

  const [status, setStatus] = useState<{
    status: string;
    youtube_authenticated: boolean;
    client_secrets_configured: boolean;
  }>({
    status: 'checking',
    youtube_authenticated: false,
    client_secrets_configured: false
  });

  const [channelData, setChannelData] = useState<any>(null);
  const [channelLoading, setChannelLoading] = useState<boolean>(false);
  const [settings, setSettings] = useState<{
    gemini_api_key_configured: boolean;
    pexels_api_key_configured: boolean;
    replicate_api_token_configured: boolean;
    youtube_client_secrets_configured: boolean;
    client_id: string;
  }>({
    gemini_api_key_configured: false,
    pexels_api_key_configured: false,
    replicate_api_token_configured: false,
    youtube_client_secrets_configured: false,
    client_id: ''
  });

  // Fetch status and settings on load
  const fetchStatusAndSettings = async () => {
    try {
      const resStatus = await fetch(`${backendUrl}/api/status`);
      const dataStatus = await resStatus.json();
      setStatus(dataStatus);

      const resSettings = await fetch(`${backendUrl}/api/settings`);
      const dataSettings = await resSettings.json();
      setSettings(dataSettings);

      if (dataStatus.youtube_authenticated) {
        fetchChannelData();
      }
    } catch (err) {
      console.error('Error fetching backend status:', err);
    }
  };

  const fetchChannelData = async () => {
    setChannelLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/youtube/channel`);
      if (res.ok) {
        const data = await res.json();
        setChannelData(data);
      } else {
        console.error('Failed to fetch channel data');
      }
    } catch (err) {
      console.error('Error fetching channel data:', err);
    } finally {
      setChannelLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndSettings();
    // Poll status occasionally
    const interval = setInterval(fetchStatusAndSettings, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-shell">
      {/* Fixed Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        status={status}
        channelName={channelData?.title}
        channelThumbnail={channelData?.thumbnail}
      />

      {/* Main Column: Header + Scrollable Content */}
      <div className="main-column">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={
            <Dashboard 
              channelData={channelData} 
              loading={channelLoading} 
              onRefresh={fetchChannelData}
              onNavigate={setActiveTab}
              youtubeAuthenticated={status.youtube_authenticated}
              onLoadDemo={setChannelData}
              backendUrl={backendUrl}
            />
          } />
          <Route path="/generator" element={
            <Generator 
              backendUrl={backendUrl} 
              channelData={channelData}
              settings={settings}
            />
          } />
          <Route path="/library" element={
            <Library 
              backendUrl={backendUrl}
              youtubeAuthenticated={status.youtube_authenticated}
              onNavigate={setActiveTab}
            />
          } />
          <Route path="/analytics" element={
            <Analytics 
              backendUrl={backendUrl}
              youtubeAuthenticated={status.youtube_authenticated}
              onNavigate={setActiveTab}
            />
          } />
          <Route path="/ideas" element={
            <Ideas 
              backendUrl={backendUrl} 
              channelData={channelData}
              onNavigate={setActiveTab}
            />
          } />
          <Route path="/quality" element={
            <Quality 
              backendUrl={backendUrl} 
            />
          } />
          <Route path="/settings" element={
            <Settings 
              backendUrl={backendUrl} 
              settings={settings} 
              status={status}
              onUpdate={fetchStatusAndSettings}
            />
          } />
          <Route path="/queue" element={
            <Queue 
              backendUrl={backendUrl} 
            />
          } />
          <Route path="/story_studio" element={
            <StoryStudio 
              backendUrl={backendUrl}
              stories={stories}
              setStories={setStories}
            />
          } />
          <Route path="/story/:storyId" element={
            <StoryDetail 
              backendUrl={backendUrl} 
              stories={stories}
              setStories={setStories}
            />
          } />
          <Route path="/story/:storyId/:chapterIdx" element={
            <ChapterStoryboard 
              backendUrl={backendUrl}
              stories={stories}
              setStories={setStories}
            />
          } />
          <Route path="/story/:storyId/:chapterIdx/:sceneIdx" element={
            <SceneEditor 
              backendUrl={backendUrl}
              stories={stories}
              setStories={setStories}
            />
          } />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}
