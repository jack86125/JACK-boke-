"use client";

// 🌟 自建评论系统(Upstash Redis,游客免登录,2026-08-17)
// 薄包装:文章/杂谈详情页传入 pageKey(如 `post:post_1786728538`),具体逻辑在 CommentSection。
import CommentSection from './CommentSection';

export default function Comments({ pageKey }: { pageKey: string }) {
  return <CommentSection pageKey={pageKey} />;
}
