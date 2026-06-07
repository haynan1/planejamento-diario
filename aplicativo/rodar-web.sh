#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  bash ./instalar-dependencias.sh
fi

npx expo start --web --port 8081
