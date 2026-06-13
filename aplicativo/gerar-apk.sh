#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

npx eas-cli@latest build -p android --profile preview
