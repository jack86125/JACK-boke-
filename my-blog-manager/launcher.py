import sys
import os

# 🌟 Windows 兼容：强制 UTF-8 输出，避免中文/Emoji 在 GBK 环境崩溃
for _stream in (sys.stdout, sys.stderr):
    if _stream is not None:
        try:
            _stream.reconfigure(encoding="utf-8")
        except Exception:
            pass

# 🌟 路径定位逻辑
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
    EXE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    EXE_DIR = BASE_DIR

import webview
import threading
import uvicorn
import time
import socket
import json
import subprocess
import traceback
import atexit
import ctypes
from ctypes import wintypes
from cms_core.main import app

frontend_process = None
WINDOW_CONFIG_FILE = os.path.join(EXE_DIR, 'window_config.json')

# =================================================================
# 🧹 进程回收工具箱：确保关窗/崩溃/被强杀时,子进程绝不留孤儿
# =================================================================
_job_handle = None          # 全局持有 Job 句柄,进程存活期间不关闭
_cleanup_done = False       # 幂等开关,清理函数可重复调用

def assign_to_job(pid):
    """把前端进程挂进带 KILL_ON_JOB_CLOSE 的作业对象。
    python 一旦退出(含任务管理器强杀),句柄关闭 → 整棵前端进程树被系统自动处决。"""
    global _job_handle
    if os.name != "nt":
        return
    try:
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

        class IO_COUNTERS(ctypes.Structure):
            _fields_ = [
                ("ReadOperationCount", ctypes.c_ulonglong),
                ("WriteOperationCount", ctypes.c_ulonglong),
                ("OtherOperationCount", ctypes.c_ulonglong),
                ("ReadTransferCount", ctypes.c_ulonglong),
                ("WriteTransferCount", ctypes.c_ulonglong),
                ("OtherTransferCount", ctypes.c_ulonglong),
            ]

        class JOBOBJECT_BASIC_LIMIT_INFORMATION(ctypes.Structure):
            _fields_ = [
                ("PerProcessUserTimeLimit", ctypes.c_longlong),
                ("PerJobUserTimeLimit", ctypes.c_longlong),
                ("LimitFlags", ctypes.c_ulong),
                ("MinimumWorkingSetSize", ctypes.c_size_t),
                ("MaximumWorkingSetSize", ctypes.c_size_t),
                ("ActiveProcessLimit", ctypes.c_ulong),
                ("Affinity", ctypes.c_size_t),
                ("PriorityClass", ctypes.c_ulong),
                ("SchedulingClass", ctypes.c_ulong),
            ]

        class JOBOBJECT_EXTENDED_LIMIT_INFORMATION(ctypes.Structure):
            _fields_ = [
                ("BasicLimitInformation", JOBOBJECT_BASIC_LIMIT_INFORMATION),
                ("IoInfo", IO_COUNTERS),
                ("ProcessMemoryLimit", ctypes.c_size_t),
                ("JobMemoryLimit", ctypes.c_size_t),
                ("PeakProcessMemoryUsed", ctypes.c_size_t),
                ("PeakJobMemoryUsed", ctypes.c_size_t),
            ]

        job = kernel32.CreateJobObjectW(None, None)
        if not job:
            return
        info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION()
        info.BasicLimitInformation.LimitFlags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not kernel32.SetInformationJobObject(job, 9, ctypes.byref(info), ctypes.sizeof(info)):
            kernel32.CloseHandle(job)
            return
        # PROCESS_SET_QUOTA(0x100) | PROCESS_TERMINATE(0x1)
        hproc = kernel32.OpenProcess(0x101, False, pid)
        if not hproc:
            kernel32.CloseHandle(job)
            return
        ok = kernel32.AssignProcessToJobObject(job, hproc)
        kernel32.CloseHandle(hproc)
        if not ok:
            kernel32.CloseHandle(job)
            return
        _job_handle = job  # 必须持有句柄直到进程退出,否则 KILL_ON_JOB_CLOSE 会提前触发
        print(f"🔒 [Job] 前端进程 {pid} 已挂入自动清理作业对象")
    except Exception:
        print(f"⚠️ [Job] 作业对象挂载失败(不影响启动),将依赖进程树清理兜底")

def get_descendant_pids(root_pid):
    """按 ParentProcessId 递归枚举整棵进程树。
    Windows 下孤儿进程保留原始 PPID,即使树根已死也能找到子孙。"""
    try:
        script = (
            "$all = Get-CimInstance Win32_Process; "
            "$frontier = @(" + str(root_pid) + "); $out = @(); "
            "while ($frontier.Count -gt 0) { "
            "$out += $frontier; "
            "$frontier = @($all | Where-Object { $frontier -contains $_.ParentProcessId } | ForEach-Object { $_.ProcessId }) "
            "}; ($out -join ',')"
        )
        raw = subprocess.check_output(
            ["powershell", "-NoProfile", "-Command", script],
            timeout=15, stderr=subprocess.DEVNULL)
        return [int(x) for x in raw.decode(errors="ignore").strip().split(",") if x.strip().isdigit()]
    except Exception:
        return []

def kill_process_tree(root_pid):
    """杀掉以 root_pid 为根的整棵进程树,树根已死则按 PPID 枚举补刀。"""
    if not root_pid:
        return
    try:
        subprocess.run(f"taskkill /PID {root_pid} /T /F", shell=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass
    time.sleep(0.5)
    for pid in get_descendant_pids(root_pid):
        if pid == os.getpid():
            continue
        try:
            subprocess.run(f"taskkill /PID {pid} /T /F", shell=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

def _listeners_on(port):
    """返回正在监听指定端口的 PID 列表(精确匹配端口号,避免旧 findstr 误伤相邻端口)。"""
    pids = []
    try:
        raw = subprocess.check_output(
            ["powershell", "-NoProfile", "-Command",
             f"(Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue).OwningProcess"],
            timeout=15, stderr=subprocess.DEVNULL)
        pids = [int(x) for x in raw.decode(errors="ignore").split() if x.strip().isdigit()]
    except Exception:
        pass
    if not pids:
        try:
            out = subprocess.check_output("netstat -ano", shell=True, timeout=15).decode(errors="ignore")
            for line in out.splitlines():
                parts = line.split()
                if len(parts) >= 5 and parts[1].endswith(f":{port}") and parts[3] == "LISTENING":
                    try:
                        pids.append(int(parts[-1]))
                    except ValueError:
                        pass
        except Exception:
            pass
    return pids

def release_port(port):
    for pid in _listeners_on(port):
        try:
            subprocess.run(f"taskkill /PID {pid} /T /F", shell=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass
    time.sleep(0.3)

def cleanup():
    """关窗/退出时的统一清理:杀前端进程树 + 释放双端口。幂等,可重复调用。"""
    global _cleanup_done
    if _cleanup_done:
        return
    _cleanup_done = True
    print("🧹 [清理] 正在回收子进程与端口...")
    if frontend_process is not None:
        kill_process_tree(frontend_process.pid)
    try:
        release_port(frontend_port)
    except NameError:
        pass
    try:
        release_port(backend_port)
    except NameError:
        pass

# =================================================================
# 🛡️ 看门狗：窗口意外消失(事件没触发/事件处理异常)时强制兜底清理
# =================================================================
def _visible_window_count():
    """统计本进程当前可见的顶层窗口数量(pywebview 窗体归本进程,DevTools 归独立进程不算)。"""
    if os.name != "nt":
        return 1  # 非 Windows 不启用看门狗
    try:
        user32 = ctypes.WinDLL("user32", use_last_error=True)
        found = []

        @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        def _cb(hwnd, _lparam):
            if user32.IsWindowVisible(hwnd):
                pid = wintypes.DWORD()
                user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                if pid.value == os.getpid():
                    found.append(hwnd)
            return True

        user32.EnumWindows(_cb, 0)
        return len(found)
    except Exception:
        return 1

def window_watchdog():
    """等窗口出现后开始盯梢:连续 3 次(约 9 秒)检测不到窗口 → 判定已关闭,强制清理退出。
    只在关窗事件失灵时才会触发,正常路径由 on_closed 先走。"""
    deadline = time.time() + 180  # 首次编译可能较慢,最多等 3 分钟
    while time.time() < deadline:
        if _visible_window_count() > 0:
            break
        if frontend_process is not None and frontend_process.poll() is not None:
            return  # 前端进程已死,窗口永远不会出现
        time.sleep(2)
    else:
        return  # 始终没看到窗口(可能非 Windows 或检测失败),放弃盯梢

    miss = 0
    while True:
        time.sleep(3)
        if _visible_window_count() > 0:
            miss = 0
            continue
        miss += 1
        if miss >= 3:
            print("🛡️ [看门狗] 窗口已消失且关闭事件未触发,强制执行清理...")
            try:
                cleanup()
            except Exception:
                pass
            os._exit(0)

# =================================================================
# 原有功能：端口管理 / 窗口尺寸 / 前后端启动
# =================================================================
def load_window_size():
    try:
        if os.path.exists(WINDOW_CONFIG_FILE):
            with open(WINDOW_CONFIG_FILE, 'r') as f:
                return json.load(f)
    except:
        pass
    return {"width": 1440, "height": 900}

def save_window_size(width, height):
    try:
        with open(WINDOW_CONFIG_FILE, 'w') as f:
            json.dump({"width": int(width), "height": int(height)}, f)
    except:
        pass

def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

def write_port_config(port):
    # 写入解压目录供前端读取
    public_dir = os.path.join(BASE_DIR, 'public')
    os.makedirs(public_dir, exist_ok=True)
    with open(os.path.join(public_dir, 'backend_config.json'), 'w', encoding='utf-8') as f:
        json.dump({"api_port": port}, f)

    standalone_public = os.path.join(BASE_DIR, '.next', 'standalone', 'public')
    if os.path.exists(os.path.join(BASE_DIR, '.next', 'standalone')):
        os.makedirs(standalone_public, exist_ok=True)
        with open(os.path.join(standalone_public, 'backend_config.json'), 'w', encoding='utf-8') as f:
            json.dump({"api_port": port}, f)

def wait_for_port(port, timeout=60):
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with socket.create_connection(('127.0.0.1', port), timeout=1):
                return True
        except (ConnectionRefusedError, socket.timeout, OSError):
            time.sleep(1)
    return False

class WindowAPI:
    def resize_window(self, width, height):
        save_window_size(width, height)
        webview.windows[0].resize(int(width), int(height))
        return True
    def minimize_window(self): webview.windows[0].minimize()
    def maximize_window(self): webview.windows[0].toggle_fullscreen()
    def close_window(self): on_closed()

def run_api(port):
    # 🌟 强制后端在 EXE 所在的真实目录工作，确保能读取到旁边的 data/ 等数据
    os.chdir(EXE_DIR)
    print(f"🟢 [后端] 工作路径已锁定: {EXE_DIR}")
    try:
        uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
    except Exception as e:
        print("❌ [后端] 崩溃报错：")
        traceback.print_exc()

def on_closed():
    try:
        cleanup()
    except Exception:
        pass
    os._exit(0)

def on_shown():
    win_size = load_window_size()
    webview.windows[0].resize(int(win_size["width"]), int(win_size["height"]))

if __name__ == "__main__":
    # 🌟 兜底防线：任何退出路径(正常/异常/atexit)都执行清理,幂等安全
    atexit.register(cleanup)
    try:
        frontend_port = get_free_port()
        backend_port = get_free_port()

        env_vars = os.environ.copy()
        env_vars["PORT"] = str(frontend_port)

        standalone_dir = os.path.join(BASE_DIR, '.next', 'standalone')
        server_js = os.path.join(standalone_dir, 'server.js')

        # 🌟 核心自适应逻辑：判断是“打包运行”还是“开发运行”
        if os.path.exists(server_js):
            print("🚀 [生产模式] 使用 127.0.0.1 强制同步...")
            env_vars["HOSTNAME"] = "127.0.0.1"
            frontend_process = subprocess.Popen(["node", "server.js"], cwd=standalone_dir, env=env_vars, shell=True)
            window_url = f"http://127.0.0.1:{frontend_port}"
        else:
            print("🛠️ [开发模式] 使用 localhost 保持兼容...")
            frontend_process = subprocess.Popen("npm run dev", shell=True, cwd=BASE_DIR, env=env_vars)
            window_url = f"http://localhost:{frontend_port}"

        # 🔒 前端进程树挂进作业对象:python 被强杀时,系统自动处决整棵树
        assign_to_job(frontend_process.pid)

        write_port_config(backend_port)
        threading.Thread(target=run_api, args=(backend_port,), daemon=True).start()

        if not wait_for_port(backend_port) or not wait_for_port(frontend_port):
            print(">>> ❌ 前后端启动失败！")
            cleanup()
            sys.exit(1)

        time.sleep(1.5)

        api = WindowAPI()
        window = webview.create_window(
            title='星辉云端·控制台',
            url=window_url,
            width=1440, height=900, min_size=(1024, 768),
            background_color='#0f172a', resizable=True, frameless=True, easy_drag=False, js_api=api
        )

        window.events.shown += on_shown
        window.events.closed += on_closed

        # 🛡️ 看门狗:窗口意外消失时强制清理(正常关窗由 closed 事件先行处理)
        threading.Thread(target=window_watchdog, daemon=True).start()

        try:
            # 🌟 debug=False：不再每次启动弹出 DevTools 调试窗口(调试时临时改回 True 即可)
            webview.start(debug=False)
        except KeyboardInterrupt:
            on_closed()
    except Exception:
        # 🌟 兜底防线：任何未预期崩溃都保留报错现场，绝不闪退
        print("❌ 控制台启动失败！错误详情如下，请截图反馈：")
        traceback.print_exc()
        cleanup()
        input("按回车键退出...")
        sys.exit(1)
    finally:
        cleanup()
