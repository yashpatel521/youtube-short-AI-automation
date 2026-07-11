interface StatusIndicatorProps {
  serverOnline: boolean;
  youtubeLinked: boolean;
}

export default function StatusIndicator({ serverOnline, youtubeLinked }: StatusIndicatorProps) {
  return (
    <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${serverOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <span className="text-[11px] font-medium text-zinc-500">
          Server {serverOnline ? 'Online' : 'Offline'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${youtubeLinked ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <span className="text-[11px] font-medium text-zinc-500">
          YouTube {youtubeLinked ? 'Linked' : 'Not Linked'}
        </span>
      </div>
    </div>
  );
}
