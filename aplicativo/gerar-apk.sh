#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  bash ./instalar-dependencias.sh
fi

npx eas-cli@latest build -p android --profile preview
