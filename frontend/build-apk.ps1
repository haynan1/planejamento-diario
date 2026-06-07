$ErrorActionPreference = "Stop"

if (!(Test-Path "node_modules")) {
  .\setup-frontend.ps1
}

npx.cmd eas-cli@latest build -p android --profile preview
