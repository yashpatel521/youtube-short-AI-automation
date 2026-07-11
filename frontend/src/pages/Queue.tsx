import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';

interface JobItem {
  job_id: string;
  status: string;
  progress: number;
  logs: string[];
  video_path: string | null;
  video_filename: string | null;
  error: string | null;
  created_at: string;
}

interface QueueProps {
  backendUrl: string;
}

export default function Queue({ backendUrl }: QueueProps) {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/video/jobs`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('Error fetching queue jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // Poll queue status every 3 seconds
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [backendUrl]);

  const toggleExpand = (jobId: string) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
    } else {
      setExpandedJobId(jobId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
      case 'failed': return 'text-red-400 bg-red-500/10 border-red-500/25';
      case 'rendering': return 'text-violet-400 bg-violet-500/10 border-violet-500/25 animate-pulse';
      case 'generating': return 'text-blue-400 bg-blue-500/10 border-blue-500/25 animate-pulse';
      default: return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <PageShell title="Active Queue">

      {loading && jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Fetching queue status...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="glass-panel p-16 flex flex-col items-center text-center gap-5 border-dashed border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-1">Queue is empty</h3>
            <p className="text-gray-400 text-sm max-w-sm">No auto-generation tasks are running. Go to the Viral Ideas Lab or Video Studio to compile some videos!</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {jobs.map((job) => (
            <div 
              key={job.job_id} 
              className={`glass-panel p-6 flex flex-col gap-4 border transition-all ${job.status === 'rendering' || job.status === 'generating' ? 'border-violet-500/25 bg-violet-950/[0.02]' : 'border-white/5'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-200">Job #{job.job_id.substring(0, 8)}</span>
                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 font-medium">Started: {formatDate(job.created_at)}</span>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => toggleExpand(job.job_id)}
                    className="btn-secondary py-1.5 px-3 text-xs font-bold"
                  >
                    {expandedJobId === job.job_id ? 'Hide Logs' : 'View Logs'}
                  </button>

                  {job.status === 'completed' && job.video_filename && (
                    <>
                      <button 
                        onClick={() => setActivePreview(job.video_filename)}
                        className="btn-primary py-1.5 px-3 text-xs font-bold"
                      >
                        Play Preview
                      </button>
                      
                      {/* Check if logs contain YouTube link */}
                      {job.logs.some(l => l.includes('Watch URL')) && (
                        <a 
                          href={job.logs.find(l => l.includes('Watch URL'))?.split('Watch URL: ')[1] || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary py-1.5 px-3 text-xs font-bold border-emerald-500/20 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10"
                        >
                          Watch on YouTube
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Progress Bar container */}
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-white/5 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${job.status === 'failed' ? 'bg-red-500' : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'}`}
                    style={{ width: `${job.progress || 0}%` }}
                  />
                </div>
                <span className="text-xs text-violet-400 font-extrabold min-w-[32px] text-right">
                  {job.progress || 0}%
                </span>
              </div>

              {job.status === 'failed' && job.error && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                  <strong>Error:</strong> {job.error}
                </div>
              )}

              {/* Expandable Logs Section */}
              {expandedJobId === job.job_id && (
                <div className="h-[180px] bg-black/60 backdrop-blur-md rounded-xl p-4 font-mono text-[10px] overflow-y-auto border border-white/5 flex flex-col gap-1.5 text-emerald-400 animate-slide-down">
                  {job.logs.length === 0 ? (
                    <div className="text-gray-500 italic">No logs generated yet.</div>
                  ) : (
                    job.logs.map((log, i) => (
                      <div key={i} className="break-all">
                        <span className="text-gray-500">&gt;</span> {log}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Video Preview Overlay Modal */}
      {activePreview && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setActivePreview(null)}>
          <div className="relative aspect-[9/16] h-[85vh] bg-black rounded-3xl border border-white/10 overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <video 
              src={`${backendUrl}/api/video/preview/${activePreview}`}
              className="w-full h-full object-cover"
              controls
              autoPlay
            />
            <button 
              onClick={() => setActivePreview(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer border border-white/10 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
