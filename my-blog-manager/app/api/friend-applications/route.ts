import { NextResponse } from 'next/server';

// 🌟 友链申请处理接口(仅本地控制台使用,不上线):
// GET = 读取访客提交的申请队列;POST = 处理(添加/忽略)后从队列移除
// 凭据复用 .env 的 UPSTASH_REDIS_REST_URL/TOKEN(与 XHBlogs 的 /api/friend-apply 共用同一个 Redis)
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
    const res = await fetch(`${REST_URL}/lrange/friend_applications/0/-1`, {
      headers: authHeaders(),
      cache: 'no-store',
    });
    const data = await res.json();
    const raws: string[] = Array.isArray(data.result) ? data.result : [];

    // 🌟 逐条解析,坏数据跳过;保留 raw 原文用于 LREM 精确移除
    const applications = raws
      .map((raw: string) => {
        try {
          return { raw, ...JSON.parse(raw) };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, applications });
  } catch (error) {
    console.error('读取友链申请失败:', error);
    return NextResponse.json({ success: false, message: '读取申请队列失败' }, { status: 500 });
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
    return NextResponse.json({ success: false, message: '缺少申请数据' }, { status: 400 });
  }

  try {
    // 🌟 LREM 0 = 移除所有完全匹配的元素(按原文精确匹配)
    await fetch(`${REST_URL}/lrem/friend_applications/0/${encodeURIComponent(raw)}`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-store',
    });
    return NextResponse.json({ success: true, message: '申请已从队列移除' });
  } catch (error) {
    console.error('处理友链申请失败:', error);
    return NextResponse.json({ success: false, message: '处理申请失败' }, { status: 500 });
  }
}
