import React, { useState, useEffect } from 'react';

interface CommentItem {
  id: number;
  comment_id: string;
  video_id: string;
  video_title: string;
  author_name: string;
  author_profile_image: string;
  comment_text: string;
  reply_text: string;
  reply_status: string; // 'pending', 'replied', 'failed'
  replied_at?: string;
  rule_id?: number;
  error?: string;
  created_at: string;
}

interface CommentSettings {
  id: number;
  is_enabled: number;
  check_interval_minutes: number;
  ai_tone: string;
  include_cta: number;
  cta_text: string;
  bot_running: boolean;
}

interface CommentRule {
  id: number;
  name: string;
  keyword: string;
  reply_mode: string; // 'ai', 'template', 'ai_with_cta'
  template_text: string;
  is_active: number;
  created_at: string;
}

export default function AutoReplyComments() {
  const [activeTab, setActiveTab] = useState<'feed' | 'settings' | 'rules' | 'history'>('feed');
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [settings, setSettings] = useState<CommentSettings>({
    id: 1,
    is_enabled: 1,
    check_interval_minutes: 5,
    ai_tone: 'Enthusiastic & Friendly',
    include_cta: 1,
    cta_text: 'Thanks for watching! Subscribe for daily viral Shorts! 🔔',
    bot_running: true
  });
  const [rules, setRules] = useState<CommentRule[]>([]);
  
  const [fetchingApi, setFetchingApi] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'replied'>('all');
  
  // Custom reply draft state per comment ID
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [generatingAi, setGeneratingAi] = useState<Record<string, boolean>>({});
  const [postingReply, setPostingReply] = useState<Record<string, boolean>>({});
  
  // Rule creation modal / inline state
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleKeyword, setNewRuleKeyword] = useState('');
  const [newRuleMode, setNewRuleMode] = useState('template');
  const [newRuleTemplate, setNewRuleTemplate] = useState('');

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const backendUrl = window.location.origin.replace(':5173', ':8000').replace(':5174', ':8000');

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    try {
      // Fetch settings
      const sRes = await fetch(`${backendUrl}/api/comments/settings`);
      if (sRes.ok) {
        const sData = await sRes.json();
        setSettings(sData);
      }

      // Fetch comments
      const cRes = await fetch(`${backendUrl}/api/comments`);
      if (cRes.ok) {
        const cData = await cRes.json();
        setComments(cData.comments || []);
      }

      // Fetch rules
      const rRes = await fetch(`${backendUrl}/api/comments/rules`);
      if (rRes.ok) {
        const rData = await rRes.json();
        setRules(rData.rules || []);
      }
    } catch (err) {
      console.error('Error loading comment data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncFetch = async () => {
    setFetchingApi(true);
    try {
      const res = await fetch(`${backendUrl}/api/comments/fetch`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
        showToast('success', `Synced comments! Processed ${data.summary?.processed || 0} recent comments.`);
      } else {
        showToast('error', 'Failed to fetch YouTube comments.');
      }
    } catch (err) {
      showToast('error', 'Network error fetching comments.');
    } finally {
      setFetchingApi(false);
    }
  };

  const handleToggleBot = async (active: boolean) => {
    try {
      const res = await fetch(`${backendUrl}/api/comments/toggle-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({
          ...prev,
          is_enabled: data.is_enabled ? 1 : 0,
          bot_running: data.bot_running
        }));
        showToast('success', active ? 'Auto-reply bot activated!' : 'Auto-reply bot paused.');
      }
    } catch (err) {
      showToast('error', 'Error toggling bot state.');
    }
  };

  const handleGenerateAiReply = async (comment: CommentItem) => {
    setGeneratingAi(prev => ({ ...prev, [comment.comment_id]: true }));
    try {
      const res = await fetch(`${backendUrl}/api/comments/generate-ai-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment_text: comment.comment_text,
          video_title: comment.video_title,
          tone: settings.ai_tone,
          cta_text: settings.include_cta ? settings.cta_text : null
        })
      });
      if (res.ok) {
        const data = await res.json();
        setReplyDrafts(prev => ({ ...prev, [comment.comment_id]: data.reply_text }));
      } else {
        showToast('error', 'Failed to generate AI reply.');
      }
    } catch (err) {
      showToast('error', 'Error generating AI reply.');
    } finally {
      setGeneratingAi(prev => ({ ...prev, [comment.comment_id]: false }));
    }
  };

  const handlePostReply = async (comment: CommentItem) => {
    const textToPost = replyDrafts[comment.comment_id] || comment.reply_text;
    if (!textToPost || !textToPost.trim()) {
      showToast('error', 'Please write or generate a reply before posting.');
      return;
    }

    setPostingReply(prev => ({ ...prev, [comment.comment_id]: true }));
    try {
      const res = await fetch(`${backendUrl}/api/comments/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment_id: comment.comment_id,
          reply_text: textToPost,
          rule_id: comment.rule_id
        })
      });
      if (res.ok) {
        showToast('success', `Replied to ${comment.author_name}!`);
        loadData();
      } else {
        const data = await res.json();
        showToast('error', data.detail || 'Failed to post reply.');
      }
    } catch (err) {
      showToast('error', 'Error posting reply.');
    } finally {
      setPostingReply(prev => ({ ...prev, [comment.comment_id]: false }));
    }
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/comments/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_enabled: settings.is_enabled,
          check_interval_minutes: settings.check_interval_minutes,
          ai_tone: settings.ai_tone,
          include_cta: settings.include_cta,
          cta_text: settings.cta_text
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        showToast('success', 'Auto-reply settings saved!');
      }
    } catch (err) {
      showToast('error', 'Failed to save settings.');
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || !newRuleKeyword.trim()) {
      showToast('error', 'Please provide a rule name and trigger keyword.');
      return;
    }
    try {
      const res = await fetch(`${backendUrl}/api/comments/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRuleName,
          keyword: newRuleKeyword,
          reply_mode: newRuleMode,
          template_text: newRuleTemplate,
          is_active: 1
        })
      });
      if (res.ok) {
        showToast('success', `Rule '${newRuleName}' created!`);
        setNewRuleName('');
        setNewRuleKeyword('');
        setNewRuleTemplate('');
        loadData();
      }
    } catch (err) {
      showToast('error', 'Failed to create rule.');
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    try {
      const res = await fetch(`${backendUrl}/api/comments/rules/${ruleId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('success', 'Rule deleted.');
        loadData();
      }
    } catch (err) {
      showToast('error', 'Failed to delete rule.');
    }
  };

  const filteredComments = comments.filter(c => {
    if (statusFilter === 'pending') return c.reply_status === 'pending';
    if (statusFilter === 'replied') return c.reply_status === 'replied';
    return true;
  });

  const totalReplied = comments.filter(c => c.reply_status === 'replied').length;
  const totalPending = comments.filter(c => c.reply_status === 'pending').length;

  return (
    <div className="w-full min-h-full p-6 max-w-7xl mx-auto space-y-6 pb-28">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-medium transition-all ${
          notification.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200 shadow-emerald-900/30' 
            : 'bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-rose-900/30'
        }`}>
          <span>{notification.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-900/40 via-purple-900/20 to-zinc-900 border border-violet-500/20 p-6 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💬</span>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Auto Reply to Comments</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                settings.is_enabled 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}>
                <span className={`w-2 h-2 rounded-full ${settings.is_enabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`}></span>
                {settings.is_enabled ? 'Bot Active' : 'Bot Paused'}
              </span>
            </div>
            <p className="text-zinc-400 text-sm">
              Automatically respond to YouTube Shorts comments using Gemini 2.5 AI & trigger rules.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncFetch}
              disabled={fetchingApi}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold border border-zinc-700 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${fetchingApi ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {fetchingApi ? 'Syncing YouTube...' : 'Sync & Fetch Comments'}
            </button>

            <button
              onClick={() => handleToggleBot(!settings.is_enabled)}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg ${
                settings.is_enabled
                  ? 'bg-rose-600/90 hover:bg-rose-500 text-white shadow-rose-900/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
              }`}
            >
              {settings.is_enabled ? '⏸ Pause Bot' : '▶ Start Bot'}
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/5">
          <div className="bg-zinc-900/60 rounded-xl p-3.5 border border-zinc-800/80">
            <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Total Managed</div>
            <div className="text-xl font-bold text-white mt-1">{comments.length}</div>
          </div>
          <div className="bg-zinc-900/60 rounded-xl p-3.5 border border-zinc-800/80">
            <div className="text-emerald-400/80 text-xs font-semibold uppercase tracking-wider">Auto-Replied</div>
            <div className="text-xl font-bold text-emerald-400 mt-1">{totalReplied}</div>
          </div>
          <div className="bg-zinc-900/60 rounded-xl p-3.5 border border-zinc-800/80">
            <div className="text-amber-400/80 text-xs font-semibold uppercase tracking-wider">Pending Review</div>
            <div className="text-xl font-bold text-amber-400 mt-1">{totalPending}</div>
          </div>
          <div className="bg-zinc-900/60 rounded-xl p-3.5 border border-zinc-800/80">
            <div className="text-violet-400/80 text-xs font-semibold uppercase tracking-wider">Active Rules</div>
            <div className="text-xl font-bold text-violet-400 mt-1">{rules.filter(r => r.is_active).length}</div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-zinc-800 space-x-1">
        <button
          onClick={() => setActiveTab('feed')}
          className={`px-5 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'feed'
              ? 'border-violet-500 text-violet-400 bg-violet-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          💬 Comment Feed & Live Replies
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-5 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'settings'
              ? 'border-violet-500 text-violet-400 bg-violet-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          ⚙️ Bot & AI Tone Settings
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-5 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'rules'
              ? 'border-violet-500 text-violet-400 bg-violet-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          🎯 Keyword Trigger Rules
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-5 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'history'
              ? 'border-violet-500 text-violet-400 bg-violet-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          📜 Activity History Log
        </button>
      </div>

      {/* TAB 1: COMMENT FEED */}
      {activeTab === 'feed' && (
        <div className="space-y-4">
          {/* Feed Filter Sub-bar */}
          <div className="flex items-center justify-between bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mr-2">Filter:</span>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                All Comments ({comments.length})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'pending' ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Pending ({totalPending})
              </button>
              <button
                onClick={() => setStatusFilter('replied')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'replied' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Auto-Replied ({totalReplied})
              </button>
            </div>
            
            <div className="text-xs text-zinc-500">
              AI Tone: <span className="text-violet-400 font-semibold">{settings.ai_tone}</span>
            </div>
          </div>

          {/* Comments List */}
          {filteredComments.length === 0 ? (
            <div className="text-center py-16 bg-zinc-900/40 rounded-2xl border border-zinc-800/60">
              <span className="text-4xl">💬</span>
              <h3 className="text-lg font-semibold text-zinc-300 mt-3">No comments found in this view</h3>
              <p className="text-zinc-500 text-sm mt-1">Click "Sync & Fetch Comments" above to pull recent YouTube comments.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredComments.map(c => {
                const draft = replyDrafts[c.comment_id] ?? c.reply_text ?? '';
                const isGenerating = generatingAi[c.comment_id];
                const isPosting = postingReply[c.comment_id];

                return (
                  <div key={c.comment_id} className="bg-zinc-900/90 rounded-2xl p-5 border border-zinc-800 hover:border-zinc-700/80 transition-all space-y-4 shadow-lg">
                    {/* Header: User Info & Status */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={c.author_profile_image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'}
                          alt={c.author_name}
                          className="w-10 h-10 rounded-full object-cover border border-zinc-700"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-white font-bold text-sm">{c.author_name}</h4>
                            <span className="text-xs text-zinc-500">on video:</span>
                            <span className="text-xs text-violet-400 font-medium truncate max-w-xs">{c.video_title}</span>
                          </div>
                          <span className="text-[11px] text-zinc-500">{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        c.reply_status === 'replied'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : c.reply_status === 'failed'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}>
                        {c.reply_status === 'replied' ? '✓ Replied' : c.reply_status === 'failed' ? '⚠️ Failed' : '⏳ Pending'}
                      </span>
                    </div>

                    {/* Comment Body */}
                    <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800 text-zinc-200 text-sm font-medium">
                      "{c.comment_text}"
                    </div>

                    {/* Reply Section */}
                    <div className="pl-4 border-l-2 border-violet-500/40 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 font-semibold flex items-center gap-1.5">
                          <span>🤖</span> AI / Template Response Draft:
                        </span>
                        <button
                          onClick={() => handleGenerateAiReply(c)}
                          disabled={isGenerating}
                          className="text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 text-xs"
                        >
                          {isGenerating ? 'Generating...' : '✨ Re-generate AI Reply'}
                        </button>
                      </div>

                      <textarea
                        value={draft}
                        onChange={(e) => setReplyDrafts(prev => ({ ...prev, [c.comment_id]: e.target.value }))}
                        rows={2}
                        className="w-full bg-zinc-950 text-zinc-100 text-sm p-3 rounded-xl border border-zinc-800 focus:outline-none focus:border-violet-500 transition-all"
                        placeholder="Write or edit auto-reply text..."
                      />

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-zinc-500">
                          {c.reply_status === 'replied' && c.replied_at
                            ? `Replied at ${new Date(c.replied_at).toLocaleTimeString()}`
                            : 'Click "Post Reply" to send live to YouTube'}
                        </span>

                        <button
                          onClick={() => handlePostReply(c)}
                          disabled={isPosting}
                          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-violet-900/30 transition-all disabled:opacity-50"
                        >
                          {isPosting ? 'Posting...' : c.reply_status === 'replied' ? 'Update & Re-Post' : '🚀 Send Reply to YouTube'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BOT & AI SETTINGS */}
      {activeTab === 'settings' && (
        <div className="bg-zinc-900/80 rounded-2xl p-6 border border-zinc-800 space-y-6 max-w-3xl">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            ⚙️ Comment Auto-Reply Configuration
          </h3>

          <div className="space-y-5">
            {/* AI Tone Selector */}
            <div>
              <label className="block text-sm font-semibold text-zinc-300 mb-2">AI Response Tone</label>
              <select
                value={settings.ai_tone}
                onChange={(e) => setSettings(prev => ({ ...prev, ai_tone: e.target.value }))}
                className="w-full bg-zinc-950 text-white text-sm p-3 rounded-xl border border-zinc-800 focus:outline-none focus:border-violet-500"
              >
                <option value="Enthusiastic & Friendly">🌟 Enthusiastic & Friendly (High Engagement)</option>
                <option value="Witty & Sarcastic">🔥 Witty & Sarcastic (Gen-Z Viral Style)</option>
                <option value="Viral Hype & Emojis">🚀 Viral Hype & Emojis (Shorts Scroll-Stopper)</option>
                <option value="Professional & Helpful">💼 Professional & Helpful</option>
              </select>
            </div>

            {/* Check Interval Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-zinc-300">Background Polling Interval</label>
                <span className="text-violet-400 font-bold text-sm">Every {settings.check_interval_minutes} Minutes</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                value={settings.check_interval_minutes}
                onChange={(e) => setSettings(prev => ({ ...prev, check_interval_minutes: parseInt(e.target.value) }))}
                className="w-full accent-violet-500"
              />
            </div>

            {/* Include CTA Toggle */}
            <div className="flex items-center justify-between p-4 bg-zinc-950/60 rounded-xl border border-zinc-800">
              <div>
                <h4 className="text-sm font-bold text-white">Attach Call-To-Action (CTA)</h4>
                <p className="text-xs text-zinc-400 mt-0.5">Appends a channel subscribe CTA to AI-generated replies.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.include_cta === 1}
                onChange={(e) => setSettings(prev => ({ ...prev, include_cta: e.target.checked ? 1 : 0 }))}
                className="w-5 h-5 accent-violet-500 rounded cursor-pointer"
              />
            </div>

            {/* CTA Text Input */}
            {settings.include_cta === 1 && (
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">Custom Call-To-Action Text</label>
                <input
                  type="text"
                  value={settings.cta_text}
                  onChange={(e) => setSettings(prev => ({ ...prev, cta_text: e.target.value }))}
                  className="w-full bg-zinc-950 text-white text-sm p-3 rounded-xl border border-zinc-800 focus:outline-none focus:border-violet-500"
                  placeholder="e.g. Thanks for watching! Subscribe for daily viral Shorts! 🔔"
                />
              </div>
            )}

            <button
              onClick={handleSaveSettings}
              className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm shadow-lg shadow-violet-900/30 transition-all"
            >
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: KEYWORD TRIGGER RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {/* Create New Rule Form */}
          <div className="bg-zinc-900/80 rounded-2xl p-6 border border-zinc-800 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              🎯 Add Keyword Trigger Rule
            </h3>
            <p className="text-xs text-zinc-400">
              When a YouTube comment contains your keyword, the bot can auto-respond with a custom template or AI reply.
            </p>

            <form onSubmit={handleCreateRule} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Rule Name</label>
                <input
                  type="text"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder="e.g. Part 2 Request"
                  className="w-full bg-zinc-950 text-white text-sm p-3 rounded-xl border border-zinc-800 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Trigger Keyword / Phrase</label>
                <input
                  type="text"
                  value={newRuleKeyword}
                  onChange={(e) => setNewRuleKeyword(e.target.value)}
                  placeholder="e.g. part 2"
                  className="w-full bg-zinc-950 text-white text-sm p-3 rounded-xl border border-zinc-800 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Response Mode</label>
                <select
                  value={newRuleMode}
                  onChange={(e) => setNewRuleMode(e.target.value)}
                  className="w-full bg-zinc-950 text-white text-sm p-3 rounded-xl border border-zinc-800 focus:outline-none focus:border-violet-500"
                >
                  <option value="template">Custom Fixed Template</option>
                  <option value="ai">Gemini AI Dynamic Reply</option>
                </select>
              </div>

              {newRuleMode === 'template' && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Template Reply Text</label>
                  <textarea
                    value={newRuleTemplate}
                    onChange={(e) => setNewRuleTemplate(e.target.value)}
                    placeholder="e.g. Part 2 is coming out tomorrow! Subscribe and hit the bell icon! 🚀"
                    rows={2}
                    className="w-full bg-zinc-950 text-white text-sm p-3 rounded-xl border border-zinc-800 focus:outline-none focus:border-violet-500"
                  />
                </div>
              )}

              <div className="md:col-span-2 pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm shadow-lg shadow-violet-900/30 transition-all"
                >
                  + Add Keyword Rule
                </button>
              </div>
            </form>
          </div>

          {/* Existing Rules List */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Active Rules ({rules.length})</h4>

            {rules.length === 0 ? (
              <div className="text-center py-8 bg-zinc-900/40 rounded-xl border border-zinc-800 text-zinc-500 text-sm">
                No keyword rules configured yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rules.map(r => (
                  <div key={r.id} className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-white text-base">{r.name}</h5>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/30 uppercase">
                          {r.reply_mode}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-zinc-400">
                        Trigger Keyword: <span className="text-emerald-400 font-mono font-bold">"{r.keyword}"</span>
                      </div>
                      {r.template_text && (
                        <p className="mt-2 text-xs bg-zinc-950 p-2.5 rounded-lg text-zinc-300 border border-zinc-800">
                          "{r.template_text}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleDeleteRule(r.id)}
                        className="text-xs text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20"
                      >
                        Delete Rule
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ACTIVITY LOG */}
      {activeTab === 'history' && (
        <div className="bg-zinc-900/80 rounded-2xl p-6 border border-zinc-800 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            📜 Auto-Reply Execution History
          </h3>

          <div className="divide-y divide-zinc-800/80">
            {comments.filter(c => c.reply_status === 'replied').length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-sm">
                No replies posted yet. When the bot automatically responds to comments, execution logs will appear here.
              </div>
            ) : (
              comments.filter(c => c.reply_status === 'replied').map(c => (
                <div key={c.comment_id} className="py-3.5 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold text-white">{c.author_name}</span>
                      <span className="text-xs text-zinc-500">on "{c.video_title}"</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">Comment: "{c.comment_text}"</p>
                    <p className="text-xs text-emerald-400 mt-1 font-medium">Reply: "{c.reply_text}"</p>
                  </div>
                  <span className="text-[11px] text-zinc-500 shrink-0">
                    {c.replied_at ? new Date(c.replied_at).toLocaleTimeString() : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
