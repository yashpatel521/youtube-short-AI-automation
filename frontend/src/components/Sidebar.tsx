import NavItem from './NavItem';
import StatusIndicator from './StatusIndicator';

/* ── SVG Icon Helpers ── */
const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const icons = {
  dashboard: <Icon><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></Icon>,
  generator: <Icon><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></Icon>,
  story: <Icon><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></Icon>,
  library: <Icon><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></Icon>,
  analytics: <Icon><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></Icon>,
  ideas: <Icon><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .6 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></Icon>,
  queue: <Icon><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></Icon>,
  quality: <Icon><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="m9 12 2 2 4-4" /></Icon>,
  settings: <Icon><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Icon>,
};

/* ── Nav Sections Configuration ── */
const NAV_SECTIONS = [
  {
    label: 'Create',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: icons.dashboard, path: '/dashboard' },
      { id: 'generator', label: 'Video Studio', icon: icons.generator, path: '/generator' },
      { id: 'story_studio', label: 'Story Studio', icon: icons.story, path: '/story_studio' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { id: 'library', label: 'Video Gallery', icon: icons.library, path: '/library' },
      { id: 'queue', label: 'Active Queue', icon: icons.queue, path: '/queue' },
    ],
  },
  {
    label: 'Analyze',
    items: [
      { id: 'analytics', label: 'Competitors', icon: icons.analytics, path: '/analytics' },
      { id: 'ideas', label: 'Viral Ideas', icon: icons.ideas, path: '/ideas' },
      { id: 'quality', label: 'Quality Lab', icon: icons.quality, path: '/quality' },
    ],
  },
];

/* ── Sidebar Props ── */
interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
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
      {/* ── Brand Logo ── */}
      <div className="flex items-center gap-3 px-4 py-4 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/20 overflow-hidden shrink-0">
          {channelThumbnail ? (
            <img src={channelThumbnail} alt="Channel" className="w-full h-full object-cover" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-white truncate leading-tight">
            {channelName || 'Helios Studio'}
          </h2>
          <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Video Engine</span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-1 flex flex-col gap-0.5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="nav-label">{section.label}</div>
            {section.items.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeTab === item.id}
                onClick={() => setActiveTab(item.id)}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* ── Bottom: Settings + Status ── */}
      <div className="shrink-0">
        <div className="px-2 pb-1">
          <NavItem
            icon={icons.settings}
            label="Settings"
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          />
        </div>
        <StatusIndicator
          serverOnline={status.status === 'online'}
          youtubeLinked={status.youtube_authenticated}
        />
      </div>
    </aside>
  );
}
