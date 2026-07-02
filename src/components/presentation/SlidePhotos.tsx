'use client'

import type { Project } from '@/lib/types'

interface Props {
  project: Project
  selectedPhotoUrls: string[]
  theme?: 'dark' | 'light'
}

export function SlidePhotos({ project, selectedPhotoUrls, theme = 'dark' }: Props) {
  const isDark = theme === 'dark'
  const displayPhotos = selectedPhotoUrls.slice(0, 4)

  return (
    <div className="w-full h-full flex flex-col pt-8">
      <div className="mb-10">
        <h2 className={`text-4xl font-bold ${isDark ? 'text-[#a13c9d]' : 'text-purple-700'}`}>ภาพความก้าวหน้าหน้างาน</h2>
        <p className={`text-2xl mt-2 ${isDark ? 'text-white/60' : 'text-slate-500'}`}>โครงการ: {project.name}</p>
      </div>

      <div className="flex-1 min-h-0">
        {displayPhotos.length === 0 ? (
          <div className={`w-full h-full border-2 border-dashed ${isDark ? 'border-white/10 text-white/30' : 'border-black/10 text-slate-400'} rounded-3xl flex items-center justify-center`}>
             <p className="text-3xl">ยังไม่มีรูปภาพความก้าวหน้า</p>
          </div>
        ) : (
          <div className={`w-full h-full grid gap-6 ${
            displayPhotos.length === 1 ? 'grid-cols-1 grid-rows-1' :
            displayPhotos.length === 2 ? 'grid-cols-2 grid-rows-1' :
            'grid-cols-2 grid-rows-2'
          }`}>
            {displayPhotos.map((url, idx) => (
              <div key={idx} className={`relative rounded-3xl overflow-hidden ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} border group shadow-xl`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={url} 
                  alt="Progress" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
