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
  Loader2, 
  AlertCircle,
  Clock,
  Zap,
  Layers,
  Globe,
  Home,
  ChevronRight
} from 'lucide-react';

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
      convert: ['문서 서버 업로드 중...', 'AI 데이터 추출 중...', '엑셀 자산 생성 중...'],
      match: ['슈파베이스 마스터 동기화...', '상품 매칭 로직 가동...', '색상 번역 및 맵핑...'],
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
        const pdfBase = originalPdfFile ? originalPdfFile.name.split('.').slice(0, -1).join('.') : originalBase.replace(/^\d{8}_/, '').replace(/_Packing$/, '');
        fileName = `${today}_${pdfBase}_매칭완료.xlsx`;
      } else {
        fileName = `${today}_Result.xlsx`;
      }
      
      link.download = fileName;
      setProgress(prev => prev.map(s => ({ ...s, status: 'done' })));
      setResult({ success: true, message: `${activeTab === 'convert' ? 'PDF 변환' : '데이터 매칭'} 완료!`, filePath: fileName });

      link.click();
      window.URL.revokeObjectURL(url);

      const resultFile = new File([blob], fileName, { type: blob.type });
      if (activeTab === 'convert') {
        setTimeout(() => { setFile(resultFile); setActiveTab('match'); setResult(null); setProgress([]); if (processingMode === 'auto') setAutoStartNext(true); }, 1500);
      } else if (activeTab === 'match') {
        setTimeout(() => { setActiveTab('verify'); setFile(originalPdfFile); setSecondFile(resultFile); setResult(null); setProgress([]); if (processingMode === 'auto') setAutoStartNext(true); }, 1500);
      }

    } catch (err: any) {
      setProgress(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
      setResult({ success: false, message: err.message || '작업 실패' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0F172A] text-slate-200 font-sans p-6 md:p-12">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        <header className="mb-12 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest mb-4">
                <Zap className="w-3 h-3 fill-current" />
                <span>AI 기반 클라우드 물류 허브</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-4 uppercase">
                INDIA PACKING <span className="text-indigo-400">CONVERTER</span>
            </h1>
            <p className="text-slate-400 max-w-2xl mx-auto leading-relaxed italic">
                인도 현지 패킹리스트의 디지털 전환. 수파베이스 마스터 데이터와 100% 동기화됩니다.
            </p>
        </header>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-12">
          <div className="flex bg-slate-800/40 p-1 rounded-xl border border-white/5 backdrop-blur-md w-full max-w-md">
            {[
              { id: 'convert', label: '추출', sub: 'Convert', icon: FileText },
              { id: 'match', label: '매칭', sub: 'Match', icon: LinkIcon },
              { id: 'verify', label: '검합', sub: 'Verify', icon: FileCheck },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                <div className="flex items-center gap-1.5 font-bold text-[11px]"><tab.icon className="w-3.5 h-3.5" /><span>{tab.label}</span></div>
                <span className="text-[8px] font-medium opacity-50">{tab.sub}</span>
              </button>
            ))}
          </div>
          <div className="flex bg-slate-800/40 p-1 rounded-xl border border-white/5">
            <button onClick={() => setProcessingMode('auto')} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${processingMode === 'auto' ? 'bg-cyan-600 text-white' : 'text-slate-600'}`}>지능형 자동</button>
            <button onClick={() => setProcessingMode('manual')} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${processingMode === 'manual' ? 'bg-slate-700 text-white' : 'text-slate-600'}`}>단계별 수동</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3 space-y-6">
                <div className="bg-slate-800/40 border border-white/5 rounded-3xl p-8 backdrop-blur-2xl">
                    <div 
                        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${file ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-white/5 hover:border-indigo-500/30'}`}
                        onClick={() => document.getElementById('file-input')?.click()}
                    >
                        <input id="file-input" type="file" className="hidden" onChange={handleFileChange} accept={activeTab === 'match' ? '.xlsx' : '.pdf'} />
                        {file ? (
                            <div className="space-y-4">
                                <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto shadow-2xl"><FileText className="text-white w-8 h-8" /></div>
                                <p className="text-white text-sm font-bold truncate">{file.name}</p>
                            </div>
                        ) : (
                            <div className="py-4 space-y-4">
                                <Upload className="text-slate-500 w-8 h-8 mx-auto" />
                                <p className="text-slate-300 text-sm font-bold">문서를 업로드하세요</p>
                            </div>
                        )}
                    </div>

                    {activeTab === 'verify' && (
                        <div className={`mt-4 border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${secondFile ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-white/5'}`} onClick={() => document.getElementById('file-input-2')?.click()}>
                            <input id="file-input-2" type="file" className="hidden" onChange={(e) => handleFileChange(e, 2)} accept=".xlsx" />
                            {secondFile ? (
                                <div className="space-y-4">
                                    <div className="w-16 h-16 bg-cyan-600 rounded-xl flex items-center justify-center mx-auto shadow-2xl"><FileSpreadsheet className="text-white w-8 h-8" /></div>
                                    <p className="text-white text-sm font-bold truncate">{secondFile.name}</p>
                                </div>
                            ) : (
                                <p className="text-slate-300 text-sm font-bold">비교할 엑셀 파일을 업로드하세요</p>
                            )}
                        </div>
                    )}

                    <button disabled={!file || loading} onClick={startConversion} className="w-full mt-6 h-16 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>프로세스 실행 (EXECUTE)</span><ArrowRight className="w-4 h-4" /></>}
                    </button>
                </div>
            </div>

            <div className="lg:col-span-2">
                <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-6 backdrop-blur-xl h-full">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2"><Clock className="w-4 h-4" /> STATUS</h3>
                    <div className="space-y-4">
                        {progress.map((step, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${step.status === 'done' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : step.status === 'loading' ? 'border-indigo-400 animate-pulse' : 'border-slate-700'}`}>
                                    {step.status === 'done' ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                                </div>
                                <span className={`text-xs font-medium ${step.status === 'done' ? 'text-indigo-400' : 'text-slate-500'}`}>{step.label}</span>
                            </div>
                        ))}
                    </div>

                    {result && (
                        <div className="mt-8 p-4 rounded-xl bg-slate-800 border border-white/10">
                            <h4 className="font-bold text-sm mb-2">{result.success ? '성공' : '실패'}</h4>
                            <p className="text-xs text-slate-400 mb-4">{result.message}</p>
                            {result.stats && (
                                <div className="max-h-60 overflow-y-auto space-y-2">
                                    {result.stats.comparisons.map((c: any, i: number) => (
                                        <div key={i} className="text-[10px] p-2 bg-black/20 rounded">
                                            <p className="text-white truncate">{c.label}</p>
                                            <p className="text-slate-500">PDF: {c.pdf} | Excel: {c.excel} {c.isMatch ? '✅' : '❌'}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </main>
  );
}
