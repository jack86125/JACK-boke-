// 🛡️ 本文件由控制台自动生成，请勿手动修改

export type Project = {
  id: string;
  name: string;
  description: string;
  icon: string;
  githubUrl: string;
  tags: string[];
};

export const projectsData: Project[] = [
  {
    "id": "proj_1787170609450",
    "name": "企业岗位经验 Skill 生成平台",
    "githubUrl": "https://github.com/jack86125/shuhuazhisuanmianshi",
    "description": "自然语言→执行技能→分析结果。可以让业务人员消耗代码创建AI员工能力。\n自然语言生成Skill、完整执行闭环、多岗位场景、技能资产库、模拟兜底（无钥匙/断网/故障演示不中断）、执行期防幻觉约束（数据不足明显标注、禁止编造）。",
    "icon": "🚀",
    "tags": [
      "Next.js"
    ]
  },
  {
    "id": "proj_1786801551198",
    "name": "AI Director",
    "githubUrl": "https://github.com/jack86125/AI-Director",
    "description": "AI Director 是一个多 Agent 协作的 AI 漫剧创作平台：用户输入一句创意（或剧本、分镜），由 14 个专业 Agent 按确定性管线协作，完成从安全审查、故事架构、剧本、角色、分镜、视频提示词到成片组装的全流程创作。",
    "icon": "🚀",
    "tags": []
  },
  {
    "id": "proj_1786703214587",
    "name": "OpsPilot-Agent-",
    "githubUrl": "https://github.com/jack86125/OpsPilot-Agent-",
    "description": "OpsPilot 接受一般警报或工单，允许 DeepSeek 通过受控工具进行多轮证据收集决策，并生成可供人工审核的恢复草案。该模型永远不会获得 shell、云、Docker 或任意 HTTP 权限。只有在操作员创建/审核版本化计划、批准该确切的计划版本，并且代码拥有的执行器使用真实的合成检出验证结果后，恢复才能执行。",
    "icon": "🚀",
    "tags": [
      "Python",
      "FastAPI",
      "LangGraph",
      "Pydantic",
      "Docker  SQLite",
      "deepseek"
    ]
  },
  {
    "id": "proj_1786703138651",
    "name": "AgentLover",
    "githubUrl": "https://github.com/jack86125/AgentLover",
    "description": "企业微信的恋陪代理，她不仅能认真对待和你的每一次聊天，甚至会主动干扰你，还可以识别图片和pdf，后续有望实现语音聊天的功能，快来试试吧～",
    "icon": "🚀",
    "tags": [
      "python",
      "FastAPI",
      "LangGraph",
      "SQLAlchemy",
      "SQLite",
      "React",
      "TypeScript",
      "Vite"
    ]
  },
  {
    "id": "proj_1786703013118",
    "name": " SmartVoyage",
    "githubUrl": "https://github.com/jack86125/SmartVoyage-A2A-Agent-to-Agent-",
    "description": "SmartVoyage是一个基于A2A（Agent-to-Agent）协议与MCP（Model Context Protocol）的多智能体协作旅行助手系统。用户通过自然语言交互，即可完成天气查询、票务查询（火车票/录音/发票票）、票务预订、付费推荐等旅行相关服务。",
    "icon": "🚀",
    "tags": [
      "python",
      "streamlit",
      "langchain",
      "mcp",
      "fastAPI",
      "MySQL"
    ]
  },
  {
    "id": "proj_1786702531514",
    "name": "SmartRecruit-RAG-",
    "githubUrl": "https://github.com/jack86125/SmartRecruit-RAG-",
    "description": "SmartRecruit是一个基于RAG（搜索增强生成）架构的智能招聘助手系统。用户上传简历后，可以用自然语言描述招聘需求，系统自动匹配并推荐最合适的候选人，支持多轮追问对话。\n\n核心流程：上传简历 → 文档解析与处理化 → 自然语言查询 → 意图识别 → 参数提取 → 混合检索 → 重排序 → 生成推荐结果 → 格式化输出\n\n底层整合Milvus（支持存储）+ Elasticsearch（全文搜索）+ MongoDB（文档存储）三大引擎，通过LangChain编排RAG流程，前端使用Streamlit构建Web交互界面",
    "icon": "🚀",
    "tags": [
      "Python",
      "Streamlit",
      "LangChain",
      "LangGraph",
      "Milvus",
      "Elasticsearch",
      "MongoDB",
      "PyTorch",
      ""
    ]
  }
];