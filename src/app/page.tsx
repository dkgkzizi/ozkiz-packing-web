'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, 
  Home, 
  Zap, 
  Menu, 
  X,
  Settings,
  Database,
  Package,
  Boxes,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Dynamic imports with SSR disabled to prevent Prerender Errors on Vercel
const IndiaPacking = dynamic(() => import('@/components/IndiaPacking'), { 
  ssr: false,
  loading: () => <LoadingPlaceholder label="인도 패킹 모듈 로드 중..." />
});

const DomesticPacking = dynamic(() => import('@/components/DomesticPacking'), { 
  ssr: false,
  loading: () => <LoadingPlaceholder label="국내 패킹 모듈 로드 중..." />
});

function LoadingPlaceholder({ label }: { label: string }) {
  return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-center">
      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
      <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">{label}</p>
    </div>
  );
}

function ComingSoon() {
  return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-center">
      <div className="w-24 h-24 bg-slate-800/50 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner border border-white/5">
        <Boxes className="w-10 h-10 text-slate-500 animate-pulse" />
      </div>
      <h2 className="text-4xl font-black text-white italic tracking-tighter mb-4 uppercase">Coming Soon</h2>
      <p className="text-slate-500 max-w-sm leading-relaxed font-bold">
        더 나은 물류 자동화 환경을 위해 새로운 기능을 준비 중입니다. <br />
        곧 업데이트될 예정입니다.
      </p>
    </div>
  );
}

const CATEGORIES = [
  { id: 'india', name: '인도 패킹리스트', sub: 'Category 1', icon: Globe, component: IndiaPacking, color: 'indigo' },
  { id: 'domestic', name: '국내 패킹리스트', sub: 'Category 2', icon: Home, component: DomesticPacking, color: 'orange' },
  { id: 'future1', name: '이지체인 자동화', sub: 'Category 3', icon: Zap, component: ComingSoon, color: 'cyan' },
  { id: 'future2', name: '재고 분석 센터', sub: 'Category 4', icon: Database, component: ComingSoon, color: 'purple' },
  { id: 'settings', name: '시스템 설정', sub: 'Category 5', icon: Settings, component: ComingSoon, color: 'slate' },
];

export default function DashboardManager() {
  const [mounted, setMounted] = useState(false);
  const [activeCategory, setActiveCategory] = useState('india');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="min-h-screen bg-[#020617]" />;

  const currentCategory = CATEGORIES.find(c => c.id === activeCategory) || CATEGORIES[0];
  const CurrentComponent = currentCategory.component;

  return (
    <div className="flex min-h-screen bg-[#020617] text-slate-200 selection:bg-indigo-500/30 font-sans overflow-hidden">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[150px] rounded-full" />
      </div>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarOpen ? 300 : 80 }}
        className="relative z-20 bg-slate-900/40 border-r border-white/5 backdrop-blur-3xl flex flex-col transition-all duration-300 shadow-2xl"
      >
        <div className="p-6 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {sidebarOpen ? (
              <motion.div 
                key="logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Package className="text-white w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black tracking-tighter text-white uppercase leading-none">Antigravity</span>
                  <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">Logistics Hub</span>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="mini-logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto"
              >
                <Package className="text-white w-6 h-6" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto custom-scrollbar">
          {CATEGORIES.map((cat) => {
             const Icon = cat.icon;
             return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 group relative text-left outline-hidden",
                  activeCategory === cat.id 
                    ? `bg-white/5 text-white border border-white/10 shadow-lg` 
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0",
                  activeCategory === cat.id ? "bg-indigo-600 text-white" : "bg-slate-800/50 group-hover:bg-slate-800"
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                
                {sidebarOpen && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col items-start flex-1"
                  >
                    <span className="text-xs font-black tracking-tighter leading-none">{cat.name}</span>
                    <span className="text-[9px] font-bold opacity-50 uppercase tracking-widest mt-1">{cat.sub}</span>
                  </motion.div>
                )}

                {activeCategory === cat.id && (
                  <motion.div layoutId="nav-glow" className="absolute inset-0 rounded-2xl ring-1 ring-white/10" />
                )}
              </button>
             );
          })}
        </nav>

        <div className="p-4">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-3 rounded-xl bg-slate-900 border border-white/5 text-slate-500 hover:text-white transition-colors shadow-2xl"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-y-auto custom-scrollbar">
        <div className="px-6 py-12 md:px-12 md:py-16 max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            >
              <CurrentComponent />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <style jsx global>{`
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { 
          background: rgba(255, 255, 255, 0.05); 
          border-radius: 10px; 
        }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.1); }
      `}</style>
    </div>
  );
}
