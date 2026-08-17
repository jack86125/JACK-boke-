"use client";

// 🌟 自建评论系统(Upstash Redis,游客免登录,2026-08-17)
// 薄包装:说说列表传入 `/moments/{moment.id}`,用紧凑朋友圈风变体渲染。
import CommentSection from './CommentSection';

interface MomentCommentsProps {
  id: string;
}

export default function MomentComments({ id }: MomentCommentsProps) {
  return <CommentSection pageKey={`moments:${id}`} variant="moment" />;
}
