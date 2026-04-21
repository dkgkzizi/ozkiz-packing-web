'use client';

import React, { useState } from 'react';
import { 
  Box, 
  Globe, 
  LayoutDashboard,
  Package,
  Truck,
  Layers,
  Activity,
  Lock,
  Unlock,
  ShieldAlert,
  Key
} from 'lucide-react';
import IndiaPacking from '@/components/IndiaPacking';
import DomesticPacking from '@/components/DomesticPacking';
import ChinaPacking from '@/components/ChinaPacking';

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<number>(1);
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<boolean>(false);

  // 관리자 마스터 PIN (사용자 요청 시 수정 가능)
  const ADMIN_PIN = '0411';

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

  const handleUnlock = () => {
    if (pin === ADMIN_PIN) {
        setIsLocked(false);
        setShowUnlockModal(false);
        setPin('');
        setError(false);
    } else {
        setError(true);
        setPin('');
        setTimeout(() => setError(false), 2000);
    }
  };

  const renderContent = () => {
    if (isLocked) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in duration-700">
                <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-8 border-4 border-white shadow-2xl shadow-red-200">
                    <Lock className="w-10 h-10 text-red-600" />
                </div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4 uppercase italic">Systems Locked</h2>
                <p className="text-slate-500 font-medium mb-8 max-w-sm">관리자 승인 없이 시스템 접근이 제한되었습니다.<br />업데이트 및 작업 진행을 위해 언락이 필요합니다.</p>
                <button 
                    onClick={() => setShowUnlockModal(true)}
                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold tracking-widest uppercase text-xs hover:bg-red-600 transition-all shadow-xl shadow-slate-200 flex items-center gap-3 active:scale-95"
                >
                    <Unlock className="w-4 h-4" />
                    Authorize System Unlock
                </button>
            </div>
        );
    }

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
                disabled={isLocked && cat.id !== activeCategory}
                className={`w-full group flex items-center gap-4 p-4 rounded-2xl transition-all duration-400 relative overflow-hidden ${
                  activeCategory === cat.id 
                  ? `${cat.bg} border border-slate-200 shadow-sm scale-[1.02]` 
                  : (isLocked ? 'opacity-20 cursor-not-allowed' : 'hover:bg-slate-100/50 border border-transparent opacity-60 hover:opacity-100')
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

          <div className="mt-auto space-y-4">
            {!isLocked && (
                <button 
                    onClick={() => setIsLocked(true)}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all font-bold text-xs uppercase tracking-widest mb-2"
                >
                    <Lock className="w-4 h-4" />
                    Lock System
                </button>
            )}

            <div className="p-6 bg-slate-950 rounded-3xl shadow-xl shadow-slate-200 border border-white/10 group cursor-pointer overflow-hidden relative">
                <div className={`absolute inset-0 bg-gradient-to-br transition-opacity ${isLocked ? 'from-red-500/20' : 'from-green-500/20'} to-transparent opacity-0 group-hover:opacity-100`} />
                <div className="relative z-10 flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)] ${isLocked ? 'bg-red-500' : 'bg-green-500'}`} />
                    <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none mb-1">
                        Status: {isLocked ? 'Locked' : 'Active'}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                        {isLocked ? 'Encryption Key Required' : 'Authorization Verified'}
                    </span>
                    </div>
                </div>
            </div>
          </div>
        </nav>

        {/* Content Area */}
        <section className="flex-1 p-16 max-w-7xl mx-auto overflow-y-auto">
           {renderContent()}
        </section>
      </div>

      {/* Unlock Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowUnlockModal(false)} />
            <div className="relative bg-white rounded-3xl p-10 max-w-sm w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
                        <Key className="w-8 h-8 text-slate-900" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 italic uppercase mb-2 leading-none">Security Authorization</h3>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-8">관리자 PIN 번호를 입력하십시오</p>
                    
                    <div className="grid grid-cols-4 gap-2 mb-8">
                        {[1, 2, 3, 4].map((i) => (
                            <div 
                                key={i} 
                                className={`w-12 h-16 rounded-xl border-2 flex items-center justify-center text-2xl font-black transition-all ${
                                    error ? 'border-red-400 bg-red-50 text-red-600' : (pin.length >= i ? 'border-slate-900 bg-white text-slate-900' : 'border-slate-100 bg-slate-50 text-slate-200')
                                }`}
                            >
                                {pin.length >= i ? '●' : ''}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2 w-full mb-8">
                        {[1,2,3,4,5,6,7,8,9,0].map(n => (
                            <button 
                                key={n}
                                onClick={() => pin.length < 4 && setPin(prev => prev + n)}
                                className="h-14 bg-slate-50 hover:bg-slate-100 rounded-xl font-black text-lg transition-colors active:scale-90"
                            >
                                {n}
                            </button>
                        ))}
                        <button 
                            onClick={() => setPin('')}
                            className="h-14 bg-red-50 text-red-500 rounded-xl font-bold text-xs uppercase tracking-widest"
                        >
                            DEL
                        </button>
                    </div>

                    <div className="flex gap-4 w-full">
                        <button 
                            onClick={() => setShowUnlockModal(false)}
                            className="flex-1 py-4 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-900 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleUnlock}
                            disabled={pin.length < 4}
                            className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-30 disabled:pointer-events-none"
                        >
                            Unlock
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </main>
  );
}

function ChevronRight(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
}
