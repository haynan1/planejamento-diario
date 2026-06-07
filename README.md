# Planejamento Diario

Aplicativo mobile feito com Expo/React Native para organizar metas diarias, acompanhar progresso, historico, conquistas, relatorios e perfil.

O projeto agora funciona sem backend Python, sem MongoDB e sem servidor externo. Os dados ficam salvos no proprio celular usando AsyncStorage.

## O que precisa instalar no PC

- Node.js
- npm
- Uma conta Expo, apenas para gerar APK com EAS Build

Nao precisa instalar Python, venv, MongoDB, Docker ou Android Studio para gerar o APK pelo EAS.

## Estrutura

```text
frontend/
  app/                 Telas e rotas do app
  src/api/client.ts    Camada local de dados
  src/components/      Componentes reutilizaveis
  src/constants/       Tipos, categorias e frases
  src/theme/           Tema visual
  assets/              Icones, splash e imagens
```

## Instalar dependencias

```powershell
cd frontend
.\setup-frontend.ps1
```

Ou manualmente:

```powershell
cd frontend
npm install
```

As dependencias ficam dentro de `frontend\node_modules`.

## Rodar no navegador para ver no PC

```powershell
cd frontend
.\run-web.ps1
```

Abra:

```text
http://localhost:8081
```

## Rodar no celular com Expo Go

```powershell
cd frontend
npm start
```

Depois:

1. Instale o app Expo Go no Android.
2. Leia o QR Code que aparecer no terminal ou navegador.
3. O app abre no celular em modo desenvolvimento.

## Gerar APK instalavel no Android

O projeto ja inclui `frontend/eas.json` configurado para gerar APK no perfil `preview`.

Antes de gerar pela primeira vez, entre na sua conta Expo:

```powershell
cd frontend
npx eas-cli@latest login
```

Se ainda nao tiver conta, crie uma gratuitamente em:

```text
https://expo.dev/signup
```

Agora gere o APK:

```powershell
cd frontend
.\build-apk.ps1
```

Na primeira vez, o Expo/EAS pode perguntar se voce quer configurar o projeto. Pode responder `Y` para ele criar a configuracao do projeto na sua conta Expo.

Ao final do build, o terminal mostra um link para baixar o arquivo `.apk`.

## Instalar o APK no celular Android

Para instalar no celular:

1. Abra o link do build no navegador.
2. Baixe o arquivo `.apk`.
3. Envie o APK para o celular, se voce baixou no PC.
4. No Android, abra o arquivo `.apk`.
5. Se aparecer bloqueio de seguranca, toque em `Configurar` ou `Permitir desta fonte`.
6. Volte para o instalador e toque em `Instalar`.
7. Depois de instalar, abra o app `Planejamento Diario`.

Voce pode passar o APK para o celular por cabo USB, WhatsApp, Telegram, Google Drive, OneDrive ou baixando direto pelo navegador do celular.

Importante: APK e para Android. Para iPhone, o processo e diferente e precisa de build iOS/TestFlight/App Store.

## Atualizar o app no celular

Quando fizer mudancas no app:

```powershell
cd frontend
.\build-apk.ps1
```

Depois baixe o novo APK e instale por cima do anterior. O Android normalmente atualiza o app mantendo os dados locais, desde que o package continue igual:

```text
com.haynan.planejamentodiario
```

Se voce desinstalar o app antes de instalar de novo, os dados locais podem ser apagados.

## Gerar arquivo para Play Store

Para publicar na Play Store, gere um Android App Bundle:

```powershell
cd frontend
npm run build:android:aab
```

## Scripts uteis

```powershell
npm start                 # abre o Expo
npm run web               # roda no navegador
npm run android           # tenta abrir em Android/emulador
npm run lint              # valida lint do Expo
npm run build:android:apk # gera APK via EAS
npm run build:android:aab # gera AAB via EAS
```

## Dados do app

O app salva localmente:

- metas
- perfil
- tema
- avatar
- conquistas
- relatorios
- status premium local

Se o app for desinstalado, os dados locais podem ser apagados pelo Android.

## Observacoes

- O package Android esta configurado como `com.haynan.planejamentodiario`.
- O nome exibido do app esta configurado como `Planejamento Diario`.
- O app nao depende mais de Python ou backend para funcionar no celular.
