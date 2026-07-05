
interface SidebarProps {
  activeTab: 'dashboard' | 'generator' | 'library' | 'analytics' | 'ideas' | 'quality' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'generator' | 'library' | 'analytics' | 'ideas' | 'quality' | 'settings') => void;
  status: {
    status: string;
    youtube_authenticated: boolean;
  };
  channelName?: string;
  channelThumbnail?: string;
}

export default function Sidebar({ activeTab, setActiveTab, status, channelName, channelThumbnail }: SidebarProps) {
  return (
    <aside className="sidebar">
      {/* Brand Logo Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/35 overflow-hidden">
          {channelThumbnail ? (
            <img src={channelThumbnail} alt="Channel Logo" className="w-full h-full object-cover" />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[1rem] font-extrabold tracking-wide uppercase truncate max-w-[155px]" title={channelName || 'YOUTUBE'}>
            {channelName || 'YOUTUBE'}
          </h2>
          <span className="text-[0.75rem] text-gray-500 font-semibold block">SHORTS GEN</span>
        </div>
      </div>

      <hr className="border-0 border-b border-white/5" />

      {/* Navigation Buttons Row/Column */}
      <nav className="flex flex-row md:flex-col gap-2 flex-1 overflow-x-auto md:overflow-x-visible pb-1.5 md:pb-0">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`btn-secondary w-full justify-start ${activeTab === 'dashboard' ? 'border-violet-500 bg-violet-500/15 text-white glow-active' : 'border-transparent bg-transparent text-gray-400'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" />
            <rect x="14" y="3" width="7" height="5" />
            <rect x="14" y="12" width="7" height="9" />
            <rect x="3" y="16" width="7" height="5" />
          </svg>
          Dashboard
        </button>

        <button
          onClick={() => setActiveTab('generator')}
          className={`btn-secondary w-full justify-start ${activeTab === 'generator' ? 'border-violet-500 bg-violet-500/15 text-white glow-active' : 'border-transparent bg-transparent text-gray-400'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          Video Studio
        </button>

        <button
          onClick={() => setActiveTab('library')}
          className={`btn-secondary w-full justify-start ${activeTab === 'library' ? 'border-violet-500 bg-violet-500/15 text-white glow-active' : 'border-transparent bg-transparent text-gray-400'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Video Gallery
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`btn-secondary w-full justify-start ${activeTab === 'analytics' ? 'border-violet-500 bg-violet-500/15 text-white glow-active' : 'border-transparent bg-transparent text-gray-400'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Competitors
        </button>

        <button
          onClick={() => setActiveTab('ideas')}
          className={`btn-secondary w-full justify-start ${activeTab === 'ideas' ? 'border-violet-500 bg-violet-500/15 text-white glow-active' : 'border-transparent bg-transparent text-gray-400'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .6 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
            <path d="M9 18h6" />
            <path d="M10 22h4" />
          </svg>
          Viral Ideas
        </button>

        <button
          onClick={() => setActiveTab('quality')}
          className={`btn-secondary w-full justify-start ${activeTab === 'quality' ? 'border-violet-500 bg-violet-500/15 text-white glow-active' : 'border-transparent bg-transparent text-gray-400'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          Quality Lab
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`btn-secondary w-full justify-start ${activeTab === 'settings' ? 'border-violet-500 bg-violet-500/15 text-white glow-active' : 'border-transparent bg-transparent text-gray-400'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>
      </nav>


      {/* Health Status Box */}
      <div className="glass-panel p-3 rounded-xl text-xs hidden md:block">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`w-2 h-2 rounded-full ${status.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
          <span className="font-semibold">Server: {status.status === 'online' ? 'Online' : 'Offline'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${status.youtube_authenticated ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          <span className="text-gray-400">
            YouTube: {status.youtube_authenticated ? 'Linked' : 'Not Linked'}
          </span>
        </div>
      </div>
    </aside>
  );
}
