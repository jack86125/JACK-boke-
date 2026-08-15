import os
import subprocess
from datetime import datetime
from fastapi import APIRouter

router = APIRouter()

# 仓库根目录 = cms_core/api 向上三级 (.../XinghuisamaBlogs)
CURRENT_API_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(CURRENT_API_DIR, "..", "..", ".."))

# git 操作公共参数:UTF-8 解码、非法字符替换,防止 Windows GBK 环境崩溃
GIT_RUN = dict(
    cwd=REPO_ROOT,
    capture_output=True,
    text=True,
    encoding="utf-8",
    errors="replace"
)


@router.post("/push")
def push_to_github():
    """一键推送:git add -A → commit → push origin <当前分支>(同步 def 端点,跑在线程池,不阻塞事件循环)"""
    try:
        # 1. 暂存所有改动
        add = subprocess.run(["git", "add", "-A"], **GIT_RUN)
        if add.returncode != 0:
            return {"success": False, "message": "❌ git add 失败", "detail": (add.stderr or add.stdout).strip()}

        # 2. 提交(无改动时不视为失败)
        commit_msg = f"📝 更新博客内容 ({datetime.now().strftime('%m-%d %H:%M')})"
        commit = subprocess.run(["git", "commit", "-m", commit_msg], **GIT_RUN)
        nothing = "nothing to commit" in (commit.stdout + commit.stderr).lower()

        # 3. 解析当前分支并推送
        branch_res = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], **GIT_RUN)
        branch = (branch_res.stdout or "").strip()
        if branch_res.returncode != 0 or not branch or branch == "HEAD":
            return {"success": False, "message": "❌ 无法解析当前分支,请检查 Git 仓库状态", "detail": (branch_res.stderr or "").strip()}

        try:
            push = subprocess.run(["git", "push", "origin", branch], timeout=180, **GIT_RUN)
        except subprocess.TimeoutExpired:
            return {"success": False, "message": "❌ 推送超时(180 秒),可能是网络问题,请稍后重试", "detail": "git push 超过 180 秒未完成"}

        if push.returncode != 0:
            if "everything up-to-date" in (push.stdout + push.stderr).lower():
                pass
            else:
                return {"success": False, "message": "❌ 推送失败(多为网络不通),改动已安全提交在本地,请稍后重试", "detail": (push.stderr or push.stdout).strip()[-2000:]}

        if nothing:
            return {"success": True, "message": "✅ 没有新的改动,远端已是最新版本", "detail": ""}

        return {"success": True, "message": "✅ 已推送到 GitHub!若已绑定 Vercel,线上将自动更新(约 1~3 分钟)", "detail": f"commit: {commit_msg}"}
    except Exception as e:
        return {"success": False, "message": "❌ 推送引擎异常", "detail": str(e)}
