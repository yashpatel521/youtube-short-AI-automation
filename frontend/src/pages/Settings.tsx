import React, { useState } from 'react';
import Header from '../components/Header';

interface SettingsProps {
  backendUrl: string;
  settings: {
    gemini_api_key_configured: boolean;
    pexels_api_key_configured: boolean;
    youtube_client_secrets_configured: boolean;
    client_id: string;
  };
  status: {
    youtube_authenticated: boolean;
    client_secrets_configured: boolean;
  };
  onUpdate: () => void;
  channelData?: any;
}

export default function Settings({ backendUrl, settings, status, onUpdate, channelData }: SettingsProps) {
  const [geminiKey, setGeminiKey] = useState('');
  const [pexelsKey, setPexelsKey] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check URL query parameters for auth state redirections
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      setMsg({ type: 'success', text: 'Successfully linked your YouTube channel!' });
      // Clean query string
      window.history.replaceState({}, document.title, window.location.pathname);
      onUpdate();
    } else if (params.get('auth') === 'error') {
      setMsg({ type: 'error', text: `Failed to link channel: ${params.get('detail')}` });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${backendUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gemini_api_key: geminiKey || undefined,
          pexels_api_key: pexelsKey || undefined,
          youtube_client_id: clientId || undefined,
          youtube_client_secret: clientSecret || undefined,
        }),
      });
      if (res.ok) {
        setMsg({ type: 'success', text: 'Configurations updated successfully!' });
        setGeminiKey('');
        setPexelsKey('');
        setClientId('');
        setClientSecret('');
        onUpdate();
      } else {
        const data = await res.json();
        setMsg({ type: 'error', text: data.detail || 'Failed to update settings.' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Error updating settings.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLinkYouTube = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/youtube/auth-url`);
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.url; // Redirect to Google OAuth page
      } else {
        const data = await res.json();
        setMsg({ type: 'error', text: data.detail || 'Could not initiate OAuth.' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Error connecting to auth URL.' });
    }
  };

  return (
    <div className="animate-slide-up max-w-3xl mx-auto flex flex-col gap-8">
      <Header
        title="API Configurations"
        description="Manage your local environment variables, integrations, and YouTube channel tokens."
        channelData={channelData}
      />

      {msg && (
        <div className={`p-4 rounded-xl border text-sm ${msg.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-red-500/15 border-red-500/30 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      {/* API Key Panel */}
      <form onSubmit={saveSettings} className="glass-panel p-8 flex flex-col gap-5">
        <h2 className="text-xl font-bold border-b border-white/5 pb-3">
          Integrations & Keys
        </h2>

        <div className="flex flex-col gap-2">
          <label className="font-semibold text-sm">
            Gemini AI API Key 
            <span className="text-gray-500 ml-1.5 font-normal">
              ({settings.gemini_api_key_configured ? 'Configured' : 'Not configured'})
            </span>
          </label>
          <input
            type="password"
            className="form-input"
            placeholder={settings.gemini_api_key_configured ? '••••••••••••••••••••••••••••••••' : 'Enter your Gemini API key'}
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
          />
          <span className="text-xs text-gray-500">
            Get a free Gemini API key from <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">Google AI Studio</a>.
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-semibold text-sm">
            Pexels API Key
            <span className="text-gray-500 ml-1.5 font-normal">
              ({settings.pexels_api_key_configured ? 'Configured' : 'Not configured'})
            </span>
          </label>
          <input
            type="password"
            className="form-input"
            placeholder={settings.pexels_api_key_configured ? '••••••••••••••••••••••••••••••••' : 'Enter your Pexels API key'}
            value={pexelsKey}
            onChange={(e) => setPexelsKey(e.target.value)}
          />
          <span className="text-xs text-gray-500">
            Needed to fetch stock motion graphics background. Create a free key at <a href="https://www.pexels.com/api/" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">Pexels Developers</a>.
          </span>
        </div>

        <h3 className="text-lg font-bold mt-2">YouTube API Credentials</h3>
        
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-sm">
            Google OAuth Client ID
            <span className="text-gray-500 ml-1.5 font-normal">
              {settings.youtube_client_secrets_configured ? ' (Configured)' : ' (Missing)'}
            </span>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder={settings.client_id ? `Active ID: ${settings.client_id.substring(0, 15)}...` : 'Enter Google Client ID'}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-semibold text-sm">Google OAuth Client Secret</label>
          <input
            type="password"
            className="form-input"
            placeholder={settings.youtube_client_secrets_configured ? '••••••••••••••••••••••••••••••••' : 'Enter Google Client Secret'}
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
          />
        </div>

        <button type="submit" className="btn-primary self-start mt-2" disabled={loading}>
          {loading ? 'Saving Configurations...' : 'Save Settings'}
        </button>
      </form>

      {/* YouTube Connection Panel */}
      <div className="glass-panel p-8 flex flex-col gap-4">
        <h2 className="text-xl font-bold border-b border-white/5 pb-3">
          YouTube Integration Channel Link
        </h2>
        
        <p className="text-sm text-gray-400 leading-relaxed">
          By linking your YouTube account, this application will gain permission to read your channel statistics,
          pull previous Shorts analytics, and upload video compilations directly as a Short.
        </p>

        {!settings.youtube_client_secrets_configured ? (
          <div className="p-3.5 px-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-sm leading-relaxed">
            <strong>Prerequisite Required:</strong> Please provide your Google Client ID and Secret in the settings panel above.
            You must configure an OAuth application in the Google Cloud Console, enable the YouTube Data API v3, and set your
            Authorized Redirect URI to: <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs border border-white/5 font-mono">http://localhost:8000/api/youtube/callback</code>.
          </div>
        ) : (
          <div className="flex items-center gap-4 mt-2">
            {status.youtube_authenticated ? (
              <div className="flex flex-col gap-3">
                <div className="text-emerald-400 font-semibold flex items-center gap-2 text-sm">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  YouTube Account is Connected and Authenticated!
                </div>
                <button onClick={handleLinkYouTube} className="btn-secondary self-start">
                  Reconnect / Change Channel
                </button>
              </div>
            ) : (
              <button onClick={handleLinkYouTube} className="btn-primary flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Link My YouTube Channel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
