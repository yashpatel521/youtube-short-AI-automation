import React from 'react';
import Header from '../components/Header';

interface ShortVideo {
  id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  duration: number;
}

interface DashboardProps {
  channelData: any;
  loading: boolean;
  onRefresh: () => void;
  onNavigate: (tab: 'dashboard' | 'generator' | 'analytics' | 'settings') => void;
  youtubeAuthenticated: boolean;
  onLoadDemo: (data: any) => void;
  backendUrl: string;
}

export default function Dashboard({ channelData, loading, onRefresh, onNavigate, youtubeAuthenticated, onLoadDemo, backendUrl }: DashboardProps) {
  const [history, setHistory] = React.useState<any[]>([]);

  React.useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/video/history`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data.history || []);
        }
      } catch (err) {
        console.error('Error fetching history:', err);
      }
    };
    fetchHistory();
  }, [backendUrl, channelData]);
  
  const calculateEngagement = (likes: number, comments: number, views: number) => {
    if (!views) return '0.0%';
    const rate = ((likes + comments) / views) * 100;
    return `${rate.toFixed(1)}%`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Find best performing video by views
  const getBestPerformingVideo = (shorts: ShortVideo[]) => {
    if (!shorts || shorts.length === 0) return null;
    return [...shorts].sort((a, b) => b.views - a.views)[0];
  };

  const [suggestions, setSuggestions] = React.useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = React.useState(false);

  const fetchSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const storedSecrets = localStorage.getItem('settings_keys');
      let geminiKey = '';
      if (storedSecrets) {
        try {
          const parsed = JSON.parse(storedSecrets);
          geminiKey = parsed.gemini_api_key || '';
        } catch {}
      }

      // Gather competitor contexts if any stored
      let compShorts = [];
      const storedComp = sessionStorage.getItem('competitor_context');
      if (storedComp) {
        try {
          const parsed = JSON.parse(storedComp);
          compShorts = parsed.competitors || [];
        } catch {}
      }

      const res = await fetch('http://localhost:8000/api/script/suggest-ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gemini_key: geminiKey,
          previous_shorts: channelData?.recent_shorts || [],
          competitor_shorts: compShorts
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      } else {
        console.error('Failed to generate suggestions');
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleUseSuggestion = (prompt: string) => {
    sessionStorage.setItem('generator_prompt', prompt);
    onNavigate('generator');
  };

  const bestVideo = channelData?.recent_shorts ? getBestPerformingVideo(channelData.recent_shorts) : null;

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      
      {/* Page Header */}
      <Header
        title="Channel Dashboard"
        description="Welcome to your automated shorts creator panel. Review statistics and edit scripts."
        channelData={channelData}
      >
        {youtubeAuthenticated && (
          <button onClick={onRefresh} className="btn-secondary px-[18px] py-[10px]" disabled={loading}>
            <svg 
              className={loading ? 'animate-spin' : ''} 
              width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            >
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh Metrics
          </button>
        )}
      </Header>

      {/* Connection Check Banner */}
      {!youtubeAuthenticated && !channelData ? (
        <div className="glass-panel p-10 flex flex-col items-center text-center gap-4 border-dashed border-white/20">
          <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-500">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Link YouTube to Unlock Auto-Learning</h2>
            <p className="text-gray-400 max-w-[500px] mx-auto text-[0.95rem]">
              Connect your YouTube account so the system can automatically analyze your historical Shorts, inspect engagement metrics, and learn what drives views on your channel.
            </p>
          </div>
          <div className="flex gap-4 mt-2.5">
            <button onClick={() => onNavigate('settings')} className="btn-primary">
              Go to Settings & Link Account
            </button>
            <button 
              onClick={() => {
                const mockChannelData = {
                  title: "CodeCrafters Shorts (Demo)",
                  custom_url: "@codecrafters",
                  thumbnail: "https://images.pexels.com/photos/577585/pexels-photo-577585.jpeg?auto=compress&cs=tinysrgb&w=150",
                  subscribers: 24500,
                  views: 1845200,
                  video_count: 42,
                  recent_shorts: [
                    {
                      id: "mock1",
                      title: "3 Secrets Google Engineers Hide From You 🤫",
                      publishedAt: "2026-06-25T10:00:00Z",
                      views: 185200,
                      likes: 12400,
                      comments: 420,
                      duration: 24
                    },
                    {
                      id: "mock2",
                      title: "Why Senior Devs NEVER Use Else Statements",
                      publishedAt: "2026-06-20T10:00:00Z",
                      views: 94100,
                      likes: 6800,
                      comments: 210,
                      duration: 28
                    },
                    {
                      id: "mock3",
                      title: "Stop Using Python Lists! Use This Instead",
                      publishedAt: "2026-06-15T10:00:00Z",
                      views: 312000,
                      likes: 22400,
                      comments: 890,
                      duration: 21
                    },
                    {
                      id: "mock4",
                      title: "How I Code 10x Faster (Not ChatGPT)",
                      publishedAt: "2026-06-10T10:00:00Z",
                      views: 45100,
                      likes: 3100,
                      comments: 115,
                      duration: 26
                    }
                  ]
                };
                onLoadDemo(mockChannelData);
              }} 
              className="btn-secondary"
            >
              Load Demo Data (Preview Mode)
            </button>
          </div>
        </div>
      ) : loading && !channelData ? (
        <div className="flex justify-center py-24">
          <div className="glow-active text-lg text-violet-400 font-semibold">
            Fetching Channel Analytics from YouTube API...
          </div>
        </div>
      ) : (
        <>
          {/* Channel Hero Section */}
          {channelData && (
            <div className="glass-panel p-8 flex items-center justify-between flex-wrap gap-5 bg-gradient-to-br from-[#1a1a2e]/90 to-[#12121c]/70">
              <div className="flex items-center gap-5">
                <img 
                  src={channelData.thumbnail} 
                  alt={channelData.title}
                  className="w-20 h-20 rounded-full border-3 border-violet-500"
                />
                <div>
                  <h2 className="text-3xl font-extrabold">{channelData.title}</h2>
                  <p className="text-violet-400 font-semibold text-sm">
                    {channelData.custom_url || `@channel_${channelData.channel_id?.substring(0,6)}`}
                  </p>
                  <p className="text-gray-500 text-[0.85rem] mt-1">Connected Account</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <button onClick={() => onNavigate('generator')} className="btn-primary">
                  Create a Short
                </button>
                <button onClick={() => onNavigate('analytics')} className="btn-secondary">
                  Competitor Intelligence
                </button>
              </div>
            </div>
          )}

          {/* Quick Metrics Cards */}
          {channelData && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
              <div className="glass-panel p-6">
                <span className="text-[0.85rem] text-gray-400 font-semibold">TOTAL SUBSCRIBERS</span>
                <h3 className="text-4xl font-extrabold mt-2 text-violet-500">
                  {channelData.subscribers.toLocaleString()}
                </h3>
              </div>

              <div className="glass-panel p-6">
                <span className="text-[0.85rem] text-gray-400 font-semibold">TOTAL VIEWS</span>
                <h3 className="text-4xl font-extrabold mt-2 text-white">
                  {channelData.views.toLocaleString()}
                </h3>
              </div>

              <div className="glass-panel p-6">
                <span className="text-[0.85rem] text-gray-400 font-semibold">TOTAL UPLOADS</span>
                <h3 className="text-4xl font-extrabold mt-2 text-pink-500">
                  {channelData.video_count.toLocaleString()}
                </h3>
              </div>
            </div>
          )}

          {/* AI Viral Idea Suggestion Section */}
          {channelData && (
            <div className="glass-panel p-6 bg-gradient-to-br from-violet-500/5 to-pink-500/5 border border-white/10 relative overflow-hidden">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-bold mb-1.5 flex items-center gap-2">
                    <span className="text-[1.4rem]">💡</span> Suggest Next Viral Short Idea
                  </h3>
                  <p className="text-gray-400 text-sm max-w-[700px] m-0">
                    Let Gemini analyze your channel statistics, subscribers, and high-view competitor themes to design a scroll-stopping premise custom-fit for your audience.
                  </p>
                </div>
                <button 
                  onClick={fetchSuggestions} 
                  className="btn-primary py-3 px-6 font-bold" 
                  disabled={suggestionsLoading}
                >
                  {suggestionsLoading ? 'Generating Suggestions...' : 'Suggest Next Short'}
                </button>
              </div>

              {suggestions.length > 0 && (
                <div className="flex flex-col gap-4 mt-5">
                  <h4 className="text-base font-bold text-gray-400">Gemini AI Suggestions:</h4>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
                    {suggestions.map((idea: any, idx: number) => (
                      <div key={idx} className="glass-panel p-5 bg-white/[0.02] border border-white/5 flex flex-col justify-between gap-4">
                        <div>
                          <span className="bg-violet-500/15 text-[#c084fc] px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">Idea #{idx + 1}</span>
                          <h4 className="text-base font-extrabold mt-2.5 mb-2">{idea.title}</h4>
                          <p className="text-xs text-gray-400 mb-3">
                            <strong>Premise:</strong> {idea.concept}
                          </p>
                          <p className="text-xs text-gray-500 italic mb-3">
                            <strong>Hook (0-2s):</strong> "{idea.hook}"
                          </p>
                          <div className="p-2.5 bg-black/20 rounded-lg text-[0.8rem] text-emerald-300 border-l-3 border-emerald-400">
                            <strong>AI Rationale:</strong> {idea.rationale}
                          </div>
                        </div>
                        <button 
                          onClick={() => handleUseSuggestion(idea.prompt_query)} 
                          className="btn-primary w-full p-2.5 mt-2.5"
                        >
                          Write Script for This
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Best Performing and Main Stats */}
          {bestVideo && (
            <div className="glass-panel p-6 border-l-4 border-l-emerald-500 bg-emerald-500/[0.04] flex justify-between items-center flex-wrap gap-4">
              <div>
                <span className="text-[0.75rem] font-extrabold bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full tracking-wide">
                  TOP PERFORMING SHORT
                </span>
                <h4 className="text-base font-bold mt-2 mb-1">
                  {bestVideo.title}
                </h4>
                <p className="text-gray-400 text-xs">
                  Published on {formatDate(bestVideo.publishedAt)} | Duration: {bestVideo.duration}s
                </p>
              </div>
              <div className="flex gap-8 text-right">
                <div>
                  <span className="text-xs text-gray-500">VIEWS</span>
                  <div className="text-lg font-extrabold text-white">{bestVideo.views.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">ENGAGEMENT</span>
                  <div className="text-lg font-extrabold text-emerald-400">
                    {calculateEngagement(bestVideo.likes, bestVideo.comments, bestVideo.views)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Shorts Table */}
          {channelData?.recent_shorts && (
            <div className="glass-panel p-6 flex flex-col gap-5">
              <h3 className="text-lg font-bold">Recent Shorts Analytics</h3>
              
              {channelData.recent_shorts.length === 0 ? (
                <p className="text-gray-400 text-[0.95rem]">No vertical shorts found in your recent uploads.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left min-w-[600px]">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="p-3 text-gray-400 font-semibold">Title</th>
                        <th className="p-3 text-gray-400 font-semibold">Date</th>
                        <th className="p-3 text-gray-400 font-semibold">Views</th>
                        <th className="p-3 text-gray-400 font-semibold">Likes</th>
                        <th className="p-3 text-gray-400 font-semibold">Comments</th>
                        <th className="p-3 text-gray-400 font-semibold">Engagement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channelData.recent_shorts.map((video: ShortVideo) => (
                        <tr key={video.id} className="border-b border-white/[0.04]">
                          <td className="p-3.5 font-semibold text-[0.95rem] max-w-[300px] truncate">
                            {video.title}
                          </td>
                          <td className="p-3.5 text-gray-400 text-sm">
                            {formatDate(video.publishedAt)}
                          </td>
                          <td className="p-3.5 font-bold text-[0.95rem]">
                            {video.views.toLocaleString()}
                          </td>
                          <td className="p-3.5 text-gray-400">
                            {video.likes.toLocaleString()}
                          </td>
                          <td className="p-3.5 text-gray-400">
                            {video.comments.toLocaleString()}
                          </td>
                          <td className="p-3.5 font-bold text-violet-400">
                            {calculateEngagement(video.likes, video.comments, video.views)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Compilation History Table */}
          {history.length > 0 && (
            <div className="glass-panel p-6 flex flex-col gap-5">
              <h3 className="text-lg font-bold">YouTube Shorts Compilation History</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="p-3 text-gray-400 font-semibold">Video Title</th>
                      <th className="p-3 text-gray-400 font-semibold">Date Compiled</th>
                      <th className="p-3 text-gray-400 font-semibold">Filename</th>
                      <th className="p-3 text-gray-400 font-semibold">YouTube Status</th>
                      <th className="p-3 text-gray-400 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-white/[0.04] last:border-b-0">
                        <td className="p-3.5 font-semibold text-[0.95rem] max-w-[280px] truncate">
                          {item.title}
                        </td>
                        <td className="p-3.5 text-gray-400 text-sm">
                          {formatDate(item.created_at)}
                        </td>
                        <td className="p-3.5 text-gray-500 font-mono text-xs">
                          {item.filename}
                        </td>
                        <td className="p-3.5">
                          {item.posted ? (
                            <a 
                              href={`https://youtube.com/watch?v=${item.youtube_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 font-semibold text-xs flex items-center gap-1 hover:underline"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Posted (ID: {item.youtube_id})
                            </a>
                          ) : (
                            <span className="text-amber-400 font-semibold text-xs flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              Local (Ready to Post)
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => {
                              // Save state to pre-select this video file in Generator
                              sessionStorage.setItem('active_video_history', JSON.stringify({
                                filename: item.filename,
                                title: item.title
                              }));
                              onNavigate('generator');
                            }}
                            className="text-violet-400 hover:text-violet-300 text-xs font-bold transition-colors cursor-pointer"
                          >
                            Open in Studio
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
