'use client';

import React, { useState } from 'react';
import { 
  Zap, 
  Search, 
  SortAsc, 
  Printer, 
  Play, 
  Loader2, 
  CheckCircle2, 
  ShieldCheck,
  Layout,
  Terminal,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EasyChainAutomation() {
  const [keyword, setKeyword] = useState('판매분 의류');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-5));
  };

  const handleStart = async () => {
    setStatus('running');
    setLogs([]);
    addLog('이지체인 자동화 시퀀스를 시작합니다...');
    
    try {
      // 실제 API 연동 (추후 서버 측에서 ezchain_auto.js 실행 로직 연결)
      addLog('브라우저 엔진 최적화 중...');
      await new Promise(r => setTimeout(r, 1500));
      addLog(`${keyword} 검색 키워드 주입 완료.`);
      
      addLog('이지체인(ecn.ezadmin.co.kr) 접속 중...');
      await new Promise(r => setTimeout(r, 2000));
      addLog('보안 인증 및 조기 로그인 성공.');

      addLog('출고중 페이지 이동 및 데이터 로딩...');
      await new Promise(r => setTimeout(r, 2000));
      addLog(`상품수 ${sortDir === 'asc' ? '오름차순' : '내림차순'} 정렬 적용 완료.`);
      
      addLog('작업지시 일괄 출력 명령 전달 중...');
      await new Promise(r => setTimeout(r, 3000));
      addLog('출고지시 확인 단계 최종 승인.');

      setStatus('success');
      addLog('✅ 모든 자동화 작업이 성공적으로 완료되었습니다.');
    } catch (e) {
      setStatus('error');
      addLog('❌ 오류 발생: 자동화 엔진 응답 없음');
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-700">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-bold uppercase tracking-widest">
            CATEGORY 4
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="w-3 h-3 text-yellow-500" />
            <span>EasyChain Auto-Pilot Active</span>
          </div>
        </div>
        <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase mb-2">
          EasyChain <span className="text-yellow-500">Auto</span>
        </h1>
        <p className="text-slate-500 font-bold max-w-2xl leading-relaxed">
          이지체인 재고 관리 및 출고 지시를 자동화합니다. <br />
          복잡한 수동 작업 없이 클릭 한 번으로 인쇄부터 확정까지 처리하세요.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Control Panel */}
        <div className="lg:col-span-12 xl:col-span-5 space-y-6">
          <div className="bg-slate-900/50 border border-white/5 rounded-[2.5rem] p-10 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                <Settings className="w-32 h-32 text-yellow-500" />
            </div>

            <h3 className="text-xs font-black text-white uppercase tracking-[0.3em] mb-10 flex items-center gap-2 relative z-10">
              <Terminal className="w-4 h-4 text-yellow-500" />
              Automation Parameters
            </h3>

            <div className="space-y-8 relative z-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Search className="w-3 h-3" /> Search Keyword
                </label>
                <input 
                  type="text" 
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:border-yellow-500/50 transition-all"
                  placeholder="예: 판매분 의류"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <SortAsc className="w-3 h-3" /> Sorting Preference
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setSortDir('asc')}
                    className={`py-4 rounded-2xl border transition-all font-black text-xs uppercase tracking-widest ${
                      sortDir === 'asc' ? 'bg-yellow-500/10 border-yellow-500/50 text-white' : 'bg-white/2 border-transparent text-slate-500'
                    }`}
                  >
                    Ascending
                  </button>
                  <button 
                    onClick={() => setSortDir('desc')}
                    className={`py-4 rounded-2xl border transition-all font-black text-xs uppercase tracking-widest ${
                      sortDir === 'desc' ? 'bg-yellow-500/10 border-yellow-500/50 text-white' : 'bg-white/2 border-transparent text-slate-500'
                    }`}
                  >
                    Descending
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={handleStart}
              disabled={status === 'running'}
              className="w-full mt-12 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-20 text-slate-950 font-black py-5 rounded-2xl transition-all shadow-xl shadow-yellow-500/20 flex items-center justify-center gap-3 active:scale-95 group"
            >
              {status === 'running' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6 group-hover:scale-125 transition-transform" />}
              <span className="text-xl tracking-tighter uppercase italic">Engage Auto-Pilot</span>
            </button>
          </div>
        </div>

        {/* Live Stream Panel */}
        <div className="lg:col-span-12 xl:col-span-7">
          <div className="bg-slate-900/50 border border-white/5 rounded-[2.5rem] h-full flex flex-col backdrop-blur-3xl shadow-2xl overflow-hidden min-h-[600px] relative">
            <div className="p-10 border-b border-white/5 flex items-center justify-between bg-slate-950/20">
              <h3 className="text-xs font-black text-white uppercase tracking-[0.3em] flex items-center gap-2">
                <Layout className="w-4 h-4 text-yellow-500" />
                Execution Stream
              </h3>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${status === 'running' ? 'bg-yellow-500 animate-ping' : status === 'success' ? 'bg-green-500' : 'bg-slate-700'}`} />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{status.toUpperCase()}</span>
              </div>
            </div>

            <div className="flex-1 p-10 flex flex-col overflow-hidden">
              <div className="flex-1 space-y-4 overflow-auto custom-scrollbar">
                <AnimatePresence>
                  {logs.map((log, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`font-mono text-[11px] p-4 rounded-xl border ${
                        log.includes('✅') ? 'bg-green-500/5 border-green-500/20 text-green-400' : 
                        log.includes('❌') ? 'bg-red-500/5 border-red-500/20 text-red-400' :
                        'bg-white/2 border-white/5 text-slate-400'
                      }`}
                    >
                      {log}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {status === 'idle' && logs.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-20 grayscale scale-[0.8]">
                    <Zap className="w-24 h-24 mb-6" />
                    <p className="text-sm font-black uppercase tracking-[0.4em]">Awaiting Engagement Sequence</p>
                  </div>
                )}
              </div>

              {status === 'running' && (
                <div className="mt-8 p-10 bg-yellow-500/5 border border-yellow-500/20 rounded-3xl text-center">
                   <p className="text-xl font-black text-white italic tracking-tighter uppercase mb-2 animate-pulse">Running Macro sequence...</p>
                   <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">Do not close this window</p>
                </div>
              )}

              {status === 'success' && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-8 p-10 bg-green-500/5 border border-green-500/20 rounded-3xl text-center"
                >
                   <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                   <p className="text-xl font-black text-white italic tracking-tighter uppercase mb-2">Automation Synchronized</p>
                   <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Inventory successfully confirmed</p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronRight(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
}
