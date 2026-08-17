import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 🌟 自建评论 API:数据存 Upstash Redis(复用友链申请的凭据与模式)
// GET ?page=post:xxx → 读取某页评论(时间正序);POST → 游客免登录发评论(直接发布)
// 防垃圾:蜜罐字段 contact + 同一 IP 10 分钟限流(SETNX+EXPIRE)
const REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

function authHeaders() {
  return { Authorization: `Bearer ${REST_TOKEN}` };
}

// pageKey 白名单:post:/chatter:/moments: 前缀,禁空白,最长 180(防键注入)
const PAGE_RE = /^(post|chatter|moments):[^\s]{1,180}$/;

export async function GET(request: NextRequest) {
  if (!REST_URL || !REST_TOKEN) {
    return NextResponse.json({ success: false, message: '评论服务暂未开放' }, { status: 500 });
  }
  const page = String(request.nextUrl.searchParams.get('page') || '').trim();
  if (!PAGE_RE.test(page)) {
    return NextResponse.json({ success: false, message: '页面参数不合法' }, { status: 400 });
  }
  try {
    const res = await fetch(`${REST_URL}/lrange/${encodeURIComponent(`comments:${page}`)}/0/-1`, {
      headers: authHeaders(),
      cache: 'no-store',
    });
    const data = await res.json();
    const raws: string[] = Array.isArray(data.result) ? data.result : [];
    // 🌟 逐条解析,坏数据跳过;时间正序(楼层顺序)直接展示
    const comments = raws
      .map((raw: string) => {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return NextResponse.json({ success: true, comments });
  } catch (error) {
    console.error('读取评论失败:', error);
    return NextResponse.json({ success: false, message: '读取评论失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!REST_URL || !REST_TOKEN) {
    return NextResponse.json({ success: false, message: '评论服务暂未开放' }, { status: 500 });
  }
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: '请求格式错误' }, { status: 400 });
  }

  // 🌟 蜜罐:contact 是隐藏字段,被填 = 爬虫机器人,假装成功但不入库
  if (body.contact && String(body.contact).trim() !== '') {
    return NextResponse.json({ success: true, message: '评论发布成功' });
  }

  const page = String(body.page || '').trim();
  const name = String(body.name || '').trim();
  const content = String(body.content || '').trim();
  const website = String(body.website || '').trim();

  if (!PAGE_RE.test(page)) {
    return NextResponse.json({ success: false, message: '页面参数不合法' }, { status: 400 });
  }
  if (!name || name.length > 20) {
    return NextResponse.json({ success: false, message: '昵称需为 1~20 个字符' }, { status: 400 });
  }
  if (!content || content.length > 500) {
    return NextResponse.json({ success: false, message: '评论内容需为 1~500 个字符' }, { status: 400 });
  }
  if (website && (!/^https?:\/\/.+/.test(website) || website.length > 200)) {
    return NextResponse.json({ success: false, message: '网址需以 http(s) 开头且不超过 200 字符' }, { status: 400 });
  }

  // 🌟 限流:同一 IP 10 分钟一条(SETNX + EXPIRE,与友链申请一致;限流挂了不阻塞发布)
  const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const rlKey = `comment:rl:${ip}`;
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
    console.error('评论限流检查失败:', error);
  }

  const comment = {
    id: `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    page,
    name,
    content,
    website,
    time: new Date().toISOString(),
  };
  const payload = JSON.stringify(comment);

  try {
    // 🌟 双写:页面列表(前台展示) + 全局索引(控制台管理)
    await fetch(`${REST_URL}/rpush/${encodeURIComponent(`comments:${page}`)}/${encodeURIComponent(payload)}`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-store',
    });
    await fetch(`${REST_URL}/rpush/comments:index/${encodeURIComponent(payload)}`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-store',
    });
    return NextResponse.json({ success: true, message: '评论发布成功', comment });
  } catch (error) {
    console.error('评论写入失败:', error);
    return NextResponse.json({ success: false, message: '提交失败,请稍后再试' }, { status: 500 });
  }
}
