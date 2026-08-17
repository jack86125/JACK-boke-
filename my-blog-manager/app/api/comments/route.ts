import { NextResponse } from 'next/server';

// 🌟 评论管理接口(仅本地控制台使用,不上线):
// GET = 读取全局评论索引(最近 200 条,最新在前);POST = 删除某条评论(索引 + 页面列表双删)
// 凭据复用 .env 的 UPSTASH_REDIS_REST_URL/TOKEN(与 XHBlogs 的 /api/comments 共用同一个 Redis)
const REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

function authHeaders() {
  return { Authorization: `Bearer ${REST_TOKEN}` };
}

export async function GET() {
  if (!REST_URL || !REST_TOKEN) {
    return NextResponse.json({ success: false, message: '未配置 Upstash 凭据' }, { status: 500 });
  }
  try {
    const res = await fetch(`${REST_URL}/lrange/comments:index/-200/-1`, {
      headers: authHeaders(),
      cache: 'no-store',
    });
    const data = await res.json();
    const raws: string[] = Array.isArray(data.result) ? data.result : [];

    // 🌟 逐条解析,坏数据跳过;保留 raw 原文用于 LREM 精确移除;倒序成最新在前
    const comments = raws
      .map((raw: string) => {
        try {
          return { raw, ...JSON.parse(raw) };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();

    return NextResponse.json({ success: true, comments });
  } catch (error) {
    console.error('读取评论索引失败:', error);
    return NextResponse.json({ success: false, message: '读取评论列表失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!REST_URL || !REST_TOKEN) {
    return NextResponse.json({ success: false, message: '未配置 Upstash 凭据' }, { status: 500 });
  }
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: '请求格式错误' }, { status: 400 });
  }

  const raw = String(body.raw || '');
  if (!raw) {
    return NextResponse.json({ success: false, message: '缺少评论数据' }, { status: 400 });
  }

  // 🌟 从原文解析出 page,用于定位页面列表;坏数据直接拒绝
  let page = '';
  try {
    page = String(JSON.parse(raw).page || '');
  } catch {
    return NextResponse.json({ success: false, message: '评论数据已损坏' }, { status: 400 });
  }

  try {
    // 🌟 双删:LREM 0 = 移除所有完全匹配的元素(按原文精确匹配,勿重新 stringify)
    // 全局索引 + 对应页面列表;page 可能含冒号/斜杠,需 encodeURIComponent
    await fetch(`${REST_URL}/lrem/comments:index/0/${encodeURIComponent(raw)}`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-store',
    });
    await fetch(`${REST_URL}/lrem/${encodeURIComponent(`comments:${page}`)}/0/${encodeURIComponent(raw)}`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-store',
    });
    return NextResponse.json({ success: true, message: '评论已删除' });
  } catch (error) {
    console.error('删除评论失败:', error);
    return NextResponse.json({ success: false, message: '删除评论失败' }, { status: 500 });
  }
}
