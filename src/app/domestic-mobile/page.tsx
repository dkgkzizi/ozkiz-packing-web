'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, CheckCircle2, Loader2, RotateCcw, ArrowLeft, ImageUp } from 'lucide-react';

type UploadedItem = {
  id: number;
  file_name: string;
};

export default function DomesticMobileCapture() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const onSelect = (f: File | null) => {
    setError(null);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const reset = () => {
    onSelect(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'domestic');
      const res = await fetch('/api/mobile-upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '업로드 실패');
      setUploaded(prev => [{ id: data.id, file_name: file.name }, ...prev]);
      reset();
    } catch (e: any) {
      setError(e.message || '업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="p-5 flex items-center justify-between bg-white border-b border-slate-200">
        <Link href="/" className="flex items-center gap-1.5 text-slate-400 text-xs font-bold">
          <ArrowLeft className="w-4 h-4" /> PC 버전으로
        </Link>
        <h1 className="text-lg font-black tracking-tight">
          <span className="text-red-600">OH!</span> <span className="text-slate-900">Packing</span>
        </h1>
      </header>

      <main className="flex-1 p-5 flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-black text-slate-900">국내 패킹리스트 촬영</h2>
          <p className="text-xs text-slate-400 font-medium mt-1">
            패킹리스트를 촬영해서 업로드하면, PC에서 목록에 나타나 동기화할 수 있어요
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onSelect(e.target.files?.[0] || null)}
        />

        {!preview ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex-1 min-h-[320px] rounded-[2rem] border-2 border-dashed border-slate-200 bg-white flex flex-col items-center justify-center gap-4 active:scale-[0.98] transition-transform"
          >
            <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center">
              <Camera className="w-10 h-10 text-red-600" />
            </div>
            <span className="text-base font-bold text-slate-900">눌러서 촬영하기</span>
          </button>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            <div className="rounded-[2rem] overflow-hidden border border-slate-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="촬영된 패킹리스트" className="w-full h-auto max-h-[50vh] object-contain" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={reset}
                disabled={uploading}
                className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <RotateCcw className="w-4 h-4" /> 다시 찍기
              </button>
              <button
                onClick={upload}
                disabled={uploading}
                className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageUp className="w-4 h-4" />}
                업로드
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4">{error}</p>
        )}

        {uploaded.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-[2rem] p-5">
            <p className="text-xs font-bold text-slate-400 mb-3">이번에 업로드한 사진 ({uploaded.length}장)</p>
            <ul className="space-y-2">
              {uploaded.map((u) => (
                <li key={u.id} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="truncate">{u.file_name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
