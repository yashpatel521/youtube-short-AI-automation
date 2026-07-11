import { useParams, useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell';

interface StoryDetailProps {
  backendUrl: string;
  stories: any[];
  setStories: React.Dispatch<React.SetStateAction<any[]>>;
}

export default function StoryDetail({ stories, setStories }: StoryDetailProps) {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();

  const story = stories.find(s => s.id === storyId);

  if (!story) {
    return (
      <div className="animate-slide-up flex flex-col gap-6 p-6">
        <h2 className="text-xl font-bold">Story not found</h2>
        <button onClick={() => navigate('/story_studio')} className="btn-secondary py-2 px-4 max-w-[200px]">
          Back to Studio
        </button>
      </div>
    );
  }

  const handleAddNewChapter = () => {
    const title = prompt('Enter Chapter Title (e.g. Chapter 1: The Quest Begins):');
    if (!title || !title.trim()) return;

    // A chapter is a 4-5 minutes video, containing scenes (slides)
    const newChapter = {
      id: `ch_${Date.now()}`,
      title: title.trim(),
      scenes: [{
        id: `sc_0_${Date.now()}`,
        title: 'Introduction',
        narration: '',
        image_prompt: '',
        image_prompts: [],
        image_url: '',
        image_urls: []
      }]
    };
    
    const updatedChapters = [...(story.chapters || []), newChapter];
    setStories(prev => prev.map(s => s.id === story.id ? { ...s, chapters: updatedChapters } : s));
    
    // Navigate straight to the new chapter's storyboard page
    navigate(`/story/${story.id}/${updatedChapters.length - 1}`);
  };

  const handleDeleteChapter = (idxToRemove: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chapter video?')) return;
    const updatedChapters = story.chapters.filter((_: any, idx: number) => idx !== idxToRemove);
    setStories(prev => prev.map(s => s.id === story.id ? { ...s, chapters: updatedChapters } : s));
  };

  return (
    <PageShell
      title={story.title}
      breadcrumbs={[
        { label: 'Story Studio', path: '/story_studio' },
        { label: story.title }
      ]}
    >
      <div className="flex flex-col gap-5 mt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Chapters / Videos inside Playlist</h3>
          
          <button
            onClick={handleAddNewChapter}
            className="btn-secondary text-xs font-bold py-2 px-4 border border-violet-500/20 bg-violet-500/5 text-violet-300 hover:bg-violet-500/10 cursor-pointer"
          >
            ➕ Add New Chapter
          </button>
        </div>

        {/* Chapters Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {story.chapters?.map((chapter: any, idx: number) => {
            // Calculate total word count inside this chapter's scenes
            const totalWords = (chapter.scenes || []).reduce((acc: number, scene: any) => {
              return acc + (scene.narration || '').split(/\s+/).filter(Boolean).length;
            }, 0);
            
            // Average reading speed is ~2.2 words per second. Let's estimate video length
            const videoSeconds = Math.max(3, Math.ceil(totalWords / 2.2));
            const min = Math.floor(videoSeconds / 60);
            const sec = videoSeconds % 60;
            const lengthDisplay = `${min}:${sec.toString().padStart(2, '0')}`;

            return (
              <div
                key={idx}
                onClick={() => navigate(`/story/${story.id}/${idx}`)}
                className="glass-panel p-5 flex flex-col justify-between border border-white/5 hover:border-violet-500/20 hover:bg-violet-950/[0.01] transition-all cursor-pointer min-h-[160px] group"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-violet-400 font-extrabold uppercase tracking-wider block">
                      Chapter {idx + 1}
                    </span>
                    <span className="text-[9px] text-gray-400 font-bold bg-white/5 px-1.5 py-0.5 rounded flex items-center gap-1">
                      ⏱️ {lengthDisplay}
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-white group-hover:text-violet-300 transition-colors line-clamp-2">
                    {chapter.title || `Chapter ${idx + 1}`}
                  </h4>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-4 text-[10px] text-gray-500">
                  <span>🖼️ {chapter.scenes?.length || 0} Scenes / Slides</span>
                  <button
                    onClick={(e) => handleDeleteChapter(idx, e)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 p-1 cursor-pointer bg-transparent border-0 text-[10px]"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            );
          })}

          {/* Quick Add Chapter Card */}
          <div
            onClick={handleAddNewChapter}
            className="glass-panel p-5 flex flex-col items-center justify-center border-dashed border-white/10 hover:border-violet-500/35 hover:bg-violet-500/5 transition-all cursor-pointer min-h-[160px] text-gray-400 hover:text-violet-300"
          >
            <span className="text-xl mb-1">➕</span>
            <span className="text-xs font-bold">Add New Chapter</span>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
