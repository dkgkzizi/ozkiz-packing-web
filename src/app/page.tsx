'use client';

import React, { useState } from 'react';
import { 
  Box, 
  Globe, 
  LayoutDashboard,
  ChevronRight,
  Package,
  Truck,
  Layers,
  Activity
} from 'lucide-react';
import IndiaPacking from '@/components/IndiaPacking';
import DomesticPacking from '@/components/DomesticPacking';
import ChinaPacking from '@/components/ChinaPacking';

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<number>(1);

  const categories = [
    { 
      id: 1, 
      name: 'Domestic Packing', 
      label: '국내 패킹리스트', 
      icon: <Package className="w-5 h-5" />, 
      desc: 'Local Hub',
      color: 'from-orange-500 to-amber-500',
      activeColor: 'text-orange-600',
      bg: 'bg-orange-50'
    },
    { 
      id: 2, 
      name: 'China Packing', 
      label: '중국 패킹리스트', 
      icon: <Truck className="w-5 h-5" />, 
      desc: 'China Branch',
      color: 'from-red-500 to-rose-400',
      activeColor: 'text-red-600',
      bg: 'bg-red-50'
    },
    { 
      id: 3, 
      name: 'India Packing', 
      label: '인도 패킹리스트', 
      icon: <Globe className="w-5 h-5" />, 
      desc: 'Global Matcher',
      color: 'from-blue-500 to-cyan-500',
      activeColor: 'text-blue-600',
      bg: 'bg-blue-50'
    }
  ];

  const renderContent = () => {
    switch (activeCategory) {
      case 1: return <DomesticPacking />;
      case 2: return <ChinaPacking />;
      case 3: return <IndiaPacking />;
      default: return <DomesticPacking />;
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-orange-100 selection:text-orange-900 overflow-x-hidden">
      {/* Background Soft Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-orange-200/20 blur-[180px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-200/20 blur-[180px] rounded-full" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar Nav - Light Edition */}
        <nav className="w-80 border-r border-slate-200 sticky top-0 h-screen p-10 flex flex-col bg-white/70 backdrop-blur-2xl">
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-1 px-1">
              <div className="w-10 h-10 bg-gradient-to-tr from-slate-800 to-slate-950 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200 ring-1 ring-white/20">
                <Box className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-black tracking-tighter italic text-slate-900 leading-none">
                  ANTIGRAVITY
                </h1>
                <span className="text-[10px] font-black text-slate-400 tracking-[0.3em] uppercase mt-1">HUB SYSTEM</span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 px-1">Logistic Management</p>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full group flex items-center gap-4 p-4 rounded-2xl transition-all duration-400 relative overflow-hidden ${
                  activeCategory === cat.id 
                  ? `${cat.bg} border border-slate-200 shadow-sm scale-[1.02]` 
                  : 'hover:bg-slate-100/50 border border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-400 shadow-sm ${
                  activeCategory === cat.id ? `bg-white text-slate-900 shadow-md` : 'bg-slate-100 text-slate-400'
                }`}>
                  <span className={activeCategory === cat.id ? cat.activeColor : ''}>{cat.icon}</span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-black text-slate-900 tracking-tight leading-none mb-1">{cat.label}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{cat.desc}</span>
                </div>
                {activeCategory === cat.id && (
                  <div className="ml-auto">
                    <ChevronRight className={`w-4 h-4 ${cat.activeColor}`} />
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="mt-auto p-6 bg-slate-950 rounded-3xl shadow-xl shadow-slate-200 border border-white/10 group cursor-pointer overflow-hidden relative">
             <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
             <div className="relative z-10 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none mb-1">Status: Active</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">Cloud sync encrypted</span>
                </div>
             </div>
          </div>
        </nav>

        {/* Content Area */}
        <section className="flex-1 p-16 max-w-7xl mx-auto overflow-y-auto">
           {renderContent()}
        </section>
      </div>
    </main>
  );
}

function ChevronRight(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
}
