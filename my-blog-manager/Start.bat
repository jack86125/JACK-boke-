@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo [调试] 脚本所在目录：%~dp0
echo [调试] 开始检测Python环境...

:: 1. 优先尝试 py -3.10（兼容多Python版本）
set "PY_CMD="
py -3.10 --version >nul 2>&1
if not errorlevel 1 set "PY_CMD=py -3.10"

:: 2. 兜底：使用默认 python（让 Python 自己校验版本，避免批处理解析版本号的坑）
if not defined PY_CMD (
    python --version >nul 2>&1
    if not errorlevel 1 (
        python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
        if not errorlevel 1 set "PY_CMD=python"
    )
)

:: 3. 仍无可用解释器则报错（所有失败路径都会 pause，绝不闪退）
if not defined PY_CMD (
    echo ❌ 错误：未找到 Python 3.10 及以上版本！
    echo.
    echo    当前系统检测到的 Python 信息：
    python --version 2>&1
    echo.
    echo    排查步骤：
    echo    1. 前往 https://www.python.org/downloads/ 安装 Python 3.10 或更高版本
    echo    2. 安装时务必勾选 "Add Python to PATH"
    echo    3. 重新打开本脚本重试
    echo.
    pause
    exit /b 1
)

echo [状态] 使用解释器：%PY_CMD%
echo [状态] 开始检查依赖并启动控制台，请稍候...

%PY_CMD% run_me.py
if errorlevel 1 (
    echo.
    echo ❌ 错误：run_me.py 执行失败！请把上方报错截图后反馈。
    echo.
    pause
    exit /b 1
)

echo ✅ 程序执行完成
exit /b 0
