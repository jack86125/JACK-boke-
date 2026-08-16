"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import BackButton from '../../components/BackButton';
import { friendsData } from '../../data/friends';

// Framer Motion 动画变体：交错子元素
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 } // 每张卡片延迟 0.15 秒出现
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function FriendsBoard() {
  // 🌟 友链申请表单状态(替代原来的「复制格式 + Gitalk 留言」流程)
  const [applyForm, setApplyForm] = useState({ name: '', url: '', avatar: '', description: '', website: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applyResult, setApplyResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleApplySubmit = async () => {
    if (isSubmitting) return;
    if (!applyForm.name.trim() || !applyForm.url.trim()) {
      setApplyResult({ ok: false, message: '名称和链接是必填的哦' });
      return;
    }
    setIsSubmitting(true);
    setApplyResult(null);
    try {
      const res = await fetch('/api/friend-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applyForm),
      });
      const data = await res.json();
      if (data.success) {
        setApplyResult({ ok: true, message: data.message || '申请已送达!' });
        setApplyForm({ name: '', url: '', avatar: '', description: '', website: '' });
      } else {
        setApplyResult({ ok: false, message: data.message || '提交失败,请稍后再试' });
      }
    } catch {
      setApplyResult({ ok: false, message: '网络异常,请稍后再试' });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-10 py-6 md:py-10 relative z-10 scroll-smooth mt-20 md:mt-10">

      {/* 顶部导航与标题 */}
      <div className="mb-8 md:mb-12 flex flex-col items-center md:items-start">
        <div className="w-full flex justify-start mb-4 md:mb-6">
          <BackButton />
        </div>
        <div className="text-center md:text-left w-full px-2 md:px-0">
          <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white mb-2 md:mb-4 tracking-widest drop-shadow-sm uppercase">
            云端引力
          </h1>
          <p className="text-xs md:text-base text-slate-600 dark:text-slate-400 font-serif">
            那些散落在世界各处的有趣灵魂在此处相会，结交新的朋友。
          </p>
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6"
      >
        {friendsData.map((friend) => (
          <motion.div key={friend.id} variants={itemVariants} className="h-full">
            <a
              href={friend.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-full rounded-2xl md:rounded-3xl bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg md:shadow-xl overflow-hidden transition-all duration-500 hover:-translate-y-1 md:hover:-translate-y-2 hover:scale-[1.02] group relative p-3 md:p-6"
            >
              {/* 卡片底部的动态光晕 */}
              <div
                className="absolute -bottom-10 -right-10 w-24 h-24 md:w-32 md:h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{ backgroundColor: friend.themeColor }}
              ></div>

              <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-5 relative z-10 mb-2 md:mb-4">

                <div className="w-10 h-10 md:w-16 md:h-16 rounded-full p-[2px] md:p-1 bg-gradient-to-tr from-indigo-500/50 to-purple-500/50 shadow-sm md:shadow-md group-hover:rotate-[360deg] transition-transform duration-1000 ease-in-out flex-shrink-0">
                  <img src={friend.avatar} alt={friend.name} className="w-full h-full rounded-full object-cover bg-white" />
                </div>

                <div className="flex-1 overflow-hidden w-full">
                  <h2 className="text-sm md:text-xl font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                    {friend.name}
                  </h2>
                  <div className="text-[9px] md:text-xs font-bold text-indigo-500/70 dark:text-indigo-400/70 tracking-widest uppercase mt-0.5 md:mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    Online
                  </div>
                </div>
              </div>

              <p className="text-[10px] md:text-sm text-slate-700 dark:text-slate-300 font-serif leading-snug md:leading-relaxed line-clamp-2 md:line-clamp-3 relative z-10">
                {friend.description}
              </p>
            </a>
          </motion.div>
        ))}
      </motion.div>

      {/* 友链申请表单区(替代原「复制格式 + Gitalk 留言」流程,申请直达站长后台) */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-14 md:mt-20 bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-2xl md:rounded-3xl p-5 md:p-8 max-w-3xl mx-auto text-center shadow-lg md:shadow-xl relative"
      >
        <h2 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white mb-2 md:mb-4 tracking-wider">
          ✨ 建立神经连接
        </h2>
        <p className="text-xs md:text-base text-slate-600 dark:text-slate-400 font-serif mb-6 md:mb-8">
          欢迎各位大佬交换友链！填写下方表单，站长确认后就会把你的卡片挂上来：
        </p>

        <div className="space-y-3 md:space-y-4 text-left max-w-md mx-auto">
          <input
            type="text"
            value={applyForm.name}
            onChange={e => setApplyForm({ ...applyForm, name: e.target.value })}
            maxLength={30}
            placeholder="站点名称 (必填)"
            className="w-full bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          <input
            type="text"
            value={applyForm.url}
            onChange={e => setApplyForm({ ...applyForm, url: e.target.value })}
            maxLength={200}
            placeholder="站点链接 https://... (必填)"
            className="w-full bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          <input
            type="text"
            value={applyForm.avatar}
            onChange={e => setApplyForm({ ...applyForm, avatar: e.target.value })}
            maxLength={300}
            placeholder="头像链接 https://... (选填)"
            className="w-full bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          <textarea
            rows={2}
            value={applyForm.description}
            onChange={e => setApplyForm({ ...applyForm, description: e.target.value })}
            maxLength={120}
            placeholder="一句话简介 (选填)"
            className="w-full bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          {/* 🌟 蜜罐:对真人不可见,机器人填了会被后端静默丢弃 */}
          <input
            type="text"
            value={applyForm.website}
            onChange={e => setApplyForm({ ...applyForm, website: e.target.value })}
            tabIndex={-1}
            autoComplete="off"
            placeholder="website"
            className="hidden"
            aria-hidden="true"
          />
        </div>

        <div className="mt-6 md:mt-8">
          <button
            onClick={handleApplySubmit}
            disabled={isSubmitting}
            className={`inline-block px-8 py-2.5 md:px-10 md:py-3 rounded-full text-sm md:text-base font-bold tracking-widest transition-all duration-300 shadow-lg ${
              isSubmitting
                ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-300 cursor-wait'
                : 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white hover:scale-105 active:scale-95 shadow-indigo-500/30'
            }`}
          >
            {isSubmitting ? '正在发送...' : '提交申请 🚀'}
          </button>
        </div>

        {applyResult && (
          <p className={`mt-4 text-xs md:text-sm font-bold ${applyResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            {applyResult.ok ? '✅ ' : '⚠️ '}{applyResult.message}
          </p>
        )}
      </motion.div>

    </div>
  );
}