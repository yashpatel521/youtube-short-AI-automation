import React, { useState, useEffect } from 'react';

interface AutomationLog {
  id: number;
  log_text: string;
  level: string;
  created_at: string;
}

interface ProcessedVideo {
  id: number;
  original_youtube_id: string;
  original_title: string;
  original_description: string;
  regenerated_title: string;
  youtube_video_id: string;
  processed_at: string;
}

export default function AutopostAutomation() {
  const [running, setRunning] = useState(false);
  const [keywords, setKeywords] = useState('');
  const [intervalMin, setIntervalMin] = useState(10);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [processed, setProcessed] = useState<ProcessedVideo[]>([]);
  
  const [togglingState, setTogglingState] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const backendUrl = window.location.origin.replace(':5173', ':8000').replace(':5174', ':8000');

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/automation/status`);
      if (!res.ok) throw new Error('Failed to load status');
      const data = await res.json();
      setRunning(data.running);
      setKeywords(data.keywords || '');
      setIntervalMin(Math.round((data.interval_seconds || 600) / 60));
      setLogs(data.logs || []);
      setProcessed(data.processed || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll status & logs every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleAutomation = async () => {
    setTogglingState(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const endpoint = running ? '/api/automation/stop' : '/api/automation/start';
      const res = await fetch(`${backendUrl}${endpoint}`, { method: 'POST' });
      if (!res.ok) throw new Error('Operation failed');
      const data = await res.json();
      setSuccessMsg(data.message);
      fetchStatus();
    } catch (err: any) {
      setErrorMsg('Failed to change automation state.');
    } finally {
      setTogglingState(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear the logs console?')) return;
    try {
      await fetch(`${backendUrl}/api/automation/clear-logs`, { method: 'POST' });
      fetchStatus();
    } catch (err) {
      console.error('Failed to clear logs');
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleString();
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>🤖 Autopost Automation Studio</span>
            <span className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded font-mono">
              v1.0.0
            </span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Fully autonomous background loop that grabs viral Shorts, translates to new script variations, compiles, and publishes.
          </p>
        </div>

        <button
          onClick={handleToggleAutomation}
          disabled={togglingState}
          className={`px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all shadow-lg ${
            running
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/10'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/20'
          } disabled:opacity-50`}
        >
          {togglingState ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : running ? (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" />
              </svg>
              Stop Automation Bot
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
              </svg>
              Start Automation Bot
            </>
          )}
        </button>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 rounded-lg bg-red-900/20 border border-red-900/50 text-red-200 text-sm">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-900/10 border border-emerald-900/30 text-emerald-300 text-sm">
          {successMsg}
        </div>
      )}

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Status Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Engine Status</span>
            <div className="text-lg font-bold text-white mt-1 flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${running ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              {running ? 'Running Automatically' : 'Inactive'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
            🤖
          </div>
        </div>

        {/* Total Processed */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Processed Shorts</span>
            <div className="text-2xl font-bold text-white mt-1">
              {processed.length} Videos
            </div>
          </div>
          <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
            🎬
          </div>
        </div>

        {/* Config Summary */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Search Keywords / Interval</span>
            <div className="text-lg font-bold text-zinc-300 mt-1 truncate max-w-[200px]">
              {keywords.split(',').length} niches / every {intervalMin}m
            </div>
          </div>
          <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
            ⚙️
          </div>
        </div>
      </div>

      {/* Main Layout: Config vs Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Automation Info */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-6 space-y-4 text-zinc-300">
          <h3 className="text-base font-semibold text-white">Automation Engine Info</h3>
          <div className="space-y-3.5 text-xs">
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
              <span className="font-semibold text-white block mb-1">Target Keywords:</span>
              <p className="text-zinc-400 font-mono text-[10px] leading-relaxed">
                {keywords || "Loading default niche keywords..."}
              </p>
            </div>
            
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
              <span className="font-semibold text-white block mb-1">Duplication Shield:</span>
              <p className="text-zinc-400 leading-relaxed">
                Active. Video titles and YouTube Shorts descriptions are cross-referenced with SQLite history databases to prevent duplicate postings.
              </p>
            </div>
            
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
              <span className="font-semibold text-white block mb-1">Self-Regulated Delay:</span>
              <p className="text-zinc-400 leading-relaxed">
                Applied only when no new matching competitor videos are found or search queries fail (to preserve YouTube API quotas). When a video is successfully compiled and uploaded, the next cycle starts immediately.
              </p>
            </div>
          </div>
        </div>

        {/* Right Col: Logging Console Terminal */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800/80 rounded-xl flex flex-col h-[400px]">
          <div className="flex items-center justify-between border-b border-zinc-900 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <span className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="text-xs text-zinc-400 font-mono ml-2">automation-worker.log</span>
            </div>
            <button
              onClick={handleClearLogs}
              className="text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors"
            >
              Clear Console
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2 bg-zinc-950/80 select-text">
            {logs.length === 0 ? (
              <div className="text-zinc-600 italic">No automation logs recorded yet. Start the bot to stream logs.</div>
            ) : (
              logs.map((log) => {
                let color = 'text-zinc-300';
                if (log.level === 'ERROR') color = 'text-red-400 font-semibold';
                if (log.level === 'WARNING') color = 'text-yellow-400';
                return (
                  <div key={log.id} className="flex gap-2">
                    <span className="text-zinc-600 shrink-0">[{formatDate(log.created_at)}]</span>
                    <span className="text-violet-400 shrink-0">[{log.level}]</span>
                    <span className={color}>{log.log_text}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Processed Videos History Table */}
      <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl p-6">
        <h3 className="text-base font-semibold text-white mb-4">Regeneration & Upload Logs</h3>
        
        {processed.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-zinc-800 rounded-lg text-zinc-500 text-sm">
            No videos processed by the automation bot yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="pb-3 pl-2">Original Competitor Short</th>
                  <th className="pb-3">Regenerated Variant Title</th>
                  <th className="pb-3">YouTube Status</th>
                  <th className="pb-3 pr-2">Processed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {processed.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="py-3.5 pl-2 max-w-[250px] truncate">
                      <a
                        href={`https://youtube.com/watch?v=${row.original_youtube_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-violet-400 hover:underline inline-flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.516 0-9.387.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.507 9.387.507 9.387.507s7.517 0 9.387-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                        <span className="truncate">{row.original_title || 'Original Video'}</span>
                      </a>
                    </td>
                    <td className="py-3.5 font-medium text-zinc-200">
                      {row.regenerated_title}
                    </td>
                    <td className="py-3.5">
                      {row.youtube_video_id ? (
                        <a
                          href={`https://youtube.com/shorts/${row.youtube_video_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-xs hover:bg-emerald-500/20 inline-flex items-center gap-1"
                        >
                          <span>Shorts Link</span>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
                          </svg>
                        </a>
                      ) : (
                        <span className="bg-zinc-800 text-zinc-500 border border-zinc-700/50 px-2 py-0.5 rounded text-xs">
                          Local Only
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-zinc-400 text-xs pr-2">
                      {formatDate(row.processed_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
