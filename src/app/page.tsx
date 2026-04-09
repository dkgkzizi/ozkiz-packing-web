'use client';

import React, { useState } from 'react';
import { 
  Package, 
  Truck, 
  Layers, 
  Settings, 
  ChevronRight,
  Menu,
  X,
  LayoutDashboard,
  Globe,
  Home
} from 'lucide-react';
import IndiaPacking from '@/components/IndiaPacking';
import DomesticPacking from '@/components/DomesticPacking';

type ToolCategory = 'india' | 'domestic' | 'inventory' | 'settings';

export default function DashboardPage() {
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('india');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const categories = [
    { id: 'india', name: '인도 패킹리스트', icon: Globe, color: 'text-indigo-400' },
    { id: 'domestic', name: '국내 패킹리스트', icon: Home, color: 'text-orange-400' },
    { id: 'inventory', name: '재고 동기화 (Beta)', icon: Package, color: 'text-emerald-400' },
  ];

  return (
    <main className="min-h-screen bg-[#0F172A] text-slate-200 font-sans flex overflow-hidden">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full animate-pulse delay-1000" />
      </div>

      {/* Sidebar Navigation */}
      <aside 
        className={`relative z-20 border-r border-white/5 bg-slate-900/50 backdrop-blur-3xl transition-all duration-500 ease-in-out ${
          isSidebarOpen ? 'w-72' : 'w-20'
        }`}
      >
        <div className="flex flex-col h-full p-4">
          {/* Logo Section */}
          <div className="flex items-center gap-3 px-2 py-6 mb-8 border-b border-white/5">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/40 shrink-0">
              <Layers className="text-white w-6 h-6" />
            </div>
            {isSidebarOpen && (
              <div className="animate-in fade-in duration-500">
                <h2 className="text-white text-sm font-black tracking-tighter uppercase">ANTIGRAVITY</h2>
                <p className="text-[9px] text-slate-500 font-bold tracking-widest uppercase">Logistics Hub</p>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as any)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group ${
                  activeCategory === cat.id 
                    ? 'bg-white/5 border border-white/10 shadow-inner' 
                    : 'hover:bg-white/5 text-slate-500'
                }`}
              >
                <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                  activeCategory === cat.id ? 'bg-indigo-500/20 ' + cat.color : 'bg-white/5 group-hover:bg-white/10'
                }`}>
                  <cat.icon className="w-5 h-5" />
                </div>
                {isSidebarOpen && (
                  <div className="text-left animate-in fade-in slide-in-from-left-2 duration-300">
                    <p className={`text-[11px] font-black uppercase tracking-tighter ${activeCategory === cat.id ? 'text-white' : 'text-slate-500'}`}>
                      {cat.name}
                    </p>
                    <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">Application</p>
                  </div>
                )}
                {isSidebarOpen && activeCategory === cat.id && (
                  <ChevronRight className="ml-auto w-4 h-4 text-indigo-500 animate-in fade-in duration-500" />
                )}
              </button>
            ))}
          </nav>

          {/* Sidebar Toggle & Bottom Links */}
          <div className="pt-4 border-t border-white/5 space-y-2">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-slate-500 transition-all"
            >
              <div className="shrink-0 w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </div>
              {isSidebarOpen && <span className="text-[10px] font-bold uppercase tracking-widest">접기/펼치기</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="flex-1 relative z-10 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700">
        <div className="max-w-6xl mx-auto px-8 py-12 md:py-16">
          {activeCategory === 'india' && <IndiaPacking />}
          {activeCategory === 'domestic' && <DomesticPacking />}
          {(activeCategory === 'inventory' || activeCategory === 'settings') && (
            <div className="h-[60vh] flex items-center justify-center text-slate-500 uppercase font-black text-xs tracking-widest animate-pulse">
              준비 중입니다...
            </div>
          )}

          {/* Integrated Footer */}
          <footer className="mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500 text-[9px] font-black tracking-[0.2em] uppercase">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
              <span>Central Logistics Systems Operational</span>
            </div>
            <div className="flex items-center gap-4">
              <span>© 2026 ANTIGRAVITY HUB</span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-indigo-400">v2.0.0</span>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}
