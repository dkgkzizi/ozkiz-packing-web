'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Link as LinkIcon, 
  CheckCircle2, 
  ArrowRight, 
  Upload, 
  FileSpreadsheet, 
  FileCheck, 
  Download, 
  Loader2, 
  AlertCircle,
  Clock,
  Zap,
  ChevronRight
} from 'lucide-react';

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
  const [autoStartNext, setAutoStartNext] = useState(false);

  React.useEffect(() => {
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
      convert: ['Cloud Stream Uploading...', 'Deep Parsing & Analyzing...', 'Generating Digital Assets...'],
      match: ['Syncing Master Data...', 'Establishing Relationship...', 'Mapping Product Entities...'],
      verify: ['System Snapshot Loading...', 'Quantity Cross-Verification...', 'Generating Audit Report...']
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

      const endpoint = `/api/${activeTab}`;
      const response = await fetch(endpoint, { method: 'POST', body: formData });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || '요청 처리에 실패했습니다.');
      }

      setProgress(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'done' } : i === 1 ? { ...s, status: 'loading' } : s));
      await new Promise(r => setTimeout(r, 800));
      
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
        const pdfBase = originalPdfFile 
          ? originalPdfFile.name.split('.').slice(0, -1).join('.') 
          : originalBase.replace(/^\d{8}_/, '').replace(/_Packing$/, '');
        fileName = `${today}_${pdfBase}_매칭완료.xlsx`;
      } else {
        fileName = `${today}_Result.xlsx`;
      }
      
      link.download = fileName;
      setProgress(prev => prev.map(s => ({ ...s, status: 'done' })));
      setResult({ 
        success: true, 
        message: `${activeTab === 'convert' ? 'PDF 변환' : '데이터 매칭'}이 성공적으로 완료되었습니다!`,
        filePath: fileName 
      });

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
        }, 1500);
      } else if (activeTab === 'match') {
        setTimeout(() => {
          setActiveTab('verify');
          setFile(originalPdfFile);
          setSecondFile(resultFile);
          setResult(null);
          setProgress([]);
          if (processingMode === 'auto') setAutoStartNext(true);
        }, 1500);
      }

    } catch (err: any) {
      setProgress(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
      setResult({ success: false, message: err.message || '작업 도중 예상치 못한 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-700">
      {/* Header */}
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest">
            CATEGORY 1
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <div className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-3 h-3 fill-current" />
            <span>AI 기반 클라우드 물류 시스템</span>
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-4 uppercase">
          INDIA PACKING <span className="text-indigo-400">CONVERTER</span>
        </h1>
        <p className="text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
          인도 현지 패킹리스트의 디지털 전환. AI 데이터 추출부터 구글 시트 마스터 매칭까지 원클릭으로 완료하세요.
        </p>
      </header>

      {/* Tab Switcher & Mode Toggle */}
      <div className="flex flex-col md:flex-row items-center gap-4 mb-12">
        <div className="flex bg-slate-800/40 p-1 rounded-xl border border-white/5 backdrop-blur-md w-full max-w-md shadow-2xl">
          {[
            { id: 'convert', label: '데이터 추출', sub: 'Convert', icon: FileText },
            { id: 'match', label: '마스터 매칭', sub: 'Match', icon: LinkIcon },
            { id: 'verify', label: '최종 검합', sub: 'Verify', icon: FileCheck },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-lg transition-all duration-300 ${
                activeTab === tab.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-[11px]">
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </div>
              <span className={`text-[8px] font-medium opacity-50 ${activeTab === tab.id ? 'text-white' : 'text-slate-500'}`}>{tab.sub}</span>
            </button>
          ))}
        </div>

        <div className="flex bg-slate-800/40 p-1 rounded-xl border border-white/5 backdrop-blur-md shadow-2xl">
          <button
            onClick={() => setProcessingMode('auto')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black tracking-tighter transition-all ${
              processingMode === 'auto' 
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30' 
                : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            지능형 자동 실행
          </button>
          <button
            onClick={() => setProcessingMode('manual')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black tracking-tighter transition-all ${
              processingMode === 'manual' 
                ? 'bg-slate-700 text-white shadow-inner' 
                : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            단계별 수동 제어
          </button>
        </div>
      </div>

      {/* Main Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-slate-800/40 border border-white/5 rounded-3xl p-8 backdrop-blur-2xl shadow-3xl">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
              {activeTab === 'convert' && <><FileText className="w-4 h-4 text-indigo-400" /> 원본 문서 분석 (Source PDF)</>}
              {activeTab === 'match' && <><FileSpreadsheet className="w-4 h-4 text-indigo-400" /> 데이터 아카이브 (Excel)</>}
              {activeTab === 'verify' && <><FileCheck className="w-4 h-4 text-indigo-400" /> 시스템 검합 및 검증 (Audit)</>}
            </h2>

            <div className="space-y-6">
              <div 
                className={`relative group border-2 border-dashed rounded-2xl p-12 transition-all duration-500 text-center cursor-pointer ${
                  file ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-white/5 hover:border-indigo-500/30 hover:bg-white/5'
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files[0]) {
                    const dropped = e.dataTransfer.files[0];
                    setFile(dropped);
                    if (activeTab === 'convert') setOriginalPdfFile(dropped);
                  }
                }}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input id="file-input" type="file" className="hidden" onChange={handleFileChange} accept={activeTab === 'match' ? '.xlsx' : '.pdf'} />
                
                {file ? (
                  <div className="space-y-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto shadow-2xl rotate-3 group-hover:rotate-0 transition-transform duration-500">
                      {activeTab === 'convert' ? <FileText className="text-white w-10 h-10" /> : <FileSpreadsheet className="text-white w-10 h-10" />}
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold truncate max-w-xs mx-auto mb-1">{file.name}</p>
                      <p className="text-slate-500 text-[10px] font-mono tracking-tighter uppercase font-bold">READY FOR PROCESSING • {(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 space-y-4">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 group-hover:bg-indigo-500/10 transition-all duration-500">
                      <Upload className="text-slate-500 w-6 h-6 group-hover:text-indigo-400" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-300 text-sm font-extrabold italic tracking-tight">드래그하거나 문서를 탐색하여 업로드하세요</p>
                      <p className="text-slate-500 text-[10px] font-medium uppercase tracking-widest">Supports PDF / Max 50MB</p>
                    </div>
                  </div>
                )}
              </div>

              {activeTab === 'verify' && (
                 <div 
                 className={`relative group border-2 border-dashed rounded-2xl p-12 transition-all duration-500 text-center cursor-pointer ${
                   secondFile ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-white/5 hover:border-cyan-500/30 hover:bg-white/5'
                 }`}
                 onDragOver={(e) => e.preventDefault()}
                 onDrop={(e) => {
                   e.preventDefault();
                   if (e.dataTransfer.files[0]) setSecondFile(e.dataTransfer.files[0]);
                 }}
                 onClick={() => document.getElementById('file-input-2')?.click()}
               >
                 <input id="file-input-2" type="file" className="hidden" onChange={(e) => handleFileChange(e, 2)} accept=".xlsx" />
                 
                 {secondFile ? (
                   <div className="space-y-4">
                     <div className="w-20 h-20 bg-gradient-to-br from-cyan-600 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto shadow-2xl -rotate-3 group-hover:rotate-0 transition-transform duration-500">
                       <FileSpreadsheet className="text-white w-10 h-10" />
                     </div>
                     <div>
                       <p className="text-white text-sm font-bold truncate max-w-xs mx-auto mb-1">{secondFile.name}</p>
                       <p className="text-slate-500 text-[10px] font-mono tracking-tighter uppercase font-bold">ARCHIVE LOADED • {(secondFile.size / 1024).toFixed(1)} KB</p>
                     </div>
                   </div>
                 ) : (
                   <div className="py-4 space-y-4">
                     <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 group-hover:bg-cyan-500/10 transition-all duration-500">
                       <FileSpreadsheet className="text-slate-500 w-6 h-6 group-hover:text-cyan-400" />
                     </div>
                     <div className="space-y-1">
                       <p className="text-slate-300 text-sm font-extrabold italic tracking-tight">비교 분석할 데이터 시트를 추가하세요</p>
                       <p className="text-slate-500 text-[10px] font-medium uppercase tracking-widest">Excel Assets Only</p>
                     </div>
                   </div>
                 )}
               </div>
              )}

              <button
                disabled={!file || loading}
                onClick={startConversion}
                className="w-full h-16 bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-500 hover:from-indigo-600 hover:to-indigo-400 disabled:from-slate-800 disabled:to-slate-800 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-indigo-500/20 transition-all duration-500 flex items-center justify-center gap-4 overflow-hidden group border border-white/10"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span className="font-bold underline underline-offset-4 decoration-indigo-400/50">
                      {activeTab === 'convert' ? '추출 프로세스 실행 (Execute)' : activeTab === 'match' ? '매칭 프로세스 실행 (Execute)' : '시스템 검증 프로세스 실행 (Execute)'}
                    </span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform duration-500" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-xl h-full flex flex-col shadow-2xl">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" /> OPERATIONAL STATUS
            </h3>
            
            {progress.length === 0 && !result && (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 py-12">
                 <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mb-3">
                   <Clock className="w-6 h-6 text-slate-500" />
                 </div>
                 <p className="text-sm text-slate-500 font-medium">대기 중인 작업이 없습니다</p>
              </div>
            )}

            <div className="space-y-4 flex-1">
              {progress.map((step, idx) => (
                <div key={idx} className="flex items-center gap-4 group">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    step.status === 'done' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' :
                    step.status === 'loading' ? 'border-indigo-400 text-indigo-400 animate-pulse' :
                    step.status === 'error' ? 'border-red-500 text-red-500 bg-red-500/10' :
                    'border-slate-700 text-slate-700'
                  }`}>
                    {step.status === 'done' ? <CheckCircle2 className="w-5 h-5" /> : 
                     step.status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                     step.status === 'error' ? '✕' : idx + 1}
                  </div>
                  <span className={`text-sm font-medium ${
                    step.status === 'done' ? 'text-indigo-400' :
                    step.status === 'loading' ? 'text-white' : 
                    step.status === 'error' ? 'text-red-400' : 'text-slate-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {result && (
              <div className={`mt-8 p-6 rounded-xl border animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden ${
                result.success ? 'bg-slate-800/60 border-indigo-500/30' : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {result.success ? <CheckCircle2 className="w-6 h-6 text-indigo-400" /> : <AlertCircle className="w-6 h-6 text-red-400" />}
                  <h4 className={`font-bold ${result.success ? 'text-indigo-400' : 'text-red-400'}`}>
                    {result.success ? (activeTab === 'verify' ? '검증 완료' : '작업 완료') : '작업 실패'}
                  </h4>
                </div>
                <p className="text-sm text-slate-300 mb-4 leading-relaxed">{result.message}</p>
                
                {result.stats && activeTab === 'verify' && (
                  <div className="space-y-4">
                    <div className="bg-slate-900/80 rounded-lg p-4 border border-white/10 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                      <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">상세 항목별 분석</h5>
                      <div className="space-y-3">
                        {result.stats.comparisons.map((c: any, i: number) => (
                          <div key={i} className="flex flex-col py-2 border-b border-white/10 last:border-none">
                            <div className="flex items-start justify-between gap-4">
                              <span className="text-[11px] text-slate-200 font-medium leading-relaxed break-all">
                                {c.label}
                              </span>
                              {c.isMatch ? (
                                <div className="shrink-0 w-5 h-5 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center text-[10px] font-bold border border-indigo-500/20">O</div>
                              ) : (
                                <div className="shrink-0 w-5 h-5 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center text-[10px] font-bold border border-red-500/20">X</div>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-white/5">
                              <div className="flex items-baseline gap-1">
                                <span className="text-[9px] text-slate-500">PDF:</span>
                                <span className="text-[10px] text-slate-300 font-mono">{c.pdf}</span>
                              </div>
                              <div className="w-[1px] h-2 bg-slate-700" />
                              <div className="flex items-baseline gap-1">
                                <span className="text-[9px] text-slate-500">엑셀:</span>
                                <span className="text-[10px] text-slate-300 font-mono">{c.excel}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={`p-4 rounded-lg flex flex-col gap-1 border ${
                      result.stats.pdfTotal === result.stats.excelTotal ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-red-500/10 border-red-500/20'
                    }`}>
                       <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">전체 총 수량</span>
                          <span className={`text-sm font-bold ${result.stats.pdfTotal === result.stats.excelTotal ? 'text-indigo-400' : 'text-red-500'}`}>
                            {result.stats.pdfTotal === result.stats.excelTotal 
                              ? `일치 (${result.stats.pdfTotal}개)` 
                              : `불일치 (PDF:${result.stats.pdfTotal} vs 엑셀:${result.stats.excelTotal})`
                            }
                          </span>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
