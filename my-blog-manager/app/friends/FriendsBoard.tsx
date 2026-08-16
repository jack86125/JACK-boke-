"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BackButton from '../../components/BackButton';
import { friendsData as initialFriends, Friend } from '../../data/friends';
import { Plus, Pencil, Trash2, AlertTriangle, Save, Edit3, X, CloudUpload, Sparkles, Inbox, RefreshCw, Check } from 'lucide-react';
import { useOperations } from '../../context/OperationContext';
import { useToast } from '../../components/ToastProvider';
import FloatingImageTool from '../../components/editor/FloatingImageTool';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function FriendsBoard() {
  const { addOperation } = useOperations();
  const { showToast } = useToast();

  const [editableFriends, setEditableFriends] = useState<Friend[]>(initialFriends);

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null; name: string | null }>({ isOpen: false, id: null, name: null });
  const [friendModal, setFriendModal] = useState<{ isOpen: boolean; mode: 'add' | 'edit'; data: Partial<Friend> }>({ isOpen: false, mode: 'add', data: {} });
  const [isImgToolOpen, setIsImgToolOpen] = useState(false);

  // 🌟 友链申请队列:访客在博客端提交,这里读取并处理(一键添加 / 忽略)
  const [applications, setApplications] = useState<any[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsRefreshing, setAppsRefreshing] = useState(false);

  const fetchApplications = async (silent = false) => {
    if (silent) setAppsRefreshing(true);
    else setAppsLoading(true);
    try {
      const res = await fetch('/api/friend-applications', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setApplications(data.applications || []);
      } else {
        showToast(`读取申请失败: ${data.message}`, 'error');
      }
    } catch {
      showToast('无法读取友链申请队列', 'error');
    }
    setAppsLoading(false);
    setAppsRefreshing(false);
  };

  useEffect(() => {
    fetchApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResolveApplication = async (application: any, action: 'add' | 'ignore') => {
    if (action === 'add') {
      const newFriend: Friend = {
        id: `friend_${Date.now()}`,
        name: application.name || '新朋友',
        url: application.url || '',
        avatar: application.avatar || '/images/bg1.jpg',
        description: application.description || '这位朋友很神秘，什么都没写。',
        themeColor: '#6366f1'
      };
      const next = [newFriend, ...editableFriends];
      setEditableFriends(next);
      syncToQueue(next);
      showToast(`✅ 已把「${newFriend.name}」加入友链暂存队列`, 'success');
    }
    try {
      const res = await fetch('/api/friend-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: application.raw }),
      });
      const data = await res.json();
      if (data.success) {
        setApplications(prev => prev.filter(a => a.raw !== application.raw));
        showToast(action === 'add' ? '申请已处理,记得更新本地并推送上线' : '已忽略该申请', 'success');
      } else {
        showToast(`移除申请失败: ${data.message}`, 'error');
      }
    } catch {
      showToast('无法连接到申请队列', 'error');
    }
  };

  const syncToQueue = (nextList: Friend[]) => {
    addOperation({
      id: `sync_friends_${Date.now()}`,
      type: "sync_friends",
      label: "同步友链数据变更",
      value: nextList
    });
    showToast("📍 变更已加入待处理队列，请在 Navbar 点击更新本地", "info");
  };

  const handleSaveFriend = () => {
    const { mode, data } = friendModal;
    if (!data.name || !data.url) { showToast("名称和 URL 不能为空哦", "warning"); return; }

    let next;
    if (mode === 'add') {
      const newFriend: Friend = {
        id: `friend_${Date.now()}`,
        name: data.name!,
        url: data.url!,
        avatar: data.avatar || '/images/bg1.jpg',
        description: data.description || '这位朋友很神秘，什么都没写。',
        themeColor: data.themeColor || '#6366f1'
      };
      next = [newFriend, ...editableFriends];
    } else {
      next = editableFriends.map(f => f.id === data.id ? { ...f, ...data } as Friend : f);
    }
    setEditableFriends(next);
    syncToQueue(next);
    setFriendModal({ isOpen: false, mode: 'add', data: {} });
  };

  const confirmDelete = () => {
    const next = editableFriends.filter(f => f.id !== deleteModal.id);
    setEditableFriends(next);
    syncToQueue(next);
    setDeleteModal({ isOpen: false, id: null, name: null });
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-10 py-10 relative z-10">

      <FloatingImageTool
        key={isImgToolOpen ? 'tool-open' : 'tool-closed'}
        isOpen={isImgToolOpen}
        onClose={() => setIsImgToolOpen(false)}
        onInsert={(url) => {
          setFriendModal(prev => ({ ...prev, data: { ...prev.data, avatar: url } }));
          setIsImgToolOpen(false);
        }}
      />

      <AnimatePresence>
        {deleteModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[40px] shadow-2xl border border-white/50 p-10 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6"><AlertTriangle className="text-red-500" /></div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">切断引力？</h3>
              <p className="text-sm text-slate-500 mb-8">确认从列表中移除 <span className="font-bold text-red-500">"{deleteModal.name}"</span> 吗？</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-black hover:bg-slate-200 transition-colors">取消</button>
                <button onClick={confirmDelete} className="flex-1 py-4 bg-red-500 text-white rounded-2xl text-xs font-black shadow-lg hover:bg-red-600 transition-colors">确认移除</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {friendModal.isOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="relative w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[40px] border border-white/20 p-8 shadow-2xl overflow-hidden">
               <h2 className="text-2xl font-black mb-6 dark:text-white flex items-center gap-2"><Sparkles className="text-indigo-500" /> {friendModal.mode === 'add' ? '建立新连接' : '修改朋友信息'}</h2>
               <div className="space-y-4">
                 <input type="text" value={friendModal.data.name || ''} onChange={e => setFriendModal({...friendModal, data: {...friendModal.data, name: e.target.value}})} className="w-full bg-slate-100 dark:bg-black/20 rounded-2xl px-5 py-3 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 border-none" placeholder="朋友的名字" />
                 <input type="text" value={friendModal.data.url || ''} onChange={e => setFriendModal({...friendModal, data: {...friendModal.data, url: e.target.value}})} className="w-full bg-slate-100 dark:bg-black/20 rounded-2xl px-5 py-3 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 border-none" placeholder="博客网址 (https://...)" />

                 <div className="relative group">
                    <input type="text" value={friendModal.data.avatar || ''} onChange={e => setFriendModal({...friendModal, data: {...friendModal.data, avatar: e.target.value}})} className="w-full bg-slate-100 dark:bg-black/20 rounded-2xl px-5 py-3 pr-14 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 border-none" placeholder="头像 URL" />
                    <button onClick={() => setIsImgToolOpen(true)} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-500 text-white shadow-md hover:bg-indigo-600 transition-colors"><CloudUpload size={18} /></button>
                 </div>

                 <textarea value={friendModal.data.description || ''} onChange={e => setFriendModal({...friendModal, data: {...friendModal.data, description: e.target.value}})} className="w-full bg-slate-100 dark:bg-black/20 rounded-2xl px-5 py-3 dark:text-white h-20 outline-none focus:ring-2 focus:ring-indigo-500 border-none resize-none" placeholder="简单描述一下..." />

                 <div className="flex items-center gap-4 px-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">主题色：</label>
                    <input type="color" value={friendModal.data.themeColor || '#6366f1'} onChange={e => setFriendModal({...friendModal, data: {...friendModal.data, themeColor: e.target.value}})} className="w-10 h-10 rounded-lg overflow-hidden border-none cursor-pointer" />
                 </div>
               </div>
               <div className="mt-8 flex gap-3">
                 <button onClick={() => setFriendModal({ ...friendModal, isOpen: false })} className="flex-1 py-3 text-slate-500 font-bold hover:text-slate-800 dark:hover:text-white transition-colors">取消</button>
                 <button onClick={handleSaveFriend} className="flex-1 py-4 bg-indigo-500 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 hover:bg-indigo-600 transition-colors"><Save size={18} /> 加入暂存</button>
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
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-4 tracking-widest drop-shadow-sm uppercase">云端引力</h1>
          <p className="text-slate-600 dark:text-slate-400 font-serif">那些散落在世界各处的有趣灵魂在此处相会，结交新的朋友。</p>
        </div>
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <motion.div variants={itemVariants} onClick={() => setFriendModal({ isOpen: true, mode: 'add', data: {} })} className="group cursor-pointer flex flex-col items-center justify-center min-h-[200px] rounded-3xl border-4 border-dashed border-slate-300 dark:border-slate-700 bg-white/10 hover:border-indigo-500 hover:bg-indigo-500/5 transition-all duration-500">
            <div className="w-14 h-14 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-md group-hover:rotate-90">
              <Plus size={32} />
            </div>
            <span className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-indigo-500">添加新朋友</span>
        </motion.div>

        {editableFriends.map((friend) => (
          <motion.div key={friend.id} variants={itemVariants} className="group relative">

            <div className="absolute top-4 right-4 z-30 flex gap-2 opacity-0 group-hover:opacity-100 transition-all -translate-y-2 group-hover:translate-y-0">
               <button onClick={() => setFriendModal({ isOpen: true, mode: 'edit', data: friend })} className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"><Edit3 size={14}/></button>
               <button onClick={() => setDeleteModal({ isOpen: true, id: friend.id, name: friend.name })} className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"><Trash2 size={14}/></button>
            </div>

            <a href={friend.url} target="_blank" rel="noopener noreferrer" className="block h-full rounded-3xl bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:scale-[1.02] p-6 relative">
              <div className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ backgroundColor: friend.themeColor }}></div>

              <div className="flex items-center gap-5 relative z-10 mb-4">
                <div className="w-16 h-16 rounded-full p-1 bg-gradient-to-tr from-indigo-500/50 to-purple-500/50 shadow-md group-hover:rotate-[360deg] transition-transform duration-1000 ease-in-out flex-shrink-0">
                  <img src={friend.avatar} alt={friend.name} className="w-full h-full rounded-full object-cover bg-white" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">{friend.name}</h2>
                  <div className="text-xs font-bold text-indigo-500/70 dark:text-indigo-400/70 tracking-widest uppercase mt-1 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span> Online
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 font-serif leading-relaxed line-clamp-3 relative z-10">{friend.description}</p>
            </a>
          </motion.div>
        ))}
      </motion.div>

      {/* 🌟 友链申请队列:访客在博客友链页提交的申请在这里处理 */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-14 md:mt-20 bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-2xl md:rounded-3xl p-5 md:p-8 max-w-3xl mx-auto shadow-lg md:shadow-xl relative"
      >
        <div className="flex items-center justify-between mb-2 md:mb-4">
          <h2 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white tracking-wider flex items-center gap-2">
            <Inbox className="text-indigo-500" size={22} /> 友链申请
            {applications.length > 0 && (
              <span className="text-[10px] md:text-xs bg-red-500 text-white rounded-full px-2 py-0.5 font-black">{applications.length}</span>
            )}
          </h2>
          <button
            onClick={() => fetchApplications(true)}
            disabled={appsRefreshing}
            className="p-2 rounded-xl bg-white/50 dark:bg-slate-800/50 hover:bg-indigo-500 hover:text-white text-slate-500 transition-all"
            title="刷新申请列表"
          >
            <RefreshCw size={16} className={appsRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
        <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mb-4 md:mb-6">
          访客在博客友链页提交的申请会出现在这里,一键添加后走「更新本地 → 同步 Blog → 推送 GitHub」流程上线。
        </p>

        {appsLoading ? (
          <p className="text-sm text-slate-400 py-8 font-bold">正在加载申请队列...</p>
        ) : applications.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 font-bold">暂无待处理的友链申请 📭</p>
        ) : (
          <div className="space-y-3 text-left">
            {applications.map((application) => (
              <div key={application.id || application.raw} className="flex flex-col md:flex-row md:items-center gap-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-4">
                <img
                  src={application.avatar || '/images/friend-avatar.jpg'}
                  alt={application.name}
                  className="w-12 h-12 rounded-full object-cover bg-white shrink-0 self-center md:self-start"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-800 dark:text-white truncate">{application.name}</p>
                  <a href={application.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline break-all">{application.url}</a>
                  {application.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{application.description}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => handleResolveApplication(application, 'add')}
                    className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-lg shadow-emerald-500/30 transition-all"
                  >
                    <Check size={14} /> 一键添加
                  </button>
                  <button
                    onClick={() => handleResolveApplication(application, 'ignore')}
                    className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-red-500 hover:text-white text-xs font-black transition-all"
                  >
                    <X size={14} /> 忽略
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

    </div>
  );
}