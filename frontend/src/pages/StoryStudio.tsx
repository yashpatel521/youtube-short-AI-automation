import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell';

interface StoryStudioProps {
  backendUrl: string;
  stories: any[];
  setStories: React.Dispatch<React.SetStateAction<any[]>>;
}

export default function StoryStudio({ backendUrl, stories, setStories }: StoryStudioProps) {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<'kids_cartoon' | 'anime'>('kids_cartoon');
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleGenerateStory = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setToast(null);

    try {
      const res = await fetch(`${backendUrl}/api/stories/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          style: selectedStyle,
          duration: 240 // 4 minutes target
        })
      });

      if (res.ok) {
        const data = await res.json();
        const newStory = {
          id: `ai_${Date.now()}`,
          title: data.title,
          style: selectedStyle,
          chapters: [
            {
              id: `ch_1_${Date.now()}`,
              title: "Chapter 1: The Beginning",
              scenes: data.chapters.map((segment: any, sIdx: number) => {
                const prompts = segment.image_prompts || [];
                return {
                  id: `sc_${sIdx}_${Date.now()}`,
                  title: segment.title || `Scene ${sIdx + 1}`,
                  narration: segment.narration || "",
                  image_prompt: prompts.join("\n"),
                  image_prompts: prompts,
                  image_url: "",
                  image_urls: []
                };
              })
            }
          ]
        };
        setStories(prev => [newStory, ...prev]);
        setTopic('');
        setToast({ message: `Story "${data.title}" generated successfully!`, type: 'success' });
        setTimeout(() => setToast(null), 5000);
        
        // Navigate straight to the story detail view
        navigate(`/story/${newStory.id}`);
      } else {
        const data = await res.json();
        setToast({ message: data.detail || 'Failed to generate story script.', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error communicating with server.', type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateBlankFromInput = () => {
    if (!topic.trim()) return;
    const newStory = {
      id: `manual_${Date.now()}`,
      title: topic.trim(),
      style: selectedStyle,
      chapters: [
        {
          id: `ch_1_${Date.now()}`,
          title: "Chapter 1: The Beginning",
          scenes: [
            {
              id: `sc_0_${Date.now()}`,
              title: 'Scene 1',
              narration: '',
              image_prompt: '',
              image_prompts: [],
              image_url: '',
              image_urls: []
            }
          ]
        }
      ]
    };

    setStories(prev => [newStory, ...prev]);
    setTopic('');
    navigate(`/story/${newStory.id}`);
  };

  const handleDeleteStory = (storyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this story?')) return;
    setStories(prev => prev.filter(s => s.id !== storyId));
  };

  return (
    <PageShell title="Story Studio">
      <div className="flex flex-col gap-6">

      <div className="glass-panel p-5 border border-white/5 bg-white/[0.01] flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex-1 w-full flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            className="form-input text-xs flex-1 py-3 px-4 bg-black/35 text-white"
            placeholder="Type your story topic or title (e.g. 'The Brave Squirrel and the Magic portal')"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <select
            className="form-input text-xs py-3 px-4 bg-black/35 border-white/10 text-white w-full sm:w-[160px]"
            value={selectedStyle}
            onChange={(e) => setSelectedStyle(e.target.value as any)}
          >
            <option value="kids_cartoon">Kids Cartoon</option>
            <option value="anime">Anime Style</option>
          </select>
        </div>
        <div className="flex gap-2 w-full lg:w-auto">
          <button
            onClick={handleGenerateStory}
            disabled={generating || !topic.trim()}
            className="btn-primary py-3 px-6 text-xs font-bold whitespace-nowrap shadow-lg shadow-violet-500/25 flex-1 md:flex-none justify-center"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="w-4.5 h-4.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Generating...
              </span>
            ) : (
              '✨ AI Generate'
            )}
          </button>
          <button
            onClick={handleCreateBlankFromInput}
            disabled={!topic.trim()}
            className="btn-secondary py-3 px-6 text-xs font-bold whitespace-nowrap border border-white/10 hover:bg-white/5 transition-all flex-1 md:flex-none justify-center"
          >
            Submit Blank
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <h3 className="text-base font-bold">Your Stories</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stories.map(story => (
            <div
              key={story.id}
              onClick={() => navigate(`/story/${story.id}`)}
              className="glass-panel p-5 flex flex-col justify-between min-h-[160px] border border-white/5 hover:border-violet-500/20 hover:bg-violet-950/[0.01] transition-all cursor-pointer group"
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${story.style === 'anime' ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
                    {story.style === 'anime' ? 'Anime Style' : 'Kids Cartoon'}
                  </span>
                  <button
                    onClick={(e) => handleDeleteStory(story.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 p-1.5 rounded transition-all cursor-pointer bg-transparent border-0 text-xs"
                  >
                    🗑️ Delete
                  </button>
                </div>
                <h4 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors line-clamp-2 mt-1">
                  {story.title}
                </h4>
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-4 text-xs text-gray-400">
                <span>📖 {story.chapters.length} Chapters</span>
                <span className="text-violet-400 group-hover:translate-x-1 transition-transform font-bold flex items-center gap-1">
                  Open Storyboard →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className={`glass-panel p-4 pr-12 rounded-2xl border flex items-center gap-3 shadow-2xl max-w-sm ${toast.type === 'error' ? 'border-red-500/25 bg-red-950/20 text-red-300' : 'border-violet-500/25 bg-violet-950/20 text-violet-300'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-violet-500/10`}>
              ⚡
            </div>
            <div className="text-xs font-semibold leading-relaxed">{toast.message}</div>
            <button 
              onClick={() => setToast(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white cursor-pointer bg-transparent border-0 text-[10px]"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      </div>
    </PageShell>
  );
}
