#!/usr/bin/env bash
# Local AI Dashboard Launcher

echo "==> Запуск Local AI Hub..."
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "[!] Ошибка: Node.js не найден в системе. Установите Node.js (например через: brew install node)."
    exit 1
fi

echo "==> Сервер запускается на http://localhost:3000"
echo "==> Откройте http://localhost:3000 в браузере"

# Auto-open in default browser on macOS if available
if [[ "$OSTYPE" == "darwin"* ]]; then
    (sleep 1 && open "http://localhost:3000") &
fi

exec node server.js
