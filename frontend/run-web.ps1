$ErrorActionPreference = "Stop"

if (!(Test-Path "node_modules")) {
  .\setup-frontend.ps1
}

npx.cmd expo start --web --port 8081
