'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  LayoutDashboard,
  Package,
  Truck,
  Layers,
  Activity,
  BookOpen,
  ExternalLink
} from 'lucide-react';
import IndiaPacking from '@/components/IndiaPacking';
import DomesticPacking from '@/components/DomesticPacking';
import ChinaPacking from '@/components/ChinaPacking';
import Manual from '@/components/Manual';

// Tailwind의 기본 transition easing(cubic-bezier(0.4, 0, 0.2, 1))과 동일한 커브
const EASE_STANDARD: [number, number, number, number] = [0.4, 0, 0.2, 1];

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<number>(1);

  const categories = [
    { 
      id: 1, 
      name: 'Domestic Packing', 
      label: '국내 패킹리스트', 
      icon: <Package className="w-5 h-5" />, 
      desc: 'Local Hub',
      color: 'from-red-600 to-rose-500',
      activeColor: 'text-red-600',
      bg: 'bg-red-50'
    },
    { 
      id: 2, 
      name: 'China Packing', 
      label: '중국 패킹리스트', 
      icon: <Truck className="w-5 h-5" />, 
      desc: 'China Branch',
      color: 'from-red-600 to-red-400',
      activeColor: 'text-red-700',
      bg: 'bg-red-50/80'
    },
    {
      id: 3,
      name: 'India Packing',
      label: '인도 패킹리스트',
      icon: <Globe className="w-5 h-5" />,
      desc: 'Global Matcher',
      color: 'from-rose-600 to-red-500',
      activeColor: 'text-rose-600',
      bg: 'bg-rose-50'
    },
    {
      id: 4,
      name: 'Manual',
      label: '사용 매뉴얼',
      icon: <BookOpen className="w-5 h-5" />,
      desc: 'How to use',
      color: 'from-slate-700 to-slate-500',
      activeColor: 'text-slate-700',
      bg: 'bg-slate-50'
    }
  ];

  const externalApps = [
    { name: 'Barcode', url: 'https://ozkiz-barcode-print-1rwx.vercel.app/', accent: 'text-red-600' },
    { name: 'DMC', url: 'https://easyadmin-shipping-web.onrender.com/', accent: 'text-rose-500' },
    { name: 'CRS', url: 'https://cod-receipt-web.vercel.app/', accent: 'text-red-500' },
  ];

  const renderContent = () => {
    switch (activeCategory) {
      case 1: return <DomesticPacking />;
      case 2: return <ChinaPacking />;
      case 3: return <IndiaPacking />;
      case 4: return <Manual />;
      default: return <DomesticPacking />;
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-red-100 selection:text-red-900 overflow-x-hidden">
      <div className="flex min-h-screen">
        {/* Sidebar Nav - Clean Edition */}
        <nav className="w-72 border-r border-slate-200 sticky top-0 h-screen p-6 flex flex-col bg-white">
          <div className="mb-10 px-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight leading-none">
                <span className="text-red-600">OH!</span> <span className="text-slate-900">Packing</span>
              </h1>
            </div>
            <span className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mt-1 block">Openhan Smart Packing</span>
          </div>

          <div className="flex-1 space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  activeCategory === cat.id
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <span className={activeCategory === cat.id ? 'text-white' : 'text-slate-400'}>{cat.icon}</span>
                <span className="text-sm font-bold">{cat.label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2 pt-6 border-t border-slate-100">
            {externalApps.map((app) => (
              <a
                key={app.name}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <span className="text-base font-black tracking-tight leading-none">
                  <span className={app.accent}>OH!</span>{' '}
                  <span className="text-slate-900">{app.name}</span>
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 transition-colors" />
              </a>
            ))}
          </div>
        </nav>

        {/* Content Area */}
        <section className="flex-1 p-10 max-w-7xl mx-auto overflow-y-auto">
           <AnimatePresence mode="wait">
             <motion.div
                key={activeCategory}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: EASE_STANDARD }}
             >
                {renderContent()}
             </motion.div>
           </AnimatePresence>
        </section>
      </div>
    </main>
  );
}

function ChevronRight(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
}
