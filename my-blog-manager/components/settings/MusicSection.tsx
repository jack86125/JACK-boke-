import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../ToastProvider';

export default function MusicSection({ formData, handleUpdate, pushToQueue, musicDetails, queryMusic, queryLoading, queryResult, confirmAddMusic, removeSong }: any) {
  const { showToast } = useToast();

  // 👇 【本地化改造】：本地歌曲上传状态 (mp3 + 可选 .lrc 歌词)
  const [uploading, setUploading] = useState(false);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localLrcFile, setLocalLrcFile] = useState<File | null>(null);
  const [localTitle, setLocalTitle] = useState('');
  const [localArtist, setLocalArtist] = useState('');
  const [localCover, setLocalCover] = useState('');
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lrcInputRef = useRef<HTMLInputElement>(null);

  const localMusic: any[] = formData.localMusic || [];

  // 🌟 上传本地音乐：音频存进双端 public/music/，可选 LRC 歌词一起保存
  const handleLocalUpload = async () => {
    if (!localFile) {
      showToast("请先选择音频文件 (mp3)", "warning");
      return;
    }
    setUploading(true);
    showToast("正在上传本地歌曲...", "info");

    try {
      const configRes = await fetch(`/backend_config.json?t=${Date.now()}`);
      const configData = await configRes.json();

      const uploadData = new FormData();
      uploadData.append('file', localFile);
      if (localLrcFile) uploadData.append('lrc', localLrcFile);

      const res = await fetch(`http://127.0.0.1:${configData.api_port}/api/music/upload`, {
        method: 'POST',
        body: uploadData,
      });

      const data = await res.json();
      if (data.success && data.url) {
        const entry: any = {
          title: localTitle.trim() || localFile.name.replace(/\.[^.]+$/, ''),
          artist: localArtist.trim() || '未知歌手',
          cover: localCover.trim(),
          src: data.url,
        };
        if (data.lrc) entry.lrc = data.lrc;

        handleUpdate('localMusic', [...localMusic, entry]);

        // 清空表单，方便继续传下一首
        setLocalFile(null);
        setLocalLrcFile(null);
        setLocalTitle('');
        setLocalArtist('');
        setLocalCover('');
        if (audioInputRef.current) audioInputRef.current.value = '';
        if (lrcInputRef.current) lrcInputRef.current.value = '';

        showToast("🎉 本地歌曲已加入列表！记得点“暂存音乐修改”", "success");
      } else {
        showToast(`上传失败: ${data.message}`, "error");
      }
    } catch (error) {
      showToast("无法连接到 Python 引擎上传通道", "error");
    } finally {
      setUploading(false);
    }
  };

  const removeLocalSong = (index: number) => {
    const newList = [...localMusic];
    newList.splice(index, 1);
    handleUpdate('localMusic', newList);
    showToast("已移除一首本地歌曲", "success");
  };

  return (
    <motion.section initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl border border-white/50 dark:border-slate-800/50 rounded-[40px] p-8 shadow-2xl">
      <h2 className="text-xl font-black text-slate-800 dark:text-white mb-8">🎵 音乐播放设置</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-4">当前绑定的网易云 ID ({formData.cloudMusicIds.length})</p>
          <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
            {formData.cloudMusicIds.map((id: string, index: number) => {
              const detail = musicDetails[id];
              return (
                <div key={index} className="flex justify-between items-center p-3 bg-white/40 dark:bg-slate-800/40 rounded-2xl border border-white/20 group">
                  <div className="flex items-center gap-3">
                    {detail?.cover ? (
                      <img src={detail.cover} alt="cover" className="w-10 h-10 rounded-lg object-cover shadow-sm" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse flex items-center justify-center text-xs">💿</div>
                    )}
                    <div className="flex flex-col">
                      {detail ? (
                        <>
                          <span className={`text-sm font-bold line-clamp-1 ${detail.error ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>{detail.name}</span>
                          {!detail.error && <span className="text-[10px] text-slate-500 font-medium">{detail.artist}</span>}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">正在解析...</span>
                      )}
                      <span className="text-[10px] font-mono text-pink-500 mt-0.5">#{id}</span>
                    </div>
                  </div>
                  <button onClick={() => removeSong(index)} className="w-8 h-8 shrink-0 rounded-lg bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white flex items-center justify-center">✕</button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-3xl p-6 space-y-6">
          <p className="text-[10px] font-black text-slate-400 uppercase">校验并添加新 ID</p>
          <div className="flex gap-2">
            <input type="text" placeholder="输入歌曲 ID" value={formData.newMusicId} onChange={e => handleUpdate('newMusicId', e.target.value)} className="flex-1 bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 text-sm outline-none shadow-sm" />
            <button onClick={queryMusic} disabled={queryLoading} className="px-6 py-3 bg-pink-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-pink-500/20 disabled:opacity-50">
              {queryLoading ? "请求中..." : "真实查询"}
            </button>
          </div>

          <AnimatePresence>
            {queryResult && !queryResult.error && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-3 bg-white dark:bg-slate-900 rounded-2xl border-2 border-green-500/30 flex justify-between items-center shadow-xl">
                <div className="flex items-center gap-3">
                  <img src={queryResult.cover} alt="cover" className="w-10 h-10 rounded-lg object-cover" />
                  <div>
                    <p className="text-[10px] font-black text-green-600">获取成功</p>
                    <p className="text-xs font-bold line-clamp-1">{queryResult.name}</p>
                  </div>
                </div>
                <button onClick={confirmAddMusic} className="px-3 py-2 bg-green-500 text-white rounded-xl text-[10px] font-black shrink-0 hover:bg-green-600 transition-colors">存入列表</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 【核心修复】：加上了真正的更新 key (cloudMusicIds) 和新数组 */}
          <button
            onClick={() => pushToQueue('网易云歌单', 'cloudMusicIds', formData.cloudMusicIds)}
            className="w-full py-4 bg-indigo-500 text-white rounded-2xl text-sm font-black shadow-xl mt-4 active:scale-95 transition-all"
          >
            暂存音乐修改
          </button>
        </div>
      </div>

      {/* 👇 【本地化改造】：本地歌曲上传面板 (mp3 + 可选 LRC 歌词，不依赖任何外部服务) */}
      <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-3xl p-6 space-y-6 mt-8">
        <p className="text-[10px] font-black text-slate-400 uppercase">📁 本地歌曲上传 (歌曲直接存进你的博客，不依赖任何外部服务)</p>

        {localMusic.length > 0 && (
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
            {localMusic.map((song: any, index: number) => (
              <div key={index} className="flex justify-between items-center p-3 bg-white/40 dark:bg-slate-800/40 rounded-2xl border border-white/20 group">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={song.cover || '/images/music-cover.jpg'} alt="cover" className="w-10 h-10 rounded-lg object-cover shadow-sm shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-slate-800 dark:text-white truncate">{song.title}</span>
                    <span className="text-[10px] text-slate-500 font-medium truncate">{song.artist} · {song.lrc ? '含歌词' : '纯音乐'}</span>
                    <span className="text-[10px] font-mono text-emerald-600 truncate">{song.src}</span>
                  </div>
                </div>
                <button onClick={() => removeLocalSong(index)} className="w-8 h-8 shrink-0 rounded-lg bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white flex items-center justify-center">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase">1️⃣ 音频文件 (mp3)</label>
              <input type="file" ref={audioInputRef} accept="audio/*" onChange={e => setLocalFile(e.target.files?.[0] || null)}
                className="mt-2 w-full text-xs font-bold text-slate-500 file:mr-4 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-emerald-500 file:text-white file:font-black file:cursor-pointer hover:file:bg-emerald-600" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase">2️⃣ 歌词文件 (可选 .lrc)</label>
              <input type="file" ref={lrcInputRef} accept=".lrc,text/plain" onChange={e => setLocalLrcFile(e.target.files?.[0] || null)}
                className="mt-2 w-full text-xs font-bold text-slate-500 file:mr-4 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-teal-500 file:text-white file:font-black file:cursor-pointer hover:file:bg-teal-600" />
            </div>
          </div>

          <div className="space-y-3">
            <input type="text" placeholder="歌名 (留空则用文件名)" value={localTitle} onChange={e => setLocalTitle(e.target.value)} className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 text-xs outline-none shadow-sm" />
            <input type="text" placeholder="歌手" value={localArtist} onChange={e => setLocalArtist(e.target.value)} className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 text-xs outline-none shadow-sm" />
            <input type="text" placeholder="封面图路径 (可选，如 /images/xxx.jpg，留空用默认封面)" value={localCover} onChange={e => setLocalCover(e.target.value)} className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 text-xs outline-none shadow-sm" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleLocalUpload}
            disabled={uploading || !localFile}
            className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl text-sm font-black shadow-xl shadow-emerald-500/20 disabled:opacity-50 active:scale-95 transition-all"
          >
            {uploading ? "上传中..." : "⬆️ 上传到本地音乐库"}
          </button>
          <button
            onClick={() => pushToQueue('本地音乐库', 'localMusic', formData.localMusic)}
            className="flex-1 py-4 bg-indigo-500 text-white rounded-2xl text-sm font-black shadow-xl active:scale-95 transition-all"
          >
            暂存本地音乐修改
          </button>
        </div>

        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">💡 LRC 歌词为标准格式，每行形如 [00:12.34]歌词内容，可去歌词网站下载同名 .lrc 文件，或用记事本自行创建 (注意保存为 UTF-8 编码)。没有歌词也能正常播放，界面会显示“纯享音乐”。封面图可先在编辑器的“图片工作台”上传，再把得到的 /images/ 路径填进来。</p>
      </div>
    </motion.section>
  );
}
