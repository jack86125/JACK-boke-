import { NextResponse } from 'next/server';

// 🌟 友链申请 API:访客提交的申请写入 Upstash Redis 列表,后台控制台读取后手动添加
// 凭据复用 UPSTASH_REDIS_REST_URL/TOKEN(.env 已 gitignore,Vercel 已配置同名变量)
const REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

function authHeaders() {
  return { Authorization: `Bearer ${REST_TOKEN}` };
}

export async function POST(request: Request) {
  if (!REST_URL || !REST_TOKEN) {
    return NextResponse.json({ success: false, message: '服务端暂未开放申请通道' }, { status: 500 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: '请求格式错误' }, { status: 400 });
  }

  // 🌟 蜜罐:隐藏字段被填 = 爬虫机器人,假装成功但不入库
  if (body.website && String(body.website).trim() !== '') {
    return NextResponse.json({ success: true, message: '申请已送达,站长看到后会尽快添加,谢谢!' });
  }

  const name = String(body.name || '').trim();
  const url = String(body.url || '').trim();
  const avatar = String(body.avatar || '').trim();
  const description = String(body.description || '').trim();

  // 🌟 基础校验
  if (!name || name.length > 30) {
    return NextResponse.json({ success: false, message: '名称需为 1~30 个字符' }, { status: 400 });
  }
  if (!/^https?:\/\/.+\..+/.test(url) || url.length > 200) {
    return NextResponse.json({ success: false, message: '链接需以 http:// 或 https:// 开头' }, { status: 400 });
  }
  if (avatar && (!/^https?:\/\/.+/.test(avatar) || avatar.length > 300)) {
    return NextResponse.json({ success: false, message: '头像需为 http(s) 开头的图片链接' }, { status: 400 });
  }
  if (description.length > 120) {
    return NextResponse.json({ success: false, message: '简介最长 120 字' }, { status: 400 });
  }

  // 🌟 限流:同一 IP 10 分钟内只能提交一次(SETNX + EXPIRE)
  const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const rlKey = `friend_apply:rl:${ip}`;
  try {
    const rlRes = await fetch(`${REST_URL}/setnx/${encodeURIComponent(rlKey)}/1`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-store',
    });
    const rlData = await rlRes.json();
    if (Number(rlData.result) === 0) {
      return NextResponse.json({ success: false, message: '提交太频繁啦,请 10 分钟后再试' }, { status: 429 });
    }
    await fetch(`${REST_URL}/expire/${encodeURIComponent(rlKey)}/600`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-store',
    });
  } catch (error) {
    console.error('友链申请限流检查失败:', error);
  }

  // 🌟 入队:RPUSH 到申请列表,后台控制台 LRANGE 读取、LREM 处理
  const application = JSON.stringify({
    id: `fa_${Date.now()}`,
    name,
    url,
    avatar,
    description,
    time: new Date().toISOString(),
  });

  try {
    await fetch(`${REST_URL}/rpush/friend_applications/${encodeURIComponent(application)}`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-store',
    });
    return NextResponse.json({ success: true, message: '申请已送达,站长看到后会尽快添加,谢谢!' });
  } catch (error) {
    console.error('友链申请写入失败:', error);
    return NextResponse.json({ success: false, message: '提交失败,请稍后再试' }, { status: 500 });
  }
}
