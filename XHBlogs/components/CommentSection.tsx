"use client";

// 🌟 自建评论系统共享组件(Upstash Redis,游客免登录,2026-08)
// 两个变体:
//   default = 文章/杂谈页:毛玻璃卡片 + 顶部光晕 + 标题 + 完整表单
//   moment  = 说说页:紧凑单行表单 + 微信朋友圈风列表(外层 MomentList 已有浅色盒子)
import { useEffect, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';

interface Comment {
  id: string;
  page: string;
  name: string;
  content: string;
  website?: string;
  time: string;
}

interface CommentSectionProps {
  pageKey: string;
  variant?: 'default' | 'moment';
}

// 🌟 首字母头像取色:8 色调色板按名字字符码求和取模,同一个名字颜色稳定
const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-pink-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-sky-500', 'bg-violet-500', 'bg-rose-500', 'bg-teal-500',
];

function avatarColor(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function firstChar(name: string): string {
  return (name.trim().charAt(0) || '?').toUpperCase();
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return new Date(then).toLocaleDateString('zh-CN');
}

export default function CommentSection({ pageKey, variant = 'default' }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState(''); // 🌟 蜜罐:隐藏字段,机器人会填

  useEffect(() => {
    // 🌟 读取本地记住的昵称/网址(SSR 安全:只在客户端读 localStorage)
    try {
      setName(localStorage.getItem('blog-comment-name') || '');
      setWebsite(localStorage.getItem('blog-comment-website') || '');
    } catch {
      /* ignore */
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/comments?page=${encodeURIComponent(pageKey)}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setComments(data.comments || []);
        } else {
          setNotice({ type: 'error', text: data.message || '评论加载失败' });
        }
      })
      .catch(() => {
        if (!cancelled) setNotice({ type: 'error', text: '评论加载失败,请刷新重试' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageKey]);

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedContent = content.trim();
    if (!trimmedName) {
      setNotice({ type: 'error', text: '请先填写昵称' });
      return;
    }
    if (trimmedName.length > 20) {
      setNotice({ type: 'error', text: '昵称最长 20 个字符' });
      return;
    }
    if (!trimmedContent) {
      setNotice({ type: 'error', text: '评论内容不能为空' });
      return;
    }
    if (trimmedContent.length > 500) {
      setNotice({ type: 'error', text: '评论最长 500 字' });
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: pageKey,
          name: trimmedName,
          content: trimmedContent,
          website: website.trim(),
          contact,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // 🌟 直接发布模式:服务端返回入库的评论,本地追加,无需整页刷新
        if (data.comment) setComments((prev) => [...prev, data.comment]);
        setContent('');
        try {
          localStorage.setItem('blog-comment-name', trimmedName);
          localStorage.setItem('blog-comment-website', website.trim());
        } catch {
          /* ignore */
        }
        setNotice({ type: 'success', text: data.message || '评论发布成功' });
      } else {
        setNotice({ type: 'error', text: data.message || '发布失败,请稍后再试' });
      }
    } catch {
      setNotice({ type: 'error', text: '网络异常,发布失败' });
    }
    setSubmitting(false);
  };

  const noticeClass = notice
    ? notice.type === 'error'
      ? 'text-red-500'
      : 'text-emerald-600 dark:text-emerald-400'
    : '';

  // ==================== 说说变体:紧凑朋友圈风 ====================
  if (variant === 'moment') {
    return (
      <div className="w-full">
        <div className="flex items-start gap-2 mb-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="昵称"
            className="w-24 md:w-28 shrink-0 bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <div className="flex-1 flex items-start gap-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={500}
              rows={1}
              placeholder="说点什么..."
              className="flex-1 bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none min-h-[38px]"
            />
            <button
              onClick={submit}
              disabled={submitting}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white shadow shadow-indigo-500/30 transition-all disabled:opacity-60"
              title="发布评论"
            >
              <Send size={12} />
            </button>
          </div>
          {/* 蜜罐:人类看不见的隐藏输入框,机器人会填 */}
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />
        </div>

        {notice && <p className={`text-[10px] font-medium mb-2 ${noticeClass}`}>{notice.text}</p>}

        {loading ? (
          <p className="text-[11px] text-slate-400 py-4 text-center">评论加载中...</p>
        ) : comments.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-4 text-center">还没有评论,来抢沙发吧~</p>
        ) : (
          <div className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
            {comments.map((c, i) => (
              <div key={`${c.id}_${i}`} className="flex gap-2.5 py-2.5">
                <div className={`w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-white font-black text-xs ${avatarColor(c.name)}`}>
                  {firstChar(c.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    {c.website ? (
                      <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-xs font-black text-[#576b95] dark:text-[#7f99cc] hover:underline truncate">
                        {c.name}
                      </a>
                    ) : (
                      <span className="text-xs font-black text-[#576b95] dark:text-[#7f99cc] truncate">{c.name}</span>
                    )}
                    <span className="text-[10px] text-slate-400">{timeAgo(c.time)}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==================== 默认变体:文章/杂谈页毛玻璃卡片 ====================
  return (
    <div className="w-full">
      <div className="relative">
        {/* 顶部光晕,沿用原 Gitalk 版氛围 */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-2/3 h-24 bg-indigo-500/10 dark:bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />
        <div className="relative bg-white/40 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-white/40 dark:border-white/10 p-5 md:p-8 shadow-xl">
          {/* 头部 */}
          <div className="flex items-center gap-3 mb-6 border-b border-slate-300/50 dark:border-slate-700 pb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <MessageSquare className="text-indigo-500 w-5 h-5" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">评论 ({comments.length})</h3>
          </div>

          {/* 表单 */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder="昵称 (必填)"
                className="bg-white/50 dark:bg-slate-900/50 border border-white/50 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
              />
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                maxLength={200}
                placeholder="网址 (选填, https://...)"
                className="bg-white/50 dark:bg-slate-900/50 border border-white/50 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
              />
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={500}
              placeholder="说点什么吧..."
              className="w-full bg-white/50 dark:bg-slate-900/50 border border-white/50 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all resize-none min-h-[110px]"
            />
            {/* 蜜罐:人类看不见的隐藏输入框,机器人会填 */}
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />
            <div className="flex justify-between items-center gap-3">
              <span className={`text-xs font-medium ${noticeClass}`}>{notice?.text || ''}</span>
              <button
                onClick={submit}
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-black shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-60 flex items-center gap-2"
              >
                <Send size={15} /> {submitting ? '发布中...' : '发布评论'}
              </button>
            </div>
          </div>

          {/* 列表 */}
          {loading ? (
            <p className="text-sm text-slate-400 py-8 font-medium text-center">评论加载中...</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 font-medium text-center">还没有评论,来抢沙发吧~</p>
          ) : (
            <div className="mt-6 space-y-4">
              {comments.map((c, i) => (
                <div key={`${c.id}_${i}`} className="flex gap-3 md:gap-4 bg-white/30 dark:bg-slate-900/30 border border-white/30 dark:border-white/5 rounded-2xl p-4">
                  <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white font-black text-base ${avatarColor(c.name)}`}>
                    {firstChar(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      {c.website ? (
                        <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-indigo-600 dark:text-indigo-400 hover:underline truncate">
                          {c.name}
                        </a>
                      ) : (
                        <span className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">{c.name}</span>
                      )}
                      <span className="text-[10px] text-slate-400 font-medium">{timeAgo(c.time)}</span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
