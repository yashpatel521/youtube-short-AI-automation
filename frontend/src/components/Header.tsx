import React from 'react';

interface HeaderProps {
  title: string;
  description: string;
  channelData?: any;
  children?: React.ReactNode;
}

export default function Header({ title, description, channelData, children }: HeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6 flex-wrap gap-4 border-b border-white/5 pb-5">
      <div>
        <h1 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">{title}</h1>
        <p className="text-gray-400 text-sm">{description}</p>
      </div>
      <div className="flex gap-3 items-center flex-wrap">
        {channelData && (
          <div className="flex gap-4 items-center bg-[#12121c]/80 border border-white/5 px-4 py-2 rounded-2xl text-xs backdrop-blur-md shadow-lg shadow-black/20 animate-fade-in">
            {/* Channel Logo (same icon as sidebar) */}
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center overflow-hidden shrink-0 border border-white/10 shadow-md">
              {channelData.thumbnail ? (
                <img src={channelData.thumbnail} alt="Channel Logo" className="w-full h-full object-cover" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[0.6rem] text-gray-500 font-extrabold uppercase tracking-wider">Subscribers</span>
              <span className="font-extrabold text-violet-400">
                {typeof channelData.subscribers === 'number' ? channelData.subscribers.toLocaleString() : channelData.subscribers}
              </span>
            </div>
            <div className="h-6 w-[1px] bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[0.6rem] text-gray-500 font-extrabold uppercase tracking-wider">Total Views</span>
              <span className="font-extrabold text-pink-400">
                {typeof channelData.views === 'number' ? channelData.views.toLocaleString() : channelData.views}
              </span>
            </div>
            <div className="h-6 w-[1px] bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[0.6rem] text-gray-500 font-extrabold uppercase tracking-wider">Watch Hours</span>
              <span className="font-extrabold text-amber-400">
                {typeof channelData.views === 'number' ? Math.round((channelData.views * 25) / 3600).toLocaleString() : '0'}h
              </span>
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
