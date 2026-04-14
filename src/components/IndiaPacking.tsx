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
  ChevronRight,
  ShieldCheck,
  RefreshCcw,
  Download,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressStep {
  label: string;
  status: 'pending' | 'loading' | 'done' | 'error';
}

export default function IndiaPacking() {
  const [activeTab, setActiveTab] = useState<'convert' | 'match' | 'verify'>('convert');
  const [file, setFile] = useState<File | null>(null);
  const [secondFile, setSecondFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const [originalPdfFile, setOriginalPdfFile] = useState<File | null>(null);
  const [processingMode, setProcessingMode] = useState<'auto' | 'manual'>('auto');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, num: 1 | 2 = 1) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (num === 1) {
        setFile(selected);
        if (activeTab === 'convert') setOriginalPdfFile(selected);
        setResult(null);
      } else {
        setSecondFile(selected);
        setResult(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, num: 1 | 2 = 1) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      if (num === 1) {
        setFile(selected);
        if (activeTab === 'convert') setOriginalPdfFile(selected);
        setResult(null);
      } else {
        setSecondFile(selected);
        setResult(null);
      }
    }
  };

  const startConversion = async (overrideTab?: string, overrideFile?: File, overrideSecond?: File) => {
    const currentTab = overrideTab || activeTab;
    const currentFile = overrideFile || file;
    const currentSecond = overrideSecond || secondFile;

    if (!currentFile) return;
    setLoading(true);
    setResult(null);
    
    const steps: Record<string, string[]> = {
      convert: ['Cloud Stream Uploading...', 'Deep Parsing & Analyzing...', 'Generating Digital Assets...'],
      match: ['Syncing Master 데이터...', 'Establishing Relationship...', 'Mapping Product Entities...'],
      verify: ['System Snapshot Loading...', 'Quantity Cross-Verification...', 'Generating Audit Report...']
    };

    setProgress(steps[currentTab as string]?.map(s => ({ label: s, status: 'pending' })) || []);

    try {
      setProgress(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'loading' } : s));
      
      const formData = new FormData();
      if (currentTab === 'convert') formData.append('pdf', currentFile);
      else if (currentTab === 'match') formData.append('excel', currentFile);
      else {
        formData.append('pdf', currentFile);
        if (currentSecond) formData.append('excel', currentSecond);
        else throw new Error('검증할 엑셀 파일이 필요합니다.');
      }

      const response = await fetch(`/api/${currentTab}`, { method: 'POST', body: formData });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || '요청 처리에 실패했습니다.');
      }

      setProgress(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'done' } : i === 1 ? { ...s, status: 'loading' } : s));
      await new Promise(r => setTimeout(r, 600));
      
      setProgress(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'done' } : i === 2 ? { ...s, status: 'loading' } : s));
      
      if (currentTab === 'verify') {
        const data = await response.json();
        setProgress(prev => prev.map(s => ({ ...s, status: 'done' })));
        setResult({ success: true, message: '모든 자동화 공정이 완료되었습니다!', stats: data });
        setLoading(false);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const originalBase = (currentFile.name || 'document').split('.').slice(0, -1).join('.');
      
      let fileName = '';
      if (currentTab === 'convert') fileName = `${today}_${originalBase}.xlsx`;
      else if (currentTab === 'match') {
        const pdfBase = originalPdfFile ? originalPdfFile.name.split('.').slice(0, -1).join('.') : originalBase.replace(/^\d{8}_/, '').replace(/_Packing$/, '');
        fileName = `${today}_${pdfBase}_매칭완료.xlsx`;
      }
      
      link.download = fileName;
      setProgress(prev => prev.map(s => ({ ...s, status: 'done' })));
      setResult({ success: true, message: `${currentTab === 'convert' ? 'PDF 변환' : '데이터 매칭'} 완료!`, fileName: fileName });

      link.click();
      window.URL.revokeObjectURL(url);

      if (processingMode === 'auto') {
        const nextFile = new File([blob], fileName, { type: blob.type });
        setTimeout(() => {
          if (currentTab === 'convert') {
            setActiveTab('match');
            setFile(nextFile);
            setResult(null);
            setProgress([]);
            startConversion('match', nextFile);
          } else if (currentTab === 'match') {
            setActiveTab('verify');
            setFile(originalPdfFile);
            setSecondFile(nextFile);
            setResult(null);
            setProgress([]);
            startConversion('verify', originalPdfFile || undefined, nextFile);
          }
        }, 1200);
      } else {
        setLoading(false);
      }

    } catch (err: any) {
      setProgress(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
      setResult({ success: false, message: err.message || '작업 중 오류가 발생했습니다.' });
      setLoading(false);
    }
  };

  const TAB_COLORS: Record<string, string> = {
    convert: 'bg-indigo-600',
    match: 'bg-blue-600',
    verify: 'bg-emerald-600'
  };

  return (
    <div className="animate-in fade-in duration-700">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Category 1</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-700" />
          <div className="px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
             <Zap className="w-3.5 h-3.5 fill-blue-400/20" />
             <span>AI Logistics Core</span>
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4 uppercase leading-none">
          India Packing <span className="text-indigo-400">Converter</span>
        </h1>
        <p className="text-slate-400 max-w-2xl leading-relaxed font-medium">
          인도 패킹리스트 데이터 자동화 시스템. <br className="hidden md:block" />
          AI 기반 추출부터 마스터 매칭까지 원클릭 디지털 업무 환경을 제공합니다.
        </p>
      </header>

      <div className="flex flex-col md:flex-row items-center gap-6 mb-12">
        <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-xl w-full md:w-auto shadow-2xl">
          {[
            { id: 'convert', label: 'PDF 추출', icon: FileText, color: 'indigo' },
            { id: 'match', label: '상품 매칭', icon: LinkIcon, color: 'blue' },
            { id: 'verify', label: '최종 검합', icon: FileCheck, color: 'emerald' },
          ].map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => { setActiveTab(tab.id as any); setFile(null); setResult(null); setProgress([]); }} 
              className={cn(
                "relative flex-1 md:w-32 flex flex-col items-center justify-center gap-1 py-2 px-4 rounded-xl transition-all duration-300",
                activeTab === tab.id 
                  ? `${TAB_COLORS[tab.id]} text-white shadow-lg shadow-indigo-600/20` 
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              )}
            >
              <div className="flex items-center gap-2 font-bold text-[11px]">
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest opacity-40">{tab.id}</span>
            </button>
          ))}
        </div>

        <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-xl shadow-2xl">
          <button 
            onClick={() => setProcessingMode('auto')} 
            className={cn(
              "px-6 py-3 rounded-xl text-[10px] font-black transition-all duration-300 flex items-center gap-2",
              processingMode === 'auto' ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/20" : "text-slate-500 hover:text-slate-400"
            )}
          >
            <Zap className={cn("w-3.5 h-3.5", processingMode === 'auto' ? "fill-white" : "")} />
            지능형 자동
          </button>
          <button 
            onClick={() => setProcessingMode('manual')} 
            className={cn(
              "px-6 py-3 rounded-xl text-[10px] font-black transition-all duration-300 flex items-center gap-2",
              processingMode === 'manual' ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-400"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            단계별 수동
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900/80 border border-white/5 rounded-[2.5rem] p-10 backdrop-blur-3xl shadow-2xl overflow-hidden relative group">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-600/10 blur-[80px] rounded-full group-hover:bg-indigo-600/20 transition-all duration-700" />
            
            <div className="relative z-10 flex flex-col gap-8">
               <div 
                  className={cn(
                    "border-2 border-dashed rounded-[2rem] p-16 text-center cursor-pointer transition-all duration-500 flex flex-col items-center justify-center gap-6",
                    file 
                      ? "border-indigo-500/40 bg-indigo-500/5" 
                      : "border-slate-800 hover:border-indigo-500/30 hover:bg-slate-900/50"
                  )}
                  onClick={() => document.getElementById('file-input-india')?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, 1)}
                >
                  <input id="file-input-india" type="file" className="hidden" onChange={handleFileChange} accept={activeTab === 'match' ? '.xlsx' : '.pdf'} />
                  
                  <AnimatePresence mode="wait">
                    {file ? (
                      <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="space-y-4"
                      >
                         <div className="relative">
                          <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl">
                             <FileText className="text-white w-12 h-12" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-white text-lg font-bold truncate max-w-xs">{file.name}</p>
                          <p className="text-indigo-400 text-xs font-black tracking-widest uppercase">Target Ready</p>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                      >
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                           <Upload className="text-slate-400 w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-white text-xl font-bold tracking-tight">여기에 문서를 드롭하세요</p>
                          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Supports PDF & Excel</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {activeTab === 'verify' && (
                  <div 
                    className={cn(
                      "border-2 border-dashed rounded-[2rem] p-10 text-center cursor-pointer transition-all duration-500 flex items-center justify-center gap-6",
                      secondFile 
                        ? "border-cyan-500/40 bg-cyan-500/5" 
                        : "border-slate-800 hover:border-cyan-500/30"
                    )} 
                    onClick={() => document.getElementById('file-input-india-2')?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, 2)}
                  >
                    <input id="file-input-india-2" type="file" className="hidden" onChange={(e) => handleFileChange(e, 2)} accept=".xlsx" />
                    {secondFile ? (
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-cyan-600 rounded-xl flex items-center justify-center shadow-lg transform -rotate-3"><FileSpreadsheet className="text-white w-6 h-6" /></div>
                        <div className="text-left">
                          <p className="text-white font-bold text-sm truncate max-w-[200px]">{secondFile.name}</p>
                          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest">Excel Asset Loaded</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 py-2 opacity-40">
                        <Download className="w-6 h-6" />
                        <p className="text-sm font-bold">비교 분석할 최종 엑셀을 업로드하세요</p>
                      </div>
                    )}
                  </div>
                )}

                <button 
                  disabled={!file || loading} 
                  onClick={() => startConversion()} 
                  className={cn(
                    "w-full h-20 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.3em] transition-all duration-500 flex items-center justify-center gap-4 group overflow-hidden shadow-2xl relative",
                    !file || loading 
                      ? "bg-slate-800 text-slate-600" 
                      : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:scale-[1.01] text-white"
                  )}
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                      <span>{progress.find(p => p.status === 'loading')?.label || 'Processing...'}</span>
                    </div>
                  ) : (
                    <>
                      <span className="relative z-10">프로세스 실행 (Execute)</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform relative z-10" />
                    </>
                  )}
                </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/50 border border-white/5 rounded-[2rem] p-8 backdrop-blur-2xl shadow-xl flex flex-col min-h-[500px]">
             <div className="flex items-center justify-between mb-10">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" /> 
                  Operational Status
                </h3>
              </div>

              <div className="space-y-8 flex-1">
                {progress.length > 0 ? (
                  progress.map((step, i) => (
                    <div key={i} className="flex items-center gap-5 group">
                       <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 border-2",
                          step.status === 'done' ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : 
                          step.status === 'loading' ? "bg-indigo-500/20 border-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]" : 
                          "bg-slate-800/50 border-slate-700 text-slate-600"
                        )}>
                          {step.status === 'done' ? <CheckCircle2 size={20} /> : 
                           step.status === 'loading' ? <Loader2 size={20} className="animate-spin" /> : 
                           <span className="text-sm font-black">{i + 1}</span>}
                        </div>
                        <div className="flex flex-col">
                           <span className={cn(
                             "text-[13px] font-bold transition-colors",
                             step.status === 'done' ? "text-emerald-400" : 
                             step.status === 'loading' ? "text-white" : "text-slate-600"
                           )}>
                             {step.label}
                           </span>
                           <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-0.5">{step.status}</span>
                        </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 opacity-20 gap-4">
                     <RefreshCcw className="w-10 h-10" />
                     <p className="text-[10px] font-black uppercase tracking-[0.2em]">Awaiting Input</p>
                  </div>
                )}
              </div>

              {result && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "mt-8 p-6 rounded-3xl border-2 transition-all shadow-2xl",
                    result.success ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
                  )}
                >
                   <div className="flex items-center gap-3 mb-3">
                      <div className={cn("p-2 rounded-xl", result.success ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
                        {result.success ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
                      </div>
                      <h4 className="font-black text-xs uppercase tracking-[0.1em]">{result.success ? 'Execution Success' : 'Process Error'}</h4>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-4 leading-relaxed font-bold">{result.message}</p>
                    
                    {result.stats && (
                      <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                         {result.stats.comparisons?.map((c: any, i: number) => (
                           <div key={i} className="bg-slate-900 border border-white/5 p-3 rounded-xl flex flex-col gap-1">
                              <p className="text-white text-[10px] font-black truncate leading-none mb-1">{c.label}</p>
                              <div className="flex justify-between items-center text-[9px] font-bold">
                                 <span className="text-slate-500 uppercase">PDF: <span className="text-slate-300">{c.pdf}</span> | EXC: <span className="text-slate-300">{c.excel}</span></span>
                                 {c.isMatch ? <span className="text-emerald-500">MATCH ✅</span> : <span className="text-rose-500">DIFF ❌</span>}
                              </div>
                           </div>
                         ))}
                      </div>
                    )}
                </motion.div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
