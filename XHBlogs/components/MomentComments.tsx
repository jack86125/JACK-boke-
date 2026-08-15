"use client";

// 🌟 评论区已暂时隐藏(2026-08-15)
// 原因:原 Gitalk 方案从未配置(clientID 等全为空)且访客需 GitHub 账号才能评论。
// 用户决定先下线评论区,后续接入 Waline/Twikoo 等游客免登录方案时再恢复。
// 原 Gitalk 实现见 git 历史(提交 3fbb0f4)的 XHBlogs/components/MomentComments.tsx。

interface MomentCommentsProps {
  id: string;
}

export default function MomentComments({ id }: MomentCommentsProps) {
  return null;
}
