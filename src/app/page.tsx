'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Link as LinkIcon, 
  CheckCircle2, 
  ArrowRight, 
  Upload, 
  FileSpreadsheet, 
  FileCheck, 
  Loader2, 
  AlertCircle,
  Clock,
  Zap,
  Layers,
  Globe,
  Home,
  ChevronRight,
  Download,
  ShieldCheck,
  RefreshCcw
} from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming this exists, or I'll provide a fallback

interface ProgressStep {
  label: string;
  status: 'pending' | 'loading' | 'done' | 'error';
}

export default function PackingListApp() {
  const [activeTab, setActiveTab] = useState<'convert' | 'match' | 'verify'>('convert');
  const [file, setFile] = useState<File | null>(null);
  const [secondFile, setSecondFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const [originalPdfFile, setOriginalPdfFile] = useState<File | null>(null);
  const [processingMode, setProcessingMode] = useState<'auto' | 'manual'>('auto');
  const [autoStartNext, setAutoStartNext] = useState(false);

  useEffect(() => {
    if (processingMode === 'auto' && autoStartNext && !loading) {
      const isVerifyReady = activeTab === 'verify' && (file && secondFile);
      const isOtherReady = activeTab !== 'verify' && !!file;
      
      if (isVerifyReady || isOtherReady) {
        setAutoStartNext(false);
        setTimeout(() => startConversion(), 300);
      }
    }
  }, [file, secondFile, activeTab, autoStartNext, loading, processingMode]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, num: 1 | 2 = 1) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (num === 1) {
        setFile(selected);
        if (activeTab === 'convert') setOriginalPdfFile(selected);
      } else {
        setSecondFile(selected);
      }
    }
  };

  const startConversion = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    
    const steps: Record<string, string[]> = {
      convert: ['문서 서버 업로드 중...', 'AI 데이터 추출 중...', '엑셀 파일 생성 중...'],
      match: ['슈파베이스 마스터 동기화...', '상품 매칭 로직 가동...', '최종 엑셀 리포트 생성...'],
      verify: ['데이터 스냅샷 로딩...', '수량 교차 검증 중...', '최종 리포트 생성 중...']
    };

    setProgress(steps[activeTab].map(s => ({ label: s, status: 'pending' })));

    try {
      setProgress(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'loading' } : s));
      
      const formData = new FormData();
      if (activeTab === 'convert') formData.append('pdf', file);
      else if (activeTab === 'match') formData.append('excel', file);
      else {
        formData.append('pdf', file);
        if (secondFile) formData.append('excel', secondFile);
      }

      const response = await fetch(`/api/${activeTab}`, { method: 'POST', body: formData });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || '요청 처리에 실패했습니다.');
      }

      setProgress(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'done' } : i === 1 ? { ...s, status: 'loading' } : s));
      await new Promise(r => setTimeout(r, 600));
      
      setProgress(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'done' } : i === 2 ? { ...s, status: 'loading' } : s));
      
      if (activeTab === 'verify') {
        const data = await response.json();
        setProgress(prev => prev.map(s => ({ ...s, status: 'done' })));
        setResult({ success: true, message: '수량 검증이 완료되었습니다.', stats: data });
        setLoading(false);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const originalBase = (file.name || 'document').split('.').slice(0, -1).join('.');
      
      let fileName = '';
      if (activeTab === 'convert') {
        fileName = `${today}_${originalBase}.xlsx`;
      } else if (activeTab === 'match') {
        const pdfBase = originalPdfFile ? originalPdfFile.name.split('.').slice(0, -1).join('.') : originalBase.replace(/^\d{8}_/, '').replace(/_Packing$/, '');
        fileName = `${today}_${pdfBase}_매칭완료.xlsx`;
      } else {
        fileName = `${today}_Result.xlsx`;
      }
      
      link.download = fileName;
      setProgress(prev => prev.map(s => ({ ...s, status: 'done' })));
      setResult({ success: true, message: `${activeTab === 'convert' ? 'PDF 변환' : '데이터 매칭'} 완료!`, fileName: fileName });

      link.click();
      window.URL.revokeObjectURL(url);

      const resultFile = new File([blob], fileName, { type: blob.type });
      if (activeTab === 'convert') {
        setTimeout(() => { 
          setFile(resultFile); 
          setActiveTab('match'); 
          setResult(null); 
          setProgress([]); 
          if (processingMode === 'auto') setAutoStartNext(true); 
        }, 1200);
      } else if (activeTab === 'match') {
        setTimeout(() => { 
          setActiveTab('verify'); 
          setFile(originalPdfFile); 
          setSecondFile(resultFile); 
          setResult(null); 
          setProgress([]); 
          if (processingMode === 'auto') setAutoStartNext(true); 
        }, 1200);
      }

    } catch (err: any) {
      setProgress(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
      setResult({ success: false, message: err.message || '작업 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 blur-[150px] rounded-full animate-pulse delay-1000" />
        <div className="absolute top-[30%] left-[20%] w-[20%] h-[20%] bg-purple-600/5 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 md:py-20">
        {/* Header Section */}
        <header className="mb-16">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center space-y-4"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
              <Zap className="w-3.5 h-3.5 fill-indigo-400/20" />
              <span>Next-Gen Logistics Intelligence</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white uppercase sm:leading-none">
              India Packing <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-blue-400">Hub</span>
            </h1>
            
            <p className="text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed font-medium">
              인도 현지 패킹리스트의 스마트 디지털 전환. <br className="hidden md:block" />
              수파베이스 클라우드 마스터 데이터와 실시간 동기화로 정확도를 극대화합니다.
            </p>
          </motion.div>
        </header>

        {/* Navigation & Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-xl w-full md:w-auto shadow-2xl">
            {[
              { id: 'convert', label: 'PDF 추출', icon: FileText, color: 'indigo' },
              { id: 'match', label: '상품 매칭', icon: LinkIcon, color: 'blue' },
              { id: 'verify', label: '데이터 검합', icon: FileCheck, color: 'emerald' },
            ].map((tab) => (
              <button 
                key={tab.id} 
                onClick={() => { setActiveTab(tab.id as any); setFile(null); setResult(null); }} 
                className={cn(
                  "relative flex-1 md:w-36 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all duration-300 font-bold text-sm",
                  activeTab === tab.id 
                    ? `bg-${tab.color}-600 text-white shadow-lg shadow-${tab.color}-600/20` 
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                )}
              >
                <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-white" : `text-slate-500`)} />
                <span>{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div layoutId="tab-active" className="absolute inset-0 bg-white/10 rounded-xl" />
                )}
              </button>
            ))}
          </div>

          <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-xl shadow-2xl">
            <button 
              onClick={() => setProcessingMode('auto')} 
              className={cn(
                "px-6 py-3 rounded-xl text-xs font-black transition-all duration-300 flex items-center gap-2",
                processingMode === 'auto' ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/20" : "text-slate-500"
              )}
            >
              <Zap className={cn("w-3.5 h-3.5", processingMode === 'auto' ? "fill-white" : "")} />
              지능형 자동
            </button>
            <button 
              onClick={() => setProcessingMode('manual')} 
              className={cn(
                "px-6 py-3 rounded-xl text-xs font-black transition-all duration-300 flex items-center gap-2",
                processingMode === 'manual' ? "bg-slate-700 text-white" : "text-slate-500"
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              단계별 수동
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Dropzone Area */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-8 space-y-6"
          >
            <div className="group relative bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-white/5 rounded-[2.5rem] p-10 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                {activeTab === 'convert' ? <FileText size={120} /> : activeTab === 'match' ? <FileSpreadsheet size={120} /> : <ShieldCheck size={120} />}
              </div>

              <div className="relative z-10">
                <div 
                  className={cn(
                    "border-2 border-dashed rounded-[2rem] p-16 text-center cursor-pointer transition-all duration-500 flex flex-col items-center justify-center gap-6",
                    file 
                      ? "border-indigo-500/40 bg-indigo-500/5" 
                      : "border-slate-800 hover:border-indigo-500/30 hover:bg-slate-900/50"
                  )}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <input id="file-input" type="file" className="hidden" onChange={handleFileChange} accept={activeTab === 'match' ? '.xlsx' : '.pdf'} />
                  
                  <AnimatePresence mode="wait">
                    {file ? (
                      <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="space-y-4"
                      >
                        <div className="relative">
                          <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl overflow-hidden">
                            <motion.div
                              animate={{ y: [0, -5, 0] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              {activeTab === 'match' ? <FileSpreadsheet className="text-white w-12 h-12" /> : <FileText className="text-white w-12 h-12" />}
                            </motion.div>
                          </div>
                          <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-[#0F172A] text-white">
                            <CheckCircle2 size={16} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-white text-lg font-bold truncate max-w-xs">{file.name}</p>
                          <p className="text-indigo-400 text-xs font-medium">READY TO PROCESS</p>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                      >
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto shadow-inner">
                          <Upload className="text-slate-400 w-8 h-8" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-white text-xl font-bold tracking-tight">여기에 문서를 드롭하세요</p>
                          <p className="text-slate-500 text-sm font-medium">또는 클릭하여 {activeTab === 'match' ? '엑셀' : 'PDF'} 업로드</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {activeTab === 'verify' && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mt-6"
                  >
                    <div 
                      className={cn(
                        "border-2 border-dashed rounded-[2rem] p-12 text-center cursor-pointer transition-all duration-500 flex items-center justify-center gap-6",
                        secondFile 
                          ? "border-cyan-500/40 bg-cyan-500/5 text-white" 
                          : "border-slate-800 hover:border-cyan-500/30 text-slate-400"
                      )} 
                      onClick={() => document.getElementById('file-input-2')?.click()}
                    >
                      <input id="file-input-2" type="file" className="hidden" onChange={(e) => handleFileChange(e, 2)} accept=".xlsx" />
                      {secondFile ? (
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-cyan-600 rounded-xl flex items-center justify-center shadow-lg"><FileSpreadsheet className="text-white w-6 h-6" /></div>
                          <div className="text-left">
                            <p className="font-bold text-sm truncate max-w-[200px]">{secondFile.name}</p>
                            <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Matched Excel Loaded</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 py-2">
                          <Download className="w-6 h-6 opacity-30" />
                          <p className="text-sm font-bold">비교 대상 엑셀 파일을 업로드하세요</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                <button 
                  disabled={!file || loading} 
                  onClick={startConversion} 
                  className={cn(
                    "w-full mt-8 h-20 rounded-3xl font-black text-sm uppercase tracking-[0.2em] transition-all duration-500 flex items-center justify-center gap-4 group overflow-hidden shadow-2xl relative",
                    !file || loading 
                      ? "bg-slate-800 text-slate-600 cursor-not-allowed" 
                      : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:scale-[1.02] active:scale-95 text-white"
                  )}
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>{progress.find(p => p.status === 'loading')?.label || '처리 중...'}</span>
                    </div>
                  ) : (
                    <>
                      <span className="relative z-10">프로세스 실행 (EXECUTE)</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform relative z-10" />
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Side Info Panel */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-4 space-y-8"
          >
            {/* Status Card */}
            <div className="bg-slate-900/50 border border-white/5 rounded-[2rem] p-8 backdrop-blur-2xl shadow-xl min-h-[400px]">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" /> 
                  Process Status
                </h3>
                {loading && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />}
              </div>
              
              <div className="space-y-6">
                <AnimatePresence>
                  {progress.length > 0 ? (
                    progress.map((step, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={i} 
                        className="flex items-center gap-5 group"
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 border-2",
                          step.status === 'done' ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400" : 
                          step.status === 'loading' ? "bg-indigo-500/20 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]" : 
                          "bg-slate-800/50 border-slate-700 text-slate-600"
                        )}>
                          {step.status === 'done' ? <CheckCircle2 size={20} /> : 
                           step.status === 'loading' ? <Loader2 size={20} className="animate-spin" /> : 
                           <span className="text-sm font-bold">{i + 1}</span>}
                        </div>
                        <div className="flex flex-col">
                          <span className={cn(
                            "text-sm font-bold transition-colors",
                            step.status === 'done' ? "text-emerald-400" : 
                            step.status === 'loading' ? "text-white" : "text-slate-600"
                          )}>
                            {step.label}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{step.status}</span>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center gap-4 text-center opacity-30">
                      <RefreshCcw className="w-8 h-8" />
                      <p className="text-xs font-bold leading-relaxed px-8">작업을 기다리고 있습니다. 문서를 업로드해보세요.</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Result Summary */}
              {result && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "mt-10 p-6 rounded-3xl border-2 shadow-2xl overflow-hidden relative",
                    result.success ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
                  )}
                >
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn("p-2 rounded-xl", result.success ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
                        {result.success ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
                      </div>
                      <h4 className="font-black text-sm uppercase tracking-wider">{result.success ? '작업 성공' : '작업 오류'}</h4>
                    </div>
                    <p className="text-xs text-slate-300 mb-4 font-medium leading-relaxed">{result.message}</p>
                    
                    {result.fileName && (
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileSpreadsheet className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                          <span className="text-[10px] font-bold text-white truncate">{result.fileName}</span>
                        </div>
                      </div>
                    )}

                    {result.stats && (
                      <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {result.stats.comparisons?.map((c: any, i: number) => (
                          <div key={i} className="text-[10px] p-3 bg-slate-900 border border-white/5 rounded-xl flex flex-col gap-1 hover:border-white/10 transition-colors">
                            <p className="text-white font-bold truncate leading-none mb-1">{c.label}</p>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 uppercase tracking-tighter">PDF: <span className="text-slate-300">{c.pdf}</span> | EXC: <span className="text-slate-300">{c.excel}</span></span>
                              {c.isMatch ? 
                                <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">MATCH</span> : 
                                <span className="bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">DIFF</span>
                              }
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Quick Tips */}
            <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-[2rem] p-6 backdrop-blur-xl">
               <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                 <Globe size={14} /> Quick System Tips
               </h4>
               <ul className="space-y-3">
                 {[
                   "PDF 원본 문석 형식을 유지하세요.",
                   "지능형 자동 모드는 매칭과 검합을 자동으로 연계합니다.",
                   "미매칭 상품은 엑셀 파일 내 적색으로 표시됩니다."
                 ].map((tip, i) => (
                   <li key={i} className="flex gap-3 text-[10px] text-slate-400 font-medium">
                     <span className="text-indigo-500 mt-1">•</span>
                     <span>{tip}</span>
                   </li>
                 ))}
               </ul>
            </div>
          </motion.div>
        </div>
      </div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.4);
        }
      `}</style>
    </main>
  );
}


