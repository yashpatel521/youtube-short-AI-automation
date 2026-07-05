import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Generator from './pages/Generator';
import Library from './pages/Library';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Ideas from './pages/Ideas';
import Quality from './pages/Quality';

import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active tab dynamically from URL pathname
  const activeTab = (() => {
    const path = location.pathname.replace('/', '');
    const validTabs = ['dashboard', 'generator', 'library', 'analytics', 'ideas', 'quality', 'settings'];
    
    // Auto-route to settings page if auth query parameters are present (from YouTube OAuth redirect)
    const params = new URLSearchParams(location.search);
    if (params.has('auth')) {
      return 'settings';
    }
    if (validTabs.includes(path)) {
      return path as any;
    }
    return 'dashboard';
  })() as 'dashboard' | 'generator' | 'library' | 'analytics' | 'ideas' | 'quality' | 'settings';

  const setActiveTab = (tab: 'dashboard' | 'generator' | 'library' | 'analytics' | 'ideas' | 'quality' | 'settings') => {
    navigate(`/${tab}`);
  };

  const [backendUrl] = useState<string>('http://localhost:8000');
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
    youtube_client_secrets_configured: boolean;
    client_id: string;
  }>({
    gemini_api_key_configured: false,
    pexels_api_key_configured: false,
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
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} status={status} channelName={channelData?.title} channelThumbnail={channelData?.thumbnail} />

      {/* Main Pages Router */}
      <main className="main-content">
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
              channelData={channelData}
            />
          } />
          <Route path="/analytics" element={
            <Analytics 
              backendUrl={backendUrl}
              youtubeAuthenticated={status.youtube_authenticated}
              channelData={channelData}
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
              channelData={channelData}
            />
          } />
          <Route path="/settings" element={
            <Settings 
              backendUrl={backendUrl} 
              settings={settings} 
              status={status}
              onUpdate={fetchStatusAndSettings}
              channelData={channelData}
            />
          } />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
