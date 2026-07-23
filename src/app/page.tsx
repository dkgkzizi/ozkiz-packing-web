'use client';

import React, { useState } from 'react';
import { 
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
    switch (activeCategory) {
      case 1: return <DomesticPacking />;
      case 2: return <ChinaPacking />;
      case 3: return <IndiaPacking />;
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

          <div className="mt-auto space-y-3 pt-6 border-t border-slate-100">
             {/* 관리자 업데이트 락 상태 버튼 */}
             <button
                onClick={() => isLocked ? setShowUnlockModal(true) : setIsLocked(true)}
                className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors text-xs font-bold ${
                    isLocked
                    ? 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                    : 'bg-red-50 text-red-600 border-red-100'
                }`}
            >
                {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                {isLocked ? '수정 잠금' : '수정 모드 켜짐'}
            </button>

            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className={`w-2 h-2 rounded-full ${isLocked ? 'bg-green-500' : 'bg-red-600'}`} />
                <div className="flex flex-col leading-tight">
                    <span className="text-xs font-bold text-slate-700">
                        {isLocked ? '운영 중' : '점검 모드'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                        {isLocked ? '정상 작동 중' : '업데이트 가능'}
                    </span>
                </div>
            </div>
          </div>
        </nav>

        {/* Content Area */}
        <section className="flex-1 p-10 max-w-7xl mx-auto overflow-y-auto">
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
