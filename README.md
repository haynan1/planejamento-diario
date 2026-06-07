# Planejamento Diário

Aplicativo mobile feito com Expo e React Native para organizar metas diárias, acompanhar progresso, histórico, conquistas, relatórios e perfil.

Este projeto está preparado para gerar um APK instalável no Android. Ele não precisa de Python, backend, MongoDB, Docker ou Android Studio para funcionar no celular. Os dados do usuário ficam salvos no próprio aparelho com AsyncStorage.

## Importante: Use Git Bash

As instruções deste projeto foram preparadas para executar pelo **Git Bash**, não pelo PowerShell.

No Windows:

1. Clique com o botão direito dentro da pasta `planejamento-diario`.
2. Escolha `Open Git Bash here` ou `Abrir Git Bash aqui`.
3. Rode os comandos exatamente como aparecem neste README.

## Estrutura de Pastas

```text
planejamento-diario/
  aplicativo/              Projeto Expo/React Native
    app/                   Telas e rotas do aplicativo
    assets/                Ícones, splash screen e imagens
    constants/             Constantes usadas pelo app
    scripts/               Scripts auxiliares do template Expo
    src/
      api/                 Camada local de dados do app
      components/          Componentes reutilizáveis
      constants/           Tipos, categorias e frases
      notifications/       Notificações locais
      theme/               Tema visual
      utils/               Utilitários de armazenamento e fontes
    app.json               Configuração do aplicativo
    eas.json               Configuração para gerar APK/AAB
    package.json           Dependências e comandos npm
    instalar-dependencias.sh
    rodar-web.sh
    gerar-apk.sh
  README.md                Instruções principais
```

## Requisitos no PC

Instale apenas:

- Node.js
- npm
- Git Bash
- Uma conta Expo, para gerar o APK pelo EAS Build

Você não precisa instalar Python, venv, MongoDB, Docker ou Android Studio.

## Instalar as Dependências

No Git Bash, rode:

```bash
cd aplicativo
bash ./instalar-dependencias.sh
```

Ou manualmente:

```bash
cd aplicativo
npm install
```

As dependências ficam dentro de `aplicativo/node_modules`.

## Ver o App no PC

Para abrir no navegador:

```bash
cd aplicativo
bash ./rodar-web.sh
```

Depois acesse:

```text
http://localhost:8081
```

## Testar no Celular com Expo Go

Este modo é bom para testar antes de gerar o APK.

```bash
cd aplicativo
npm start
```

Depois:

1. Instale o app Expo Go no Android.
2. Leia o QR Code que aparecer no terminal ou navegador.
3. O aplicativo será aberto no celular em modo de desenvolvimento.

## Gerar o APK para Instalar no Android

O APK é o arquivo instalável para Android.

Antes de gerar pela primeira vez, entre na sua conta Expo:

```bash
cd aplicativo
npx eas-cli@latest login
```

Se ainda não tiver conta, crie uma gratuitamente:

```text
https://expo.dev/signup
```

Agora gere o APK:

```bash
cd aplicativo
bash ./gerar-apk.sh
```

Na primeira execução, o Expo/EAS pode perguntar se você quer configurar o projeto na sua conta. Responda `Y`.

Ao final, o terminal vai mostrar um link do build. Abra esse link para baixar o arquivo `.apk`.

## Instalar o APK no Celular

Depois que o APK estiver pronto:

1. Abra o link do build no navegador.
2. Baixe o arquivo `.apk`.
3. Se você baixou no PC, envie o APK para o celular.
4. No Android, abra o arquivo `.apk`.
5. Se aparecer bloqueio de segurança, toque em `Configurar` ou `Permitir desta fonte`.
6. Volte para a instalação e toque em `Instalar`.
7. Depois de instalar, abra o app `Planejamento Diário`.

Você pode enviar o APK para o celular por cabo USB, WhatsApp, Telegram, Google Drive, OneDrive ou baixando direto pelo navegador do próprio celular.

Importante: APK é para Android. Para iPhone, o processo é outro e envolve build iOS/TestFlight/App Store.

## Atualizar o App no Celular

Quando fizer mudanças no app, gere outro APK:

```bash
cd aplicativo
bash ./gerar-apk.sh
```

Depois baixe o novo APK e instale por cima do anterior.

O Android normalmente mantém os dados locais quando você instala uma atualização por cima, desde que o identificador do app continue igual:

```text
com.haynan.planejamentodiario
```

Se você desinstalar o app antes de instalar novamente, os dados locais podem ser apagados.

## Gerar Arquivo para Play Store

Para publicar na Play Store, gere um Android App Bundle:

```bash
cd aplicativo
npm run build:android:aab
```

## Comandos Úteis

Todos os comandos abaixo devem ser executados dentro da pasta `aplicativo`.

```bash
npm start                 # abre o Expo
npm run web               # roda no navegador
npm run rodar:web         # roda no navegador usando o script Bash
npm run lint              # valida o projeto
npm run gerar:apk         # gera APK usando o script Bash
npm run build:android:apk # gera APK pelo EAS
npm run build:android:aab # gera AAB para Play Store
```

## Dados Salvos no Celular

O aplicativo salva localmente:

- metas
- perfil
- tema
- avatar
- conquistas
- relatórios
- status premium local

Se o aplicativo for desinstalado, esses dados podem ser apagados pelo Android.

## Configuração Atual do App

- Nome exibido: `Planejamento Diário`
- Identificador Android: `com.haynan.planejamentodiario`
- Tipo de build para instalação direta: APK
- Pasta principal do app: `aplicativo`
