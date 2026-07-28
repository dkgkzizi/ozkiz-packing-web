'use client';

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { Loader2 } from 'lucide-react';

export default function Manual() {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/manual/MANUAL.md')
      .then((res) => {
        if (!res.ok) throw new Error('매뉴얼 파일을 불러오지 못했습니다.');
        return res.text();
      })
      .then(setContent)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <header className="mb-8 flex items-center gap-3">
        <div className="w-1.5 h-9 bg-red-600 rounded-full" />
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">사용 매뉴얼</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            업로드부터 수동 교정, 서명, 파레트 출력까지 — 처음 쓰시는 분도 이 문서만 보면 됩니다
          </p>
        </div>
      </header>

      <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="p-10 md:p-14 max-w-3xl mx-auto">
          {error && (
            <p className="text-red-600 text-sm font-bold">{error}</p>
          )}
          {!content && !error && (
            <div className="flex items-center gap-3 text-slate-400 text-sm font-bold py-20 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              매뉴얼을 불러오는 중...
            </div>
          )}
          {content && (
            <article className="manual-prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>{content}</ReactMarkdown>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
