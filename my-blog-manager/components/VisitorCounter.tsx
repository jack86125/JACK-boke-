"use client";

import { useEffect, useRef, useState } from 'react';

// 🌟 访客计数小组件:毛玻璃徽章风格,与底部技术栈徽章一致
// XHBlogs 首页(真实访客访问)→ POST 每次访问 +1
// 后台控制台预览 → readonly 只读展示,不虚增计数
export default function VisitorCounter({ readonly = false }: { readonly?: boolean }) {
  const [count, setCount] = useState<number | null>(null);
  const countedRef = useRef(false);

  useEffect(() => {
    // 🌟 StrictMode 双调用防护:同一组件实例只计数一次
    if (!readonly && countedRef.current) return;
    countedRef.current = true;

    (async () => {
      try {
        const res = await fetch('/api/visitor', {
          method: readonly ? 'GET' : 'POST',
          cache: 'no-store',
        });
        const data = await res.json();
        if (data.success) setCount(data.count);
      } catch {
        // 计数失败静默处理,绝不影响页面其他功能
      }
    })();
  }, [readonly]);

  return (
    <span className="px-2 py-1 bg-white/50 dark:bg-slate-700/50 rounded-md shadow-sm flex items-center gap-1 border border-white/40 dark:border-slate-600">
      <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
      <span>访问量 {count === null ? '···' : count}</span>
    </span>
  );
}
