from fastapi import APIRouter, Body, UploadFile, File, Form
import httpx
import time
import secrets
import io
from pathlib import Path
from PIL import Image, ImageOps

router = APIRouter()


@router.post("/test")
async def test_picbed_connection(payload: dict = Body(...)):
    url = payload.get("url", "").strip().rstrip('/')
    token = payload.get("token", "").strip()

    if not url or not token:
        return {"success": False, "message": "图床 API 地址和 Token 不能为空"}

    test_endpoint = f"{url}/api/v1/profile"
    if not token.startswith("Bearer "):
        token = f"Bearer {token}"

    headers = {"Authorization": token, "Accept": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(test_endpoint, headers=headers)
            if response.status_code != 200:
                return {"success": False, "message": f"校验失败，服务器返回了 {response.status_code} 错误"}

            data = response.json()
            if data.get("status") is True:
                user_email = data.get("data", {}).get("email", "未知用户")
                return {"success": True, "message": f"连接成功！当前账户: {user_email}"}
            else:
                return {"success": False, "message": f"Token 无效: {data.get('message', '未知错误')}"}
    except Exception as e:
        return {"success": False, "message": f"网络异常: {str(e)}"}


# 👇 【本地化改造】：图片不再上传外部图床，直接保存到本地 public/images/ 图片库
# picbed.py 位于 my-blog-manager/cms_core/api/ 下，据此推算双端 public 目录
_API_DIR = Path(__file__).resolve().parent      # .../my-blog-manager/cms_core/api
_MANAGER_DIR = _API_DIR.parents[1]              # .../my-blog-manager
_REPO_ROOT = _API_DIR.parents[2]                # .../XinghuisamaBlogs

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg"}

# 🌟 压缩规格：最长边 1600px，质量 85 (网页显示肉眼无差，体积约为原图 1/10)
MAX_SIDE = 1600
QUALITY = 85


def compress_image(content: bytes, ext: str):
    """上传即压缩：等比缩到最长边 1600px 以内；透明 PNG 转 WebP 保留透明；其余转 JPEG；动图原样保留。失败则原样返回。"""
    try:
        img = Image.open(io.BytesIO(content))
        fmt = (img.format or "").upper()

        # 动图不压缩，保持动画帧
        if fmt == "GIF":
            return content, ".gif"

        # 手机照片的 EXIF 方向校正 (否则竖拍图会横过来)
        img = ImageOps.exif_transpose(img)

        # 只缩小不放大的等比缩放
        w, h = img.size
        if max(w, h) > MAX_SIDE:
            ratio = MAX_SIDE / max(w, h)
            img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

        out = io.BytesIO()
        if fmt == "PNG" and img.mode in ("RGBA", "LA", "P"):
            # 带透明通道 → WebP 保留透明
            img.convert("RGBA").save(out, "WEBP", quality=QUALITY)
            return out.getvalue(), ".webp"

        # 其余 (JPEG / 不带透明的 PNG / 其他) 统一转 JPEG
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.save(out, "JPEG", quality=QUALITY, optimize=True)
        return out.getvalue(), ".jpg"
    except Exception as e:
        print(f"WARN compress skipped, keep original: {e}")
        return content, ext


@router.post("/upload")
async def upload_image(
        file: UploadFile = File(...),
        url: str = Form(""),
        token: str = Form("")
):
    """把图片保存到本地图库 (后台 + 前端双端 public/images/)，返回 /images/xxx.jpg 本地路径"""
    content = await file.read()
    if not content:
        return {"success": False, "message": "文件内容为空，请重新选择图片"}

    # 校验扩展名，白名单之外的统一按 jpg 处理
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        ext = ".jpg"

    # 🌟 上传即压缩：转成网页显示规格，体积降到原图 1/10 左右，肉眼无差
    content, ext = compress_image(content, ext)

    # 时间戳 + 随机串命名，避免重名覆盖
    filename = f"upload_{time.strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(3)}{ext}"

    targets = [
        _MANAGER_DIR / "public" / "images" / filename,
        _REPO_ROOT / "XHBlogs" / "public" / "images" / filename,
    ]

    saved_count = 0
    for dest in targets:
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(content)
            saved_count += 1
            print(f"OK saved: {dest}")
        except Exception as e:
            print(f"WARN save failed: {dest} -> {e}")

    if saved_count == 0:
        return {"success": False, "message": "本地图片库写入失败，请检查磁盘或目录权限"}

    return {"success": True, "message": f"已保存到本地图片库 ({saved_count} 端)", "url": f"/images/{filename}"}