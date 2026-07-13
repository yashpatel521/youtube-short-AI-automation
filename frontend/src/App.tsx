import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Generator from './pages/Generator';
import Library from './pages/Library';
import Settings from './pages/Settings';
import Ideas from './pages/Ideas';
import Quality from './pages/Quality';
import Queue from './pages/Queue';
import StoryStudio from './pages/StoryStudio';
import StoryDetail from './pages/StoryDetail';
import ChapterStoryboard from './pages/ChapterStoryboard';
import SceneEditor from './pages/SceneEditor';
import AutopostAutomation from './pages/AutopostAutomation';

import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active tab dynamically from URL pathname
  const activeTab = (() => {
    const path = location.pathname.replace('/', '');
    const validTabs = ['dashboard', 'generator', 'library', 'ideas', 'quality', 'settings', 'queue', 'story_studio', 'autopost'];
    
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
  })() as 'dashboard' | 'generator' | 'library' | 'ideas' | 'quality' | 'settings' | 'queue' | 'story_studio' | 'autopost';

  const setActiveTab = (tab: 'dashboard' | 'generator' | 'library' | 'ideas' | 'quality' | 'settings' | 'queue' | 'story_studio' | 'autopost') => {
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
            })
            .then(async res => {
              if (res.ok) {
                const data = await res.json();
                if (data.youtube_playlist_id && story.youtube_playlist_id !== data.youtube_playlist_id) {
                  setStoriesState(current => current.map(s => s.id === story.id ? { ...s, youtube_playlist_id: data.youtube_playlist_id } : s));
                }
              }
            })
            .catch(console.error);
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

  // States for tracking background posting automation jobs
  const [activePostings, setActivePostings] = useState<Record<string, string>>(() => {
    try {
      const stored = sessionStorage.getItem('active_postings');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [runningJobs, setRunningJobs] = useState<any[]>([]);
  const [showProgressWidget, setShowProgressWidget] = useState(true);
  const [postingToast, setPostingToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    sessionStorage.setItem('active_postings', JSON.stringify(activePostings));
  }, [activePostings]);

  // Polling hook to query background job status from backend
  useEffect(() => {
    const fetchRunningJobs = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/video/jobs`);
        if (res.ok) {
          const data = await res.json();
          const allJobs = data.jobs || [];
          
          // Find any jobs that are currently active in backend database
          const activeJobsOnQueue = allJobs.filter((job: any) => 
            ['queued', 'generating', 'rendering', 'pending', 'processing'].includes(job.status)
          );

          // Automatically register any active jobs that we aren't tracking yet
          if (activeJobsOnQueue.length > 0) {
            setActivePostings(prev => {
              let updated = false;
              const next = { ...prev };
              activeJobsOnQueue.forEach((job: any) => {
                if (!next[job.job_id]) {
                  next[job.job_id] = `Active Pipeline Job (${job.job_id.substring(0, 5)})`;
                  updated = true;
                }
              });
              if (updated) {
                setShowProgressWidget(true); // Auto expand on new active jobs
                return next;
              }
              return prev;
            });
          }

          // Filter jobs that match our session active listings
          const trackedJobIds = Object.keys(activePostings);
          if (trackedJobIds.length === 0) {
            setRunningJobs([]);
            return;
          }
          const matches = allJobs.filter((job: any) => trackedJobIds.includes(job.job_id));
          setRunningJobs(matches);
        }
      } catch (err) {
        console.error('Error fetching matching jobs:', err);
      }
    };

    fetchRunningJobs();
    const interval = setInterval(fetchRunningJobs, 3000);
    return () => clearInterval(interval);
  }, [backendUrl, activePostings]);

  const handleStartPosting = async (idea: any) => {
    if (!status.youtube_authenticated) {
      setPostingToast({ message: "YouTube account is not linked! Go to Settings to link your account.", type: "error" });
      setTimeout(() => setPostingToast(null), 5000);
      return;
    }

    setPostingToast({ message: `Queuing auto-generation & upload for: "${idea.title}"...`, type: "success" });
    setTimeout(() => setPostingToast(null), 5000);

    try {
      const res = await fetch(`${backendUrl}/api/video/viral-ideas/auto-generate-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_query: idea.prompt_query,
          idea_title: idea.title
        })
      });

      if (res.ok) {
        const data = await res.json();
        const jobId = data.job_id;
        setActivePostings(prev => ({
          ...prev,
          [jobId]: idea.title
        }));
        setShowProgressWidget(true);
      } else {
        const err = await res.json();
        setPostingToast({ message: err.detail || 'Failed to queue automatic publishing.', type: "error" });
        setTimeout(() => setPostingToast(null), 5000);
      }
    } catch (err: any) {
      setPostingToast({ message: err.message || 'Connection to backend failed.', type: "error" });
      setTimeout(() => setPostingToast(null), 5000);
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
              onStartPosting={handleStartPosting}
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
          <Route path="/autopost" element={
            <AutopostAutomation />
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

      {/* ━━━ Global Floating Progress Widget ━━━ */}
      {runningJobs.length > 0 && showProgressWidget && (
        <div className="fixed bottom-6 right-6 z-[999] w-80 glass-panel border border-violet-500/30 shadow-2xl p-4 bg-[#111114]/95 animate-slide-up flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-violet-300">Posting Status</span>
            </div>
            <button 
              onClick={() => setShowProgressWidget(false)}
              className="text-gray-500 hover:text-white text-xs cursor-pointer bg-transparent border-0"
            >
              Minimize
            </button>
          </div>

          <div className="flex flex-col gap-4 max-h-60 overflow-y-auto pr-1">
            {runningJobs.map((job) => {
              const title = activePostings[job.job_id] || `Job #${job.job_id.substring(0, 8)}`;
              const latestLog = job.logs && job.logs.length > 0 ? job.logs[job.logs.length - 1] : 'Queueing job...';
              const isFinished = ['completed', 'failed'].includes(job.status);
              
              return (
                <div key={job.job_id} className="flex flex-col gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-bold text-gray-200 line-clamp-1 flex-1">{title}</span>
                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                      job.status === 'completed' ? 'text-emerald-400 bg-emerald-500/10' :
                      job.status === 'failed' ? 'text-red-400 bg-red-500/10' :
                      'text-violet-400 bg-violet-500/10 animate-pulse'
                    }`}>
                      {job.status}
                    </span>
                  </div>

                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        job.status === 'failed' ? 'bg-red-500' : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'
                      }`}
                      style={{ width: `${job.progress || 0}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-gray-500 truncate max-w-[200px]" title={latestLog}>{latestLog}</span>
                    <span className="text-violet-400 font-bold font-mono">{job.progress || 0}%</span>
                  </div>

                  {isFinished && (
                    <button
                      onClick={() => {
                        setActivePostings(prev => {
                          const next = { ...prev };
                          delete next[job.job_id];
                          return next;
                        });
                      }}
                      className="text-[9px] font-bold text-gray-400 hover:text-white mt-1 border border-white/5 hover:border-white/10 rounded py-1 text-center transition-all cursor-pointer bg-transparent"
                    >
                      Clear Progress
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ━━━ Global Floating Minimized Tab ━━━ */}
      {runningJobs.length > 0 && !showProgressWidget && (
        <button 
          onClick={() => setShowProgressWidget(true)}
          className="fixed bottom-6 right-6 z-[999] glass-panel border border-violet-500/30 px-4 py-2.5 rounded-xl bg-violet-950/20 hover:bg-violet-950/40 text-violet-300 text-xs font-bold flex items-center gap-2 shadow-2xl transition-all hover:scale-105 cursor-pointer animate-float"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
          </span>
          Posting progress ({runningJobs.filter(j => !['completed', 'failed'].includes(j.status)).length} active)
        </button>
      )}

      {/* ━━━ Global Posting Toast ━━━ */}
      {postingToast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl border text-sm max-w-sm animate-slide-in ${
          postingToast.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300' 
            : 'bg-red-950/90 border-red-500/30 text-red-300'
        }`}>
          {postingToast.message}
        </div>
      )}
    </div>
  );
}
