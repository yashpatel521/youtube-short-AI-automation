import React, { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';

interface JobLog {
  id: string;
  status: string;
  progress: number;
  logs: string[];
  error: string | null;
}

interface ViralRemixerProps {
  backendUrl: string;
  youtubeAuthenticated: boolean;
}

export default function ViralRemixer({ backendUrl, youtubeAuthenticated }: ViralRemixerProps) {
  const [topic, setTopic] = useState('');
  const voice = 'en-US-GuyNeural';
  const [loading, setLoading] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobLog | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Poll job status if a job is active
  useEffect(() => {
    if (!currentJobId) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/video/status/${currentJobId}`);
        if (res.ok) {
          const data = await res.json();
          setJobStatus(data);
          if (data.status === 'completed') {
            setSuccessMsg('Remix Short created and uploaded successfully!');
            setLoading(false);
            setCurrentJobId(null);
          } else if (data.status === 'failed') {
            setErrorMsg(data.error || 'Remix processing failed.');
            setLoading(false);
            setCurrentJobId(null);
          }
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [currentJobId, backendUrl]);

  const handleStartRemix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeAuthenticated) {
      setErrorMsg('Please link your YouTube channel in settings first.');
      return;
    }
    const remixTopic = topic.trim() || 'Animal funny fails';

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setJobStatus(null);

    try {
      const res = await fetch(`${backendUrl}/api/video/remix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: remixTopic,
          voice,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentJobId(data.job_id);
        setSuccessMsg('Remix job successfully queued in pipeline.');
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || 'Failed to start remix process.');
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect to the backend API.');
      setLoading(false);
    }
  };

  return (
    <PageShell title="Viral Remix Lab">
      <div className="w-full flex flex-col gap-6">
        {/* Status Messages */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            <strong>Error:</strong> {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm">
            <strong>Success:</strong> {successMsg}
          </div>
        )}

        <div className="flex flex-col gap-6 w-full">
          {/* Form Config */}
          <form onSubmit={handleStartRemix} className="w-full glass-panel p-6 flex flex-col gap-5">
            <h3 className="text-base font-bold text-white border-b border-white/5 pb-2">1-Click Auto Remix</h3>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">Target Category / Preset</label>
              <div className="flex flex-wrap gap-2">
                {['Animal funny fails', 'Cats vs Physics', 'Silly dogs funny moments', 'Gen-Z meme fails'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTopic(preset)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                      topic === preset ? 'bg-violet-600 text-white border-violet-500 shadow-md' : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10'
                    }`}
                  >
                    "{preset}"
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-3.5 font-extrabold text-sm shadow-xl shadow-violet-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Gemini Auto-Remixing Short...
                </>
              ) : (
                <>
                  <span className="text-lg">✨</span>
                  <span>Auto-Remix YouTube Short (1-Click)</span>
                </>
              )}
            </button>
          </form>

          {/* Console / Status */}
          <div className="w-full glass-panel p-6 flex flex-col gap-4 min-h-[350px]">
            <h3 className="text-base font-bold text-white border-b border-white/5 pb-2 flex items-center justify-between">
              <span>Pipeline Console Log</span>
              {jobStatus && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  {jobStatus.status}
                </span>
              )}
            </h3>

            {jobStatus ? (
              <div className="flex-1 flex flex-col gap-4">
                {/* Progress bar */}
                <div className="flex items-center gap-4 bg-black/25 p-3.5 rounded-xl border border-white/5">
                  <div className="flex-1 bg-white/5 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-300"
                      style={{ width: `${jobStatus.progress || 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-violet-400 shrink-0">
                    {jobStatus.progress || 0}%
                  </span>
                </div>

                {/* Console Log window */}
                <div className="flex-1 bg-black/60 border border-white/5 rounded-xl p-4 font-mono text-[10px] overflow-y-auto h-[200px] flex flex-col gap-1.5 text-emerald-400 select-text">
                  {jobStatus.logs && jobStatus.logs.length > 0 ? (
                    jobStatus.logs.map((log, index) => (
                      <div key={index} className="break-words">
                        <span className="text-gray-500">&gt;</span> {log}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-600 italic">Initializing execution stream...</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/5 rounded-xl text-zinc-500">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-lg mb-3">
                  ⌨️
                </div>
                <p className="text-xs max-w-xs leading-relaxed">
                  No active remixing task is running. Enter a search query on the left and click start to run the autonomous workflow.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
