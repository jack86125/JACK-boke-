"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BackButton from '../../components/BackButton';
import { MessageSquare, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '../../components/ToastProvider';

// 🌟 评论管理面板:博客端游客发布的评论(直接发布模式)在这里列出,可删除违规内容
// 数据来自 Upstash Redis 的 comments:index 全局索引,删除会同步清掉博客页面上的展示

// 头像取色:按昵称字符码在 8 色调色板里取色(与博客端 CommentSection 一致)
const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-pink-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-sky-500', 'bg-purple-500', 'bg-rose-500', 'bg-teal-500',
];

function avatarColor(name: string) {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 🌟 pageKey 徽章:post:{slug} / chatter:{slug} / moments:/moments/{id}
function pageBadge(page: string) {
  if (!page) return { label: '未知页面', cls: 'bg-slate-500/10 text-slate-500' };
  if (page.startsWith('post:')) return { label: `文章 ${page.slice(5)}`, cls: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' };
  if (page.startsWith('chatter:')) return { label: `杂谈 ${page.slice(8)}`, cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' };
  if (page.startsWith('moments:')) return { label: `说说 ${page.slice(8)}`, cls: 'bg-pink-500/10 text-pink-600 dark:text-pink-400' };
  return { label: page, cls: 'bg-slate-500/10 text-slate-500' };
}

export default function CommentsBoard() {
  const { showToast } = useToast();

  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; raw: string | null; name: string | null }>({ isOpen: false, raw: null, name: null });
  const [deleting, setDeleting] = useState(false);

  const fetchComments = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch('/api/comments', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setComments(data.comments || []);
      } else {
        showToast(`读取评论失败: ${data.message}`, 'error');
      }
    } catch {
      showToast('无法读取评论列表', 'error');
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async () => {
    if (!deleteModal.raw || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: deleteModal.raw }),
      });
      const data = await res.json();
      if (data.success) {
        setComments(prev => prev.filter(c => c.raw !== deleteModal.raw));
        showToast('评论已删除,博客页面上的展示会一并移除', 'success');
      } else {
        showToast(`删除失败: ${data.message}`, 'error');
      }
    } catch {
      showToast('无法连接到评论接口', 'error');
    }
    setDeleting(false);
    setDeleteModal({ isOpen: false, raw: null, name: null });
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-10 py-10 relative z-10">

      <AnimatePresence>
        {deleteModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[40px] shadow-2xl border border-white/50 p-10 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6"><AlertTriangle className="text-red-500" /></div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">删除这条评论？</h3>
              <p className="text-sm text-slate-500 mb-8">确认删除 <span className="font-bold text-red-500">"{deleteModal.name}"</span> 的评论吗？<br />删除后博客页面上的展示会一并移除。</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-black hover:bg-slate-200 transition-colors">取消</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-4 bg-red-500 text-white rounded-2xl text-xs font-black shadow-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{deleting ? '删除中...' : '确认删除'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="mb-12 flex flex-col items-center md:items-start">
        <div className="w-full flex justify-start mb-6">
          <BackButton />
        </div>
        <div className="text-center md:text-left w-full">
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-4 tracking-widest drop-shadow-sm uppercase">评论管理</h1>
          <p className="text-slate-600 dark:text-slate-400 font-serif">访客在文章、杂谈、说说下发布的评论都在这里,不合适的内容可以直接删除。</p>
        </div>
      </div>

      {/* 🌟 评论列表:直接发布模式,无审核队列;删除 = 索引 + 页面列表双删 */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-lg md:shadow-xl relative"
      >
        <div className="flex items-center justify-between mb-2 md:mb-4">
          <h2 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white tracking-wider flex items-center gap-2">
            <MessageSquare className="text-indigo-500" size={22} /> 访客评论
            {comments.length > 0 && (
              <span className="text-[10px] md:text-xs bg-red-500 text-white rounded-full px-2 py-0.5 font-black">{comments.length}</span>
            )}
          </h2>
          <button
            onClick={() => fetchComments(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white/50 dark:bg-slate-800/50 hover:bg-indigo-500 hover:text-white text-slate-500 transition-all"
            title="刷新评论列表"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
        <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mb-4 md:mb-6">
          评论直接发布上线(无审核),这里只显示最近 200 条;删除后博客页面上也会同步移除。
        </p>

        {loading ? (
          <p className="text-sm text-slate-400 py-8 font-bold">正在加载评论列表...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 font-bold">暂无评论 💬 等访客来留下第一条足迹吧</p>
        ) : (
          <div className="space-y-3 text-left">
            {comments.map((comment) => {
              const badge = pageBadge(comment.page);
              return (
                <div key={comment.id || comment.raw} className="flex flex-col gap-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full ${avatarColor(comment.name || '?')} text-white flex items-center justify-center font-black text-sm shrink-0`}>
                      {(comment.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-slate-800 dark:text-white">{comment.name}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full max-w-[220px] truncate ${badge.cls}`}>{badge.label}</span>
                        {comment.website && (
                          <a href={comment.website} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline break-all max-w-[200px] truncate">{comment.website}</a>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{formatTime(comment.time)}</p>
                    </div>
                    <button
                      onClick={() => setDeleteModal({ isOpen: true, raw: comment.raw, name: comment.name })}
                      className="p-2 rounded-xl text-slate-400 hover:bg-red-500 hover:text-white transition-all shrink-0"
                      title="删除评论"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words line-clamp-4">{comment.content}</p>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

    </div>
  );
}
