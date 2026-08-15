// app/api/chat/route.ts
import { siteConfig } from '../../../siteConfig'; // 确保这里的路径指向你的 siteConfig

export const runtime = 'edge';

export async function POST(req: Request) {
  console.log("🚀 [1/5] 路由进入：开始对接阿里云百炼 Qwen 脑回路");

  try {
    const { message, history } = await req.json();

    // 🌟 纯粹靠环境变量读取 API Key
    const apiKey = (process.env.DASHSCOPE_API_KEY || '').trim();

    if (!apiKey) {
      console.error("❌ 找不到 API Key (DASHSCOPE_API_KEY)");
      return new Response(JSON.stringify({ error: "Key missing" }), { status: 500 });
    }

    // 调用 siteConfig 的参数
    const modelId = siteConfig.geminiConfig.modelId;
    const url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

    // 🧠 短期记忆：把前端传来的最近对话历史一起喂给模型 (最多 10 轮)
    const historyMessages = Array.isArray(history)
      ? history.slice(-20).filter(
          (m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
        )
      : [];

    console.log(`📡 [2/5] 正在呼叫模型: ${modelId}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: siteConfig.geminiConfig.systemPrompt },
          ...historyMessages,
          { role: 'user', content: message }
        ],
        temperature: siteConfig.geminiConfig.temperature,
        max_tokens: siteConfig.geminiConfig.maxOutputTokens
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("🚨 Qwen 拒绝了请求:", JSON.stringify(data));
      return new Response(JSON.stringify({
        error: `模型拒绝访问: ${response.status}`,
        details: data.error?.message || "未知错误"
      }), { status: response.status });
    }

    console.log("✅ [3/5] 百炼成功响应");
    const reply = data.choices?.[0]?.message?.content || "本喵现在不想理你喵...";

    console.log("🎉 [4/5] 回复已生成，准备传回前端");

    return new Response(JSON.stringify({ reply }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("🔥 [5/5] 运行时崩溃:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function GET() {
  return new Response(JSON.stringify({ status: "Ready", model: siteConfig.geminiConfig.modelId }), { status: 200 });
}
