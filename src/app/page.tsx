'use client';

import React, { useState } from 'react';
import { 
  Box, 
  Globe, 
  Cpu, 
  LayoutDashboard,
  ChevronRight,
  Package,
  Truck,
  Zap,
  Container
} from 'lucide-react';
import IndiaPacking from '@/components/IndiaPacking';
import DomesticPacking from '@/components/DomesticPacking';
import ChinaPacking from '@/components/ChinaPacking';
import EasyChainAutomation from '@/components/EasyChainAutomation';

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<number>(1);

  const categories = [
    { 
      id: 1, 
      name: 'Domestic Packing', 
      label: '국내 패킹리스트', 
      icon: <Package className="w-5 h-5" />, 
      desc: 'Local Logistics Hub',
      color: 'from-orange-500 to-amber-500' 
    },
    { 
      id: 2, 
      name: 'China Packing', 
      label: '중국 패킹리스트', 
      icon: <Truck className="w-5 h-5" />, 
      desc: 'China Branch Stream',
      color: 'from-red-600 to-rose-500' 
    },
    { 
      id: 3, 
      name: 'India Packing', 
      label: '인도 패킹리스트', 
      icon: <Globe className="w-5 h-5" />, 
      desc: 'Global Transit Matcher',
      color: 'from-blue-600 to-cyan-500' 
    },
    { 
      id: 4, 
      name: 'EasyChain Auto', 
      label: '이지체인 자동화', 
      icon: <Zap className="w-5 h-5" />, 
      desc: 'Inventory Auto-Pilot',
      color: 'from-yellow-500 to-orange-400' 
    }
  ];

  const renderContent = () => {
    switch (activeCategory) {
      case 1: return <DomesticPacking />;
      case 2: return <ChinaPacking />;
      case 3: return <IndiaPacking />;
      case 4: return <EasyChainAutomation />;
      default: return <DomesticPacking />;
    }
  };

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-orange-500/30 overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[150px] rounded-full animate-pulse delay-700" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar Nav */}
        <nav className="w-80 border-r border-white/5 sticky top-0 h-screen p-10 flex flex-col bg-slate-950/20 backdrop-blur-xl">
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-2 px-2">
              <div className="w-10 h-10 bg-gradient-to-tr from-orange-500 to-rose-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 ring-1 ring-white/20">
                <Box className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-black tracking-tighter italic text-white uppercase">
                Antigravity <span className="text-orange-500">Hub</span>
              </h1>
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] px-2 opacity-50">Logistics Control OS</p>
          </div>

          <div className="flex-1 space-y-3">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-6 px-2">Main Functions</p>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full group flex flex-col p-5 rounded-[2rem] transition-all duration-500 relative overflow-hidden ${
                  activeCategory === cat.id 
                  ? 'bg-white/5 border border-white/10 shadow-2xl scale-[1.02]' 
                  : 'hover:bg-white/2 border border-transparent opacity-40 hover:opacity-80'
                }`}
              >
                {activeCategory === cat.id && (
                  <div className={`absolute left-0 top-0 w-1 h-full bg-gradient-to-b ${cat.color}`} />
                )}
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner ${
                    activeCategory === cat.id ? `bg-gradient-to-tr ${cat.color} text-white shadow-lg` : 'bg-slate-900 text-slate-500'
                  }`}>
                    {cat.icon}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${activeCategory === cat.id ? 'text-orange-500' : 'text-slate-600'}`}>
                      Category {cat.id}
                    </span>
                    <span className="text-sm font-black text-white tracking-tight">{cat.label}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-auto px-4 py-8 bg-white/2 rounded-3xl border border-white/5">
             <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Systems Online</span>
             </div>
          </div>
        </nav>

        {/* Content Area */}
        <section className="flex-1 p-16 max-w-7xl mx-auto">
           {renderContent()}
        </section>
      </div>
    </main>
  );
}
