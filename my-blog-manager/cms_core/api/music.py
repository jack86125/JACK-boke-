from fastapi import APIRouter, UploadFile, File
import requests
import time
import secrets
from pathlib import Path

router = APIRouter()

# 👇 【本地化改造】：本地音乐直接保存到双端 public/music/，不依赖任何云盘/图床
_API_DIR = Path(__file__).resolve().parent      # .../my-blog-manager/cms_core/api
_MANAGER_DIR = _API_DIR.parents[1]              # .../my-blog-manager
_REPO_ROOT = _API_DIR.parents[2]                # .../XinghuisamaBlogs

ALLOWED_AUDIO_EXT = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"}


@router.get("/query/{song_id}")
def query_netease_music(song_id: str):
    """通过网易云公开接口查询歌曲详情"""
    print(f"\n[API] 🎵 收到查询网易云音乐请求, ID: {song_id}")
    try:
        api_url = f"https://music.163.com/api/song/detail/?id={song_id}&ids=[{song_id}]"
        headers = {
            # 伪装得更像真实浏览器
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Referer": "https://music.163.com/"
        }
        response = requests.get(api_url, headers=headers, timeout=5)

        # 把 HTTP 状态码打出来，如果是 403 就是被网易云拦截了
        print(f"[API] 📡 网易云响应状态码: {response.status_code}")

        data = response.json()

        if data.get("songs") and len(data["songs"]) > 0:
            song = data["songs"][0]
            print(f"[API] ✅ 查询成功: {song['name']} - {song['artists'][0]['name']}")
            return {
                "success": True,
                "data": {
                    "id": song_id,
                    "name": song["name"],
                    "artist": song["artists"][0]["name"],
                    "album": song["album"]["name"],
                    "cover": song["album"]["picUrl"]
                }
            }
        print(f"[API] ❌ 查无此歌 (ID: {song_id})")
        return {"success": False, "message": "未找到该歌曲，可能是 VIP 歌曲或 ID 错误"}

    except Exception as e:
        # 【关键】：在终端里把真正的报错原因打印出来！
        print(f"[API] 💥 网易云接口发生严重错误: {str(e)}")
        return {"success": False, "message": f"后端请求失败: {str(e)}"}


@router.post("/upload")
async def upload_local_music(
        file: UploadFile = File(...),
        lrc: UploadFile = File(None)
):
    """本地音乐上传：mp3 等音频存入双端 public/music/，可选附一个同名 .lrc 歌词文件"""
    content = await file.read()
    if not content:
        return {"success": False, "message": "文件内容为空，请重新选择音乐"}

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_AUDIO_EXT:
        return {"success": False, "message": f"不支持的音频格式 {ext}，仅支持 mp3/wav/ogg/m4a/flac/aac"}

    stem = f"music_{time.strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(3)}"
    filename = f"{stem}{ext}"

    targets = [
        _MANAGER_DIR / "public" / "music" / filename,
        _REPO_ROOT / "XHBlogs" / "public" / "music" / filename,
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
        return {"success": False, "message": "本地音乐库写入失败，请检查磁盘或目录权限"}

    # 可选 LRC 歌词：与音频同名保存，播放器按标准 LRC 时间轴解析
    lrc_url = None
    if lrc is not None:
        try:
            lrc_text = (await lrc.read()).decode("utf-8", errors="ignore").strip()
        except Exception as e:
            lrc_text = ""
            print(f"WARN lrc read failed: {e}")
        if lrc_text:
            for dest in (_MANAGER_DIR / "public" / "music" / f"{stem}.lrc",
                         _REPO_ROOT / "XHBlogs" / "public" / "music" / f"{stem}.lrc"):
                try:
                    dest.write_text(lrc_text, encoding="utf-8")
                except Exception as e:
                    print(f"WARN lrc save failed: {dest} -> {e}")
            lrc_url = f"/music/{stem}.lrc"

    return {
        "success": True,
        "message": f"已保存到本地音乐库 ({saved_count} 端)",
        "url": f"/music/{filename}",
        "lrc": lrc_url,
    }