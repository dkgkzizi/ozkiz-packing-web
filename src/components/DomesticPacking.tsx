'use client';

import React from 'react';
import { Construction, Sparkles, ChevronRight } from 'lucide-react';

export default function DomesticPacking() {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-700 h-[60vh] flex flex-col items-center justify-center text-center">
      <header className="mb-12 self-start text-left w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-widest">
            CATEGORY 2
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
            <span>Domestic Logistics Sync</span>
          </div>
        </div>
      </header>

      <div className="relative">
        <div className="absolute inset-0 bg-orange-500/20 blur-[100px] rounded-full" />
        <div className="relative bg-slate-800/40 border border-white/5 p-12 rounded-3xl backdrop-blur-3xl shadow-3xl">
          <div className="w-20 h-20 bg-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Construction className="w-10 h-10 text-orange-500 animate-bounce" />
          </div>
          <h2 className="text-3xl font-black text-white mb-4 italic tracking-tighter">UNDER CONSTRUCTION</h2>
          <p className="text-slate-400 max-w-sm mx-auto leading-relaxed">
            국내 패킹리스트 변환 및 재고 동기화 시스템을 <br />준비 중입니다. 곧 만나보실 수 있습니다!
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-bold text-orange-400/60 uppercase tracking-widest">
            <Sparkles className="w-3 h-3" />
            <span>Coming Soon 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
