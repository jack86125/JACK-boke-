import { NextResponse } from 'next/server';

// 🌟 访客计数 API:数据存 Upstash Redis(免费额度,原子 INCR)
// 凭据从环境变量读取(.env 已 gitignore;上线时需在 Vercel 配置同名变量)
const REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

function authHeaders() {
  return { Authorization: `Bearer ${REST_TOKEN}` };
}

// GET:只读取当前访问量(后台控制台预览用,不增加计数)
export async function GET() {
  if (!REST_URL || !REST_TOKEN) {
    return NextResponse.json({ success: false, count: null });
  }
  try {
    const res = await fetch(`${REST_URL}/get/visitor:home`, {
      headers: authHeaders(),
      cache: 'no-store',
    });
    const data = await res.json();
    const count = typeof data.result === 'string' ? parseInt(data.result, 10) : 0;
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('访客计数读取失败:', error);
    return NextResponse.json({ success: false, count: null });
  }
}

// POST:访问量 +1 并返回最新值(Redis INCR,原子操作,并发安全)
export async function POST() {
  if (!REST_URL || !REST_TOKEN) {
    return NextResponse.json({ success: false, count: null });
  }
  try {
    const res = await fetch(`${REST_URL}/incr/visitor:home`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-store',
    });
    const data = await res.json();
    const count = parseInt(data.result ?? '0', 10);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('访客计数写入失败:', error);
    return NextResponse.json({ success: false, count: null });
  }
}
