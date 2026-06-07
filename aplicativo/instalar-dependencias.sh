#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

npm install

echo "Aplicativo pronto com dependencias locais em: aplicativo/node_modules"
