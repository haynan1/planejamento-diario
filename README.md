# Planejamento Diário

Aplicativo mobile feito com Expo e React Native para organizar metas diárias, acompanhar progresso, histórico, conquistas, relatórios e perfil.

Este projeto está preparado para Android e iPhone usando Expo/EAS Build. No Android, você pode gerar APK para instalação direta ou AAB para Play Store. No iPhone, você pode gerar builds iOS para simulador, teste interno/TestFlight ou produção/App Store.

Ele não precisa de Python, backend, MongoDB, Docker, Android Studio ou Xcode para o fluxo principal com EAS Build na nuvem. Os dados do usuário ficam salvos no próprio aparelho com AsyncStorage.

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
    eas.json               Configuração para gerar builds Android e iOS
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
- Uma conta Expo, para gerar builds pelo EAS Build
- Uma conta Apple Developer, se for gerar build iOS para iPhone físico/TestFlight/App Store

Você não precisa instalar Python, venv, MongoDB, Docker, Android Studio ou Xcode para gerar builds pela nuvem do EAS.

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

Este modo é bom para testar antes de gerar uma build instalável.

```bash
cd aplicativo
npm start
```

Depois:

1. Instale o app Expo Go no Android ou iPhone.
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

Importante: APK é apenas para Android. Para iPhone, use uma das opções de build iOS abaixo.

## Gerar Build para iPhone

No Windows não é possível compilar iOS localmente com Xcode, mas este projeto está configurado para usar o EAS Build na nuvem.

Antes de gerar pela primeira vez, entre na sua conta Expo:

```bash
cd aplicativo
npx eas-cli@latest login
```

Para gerar uma build de teste para iPhone físico:

```bash
cd aplicativo
npm run build:ios:preview
```

Para gerar uma build para simulador iOS:

```bash
cd aplicativo
npm run build:ios:simulator
```

Para gerar uma build de produção para App Store/TestFlight:

```bash
cd aplicativo
npm run build:ios:production
```

Observação: para instalar em iPhone físico, TestFlight ou App Store, a Apple exige conta Apple Developer e configuração de credenciais/certificados durante o fluxo do EAS.

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

## Gerar Arquivo para App Store/TestFlight

Para publicar ou testar via TestFlight, gere uma build iOS de produção:

```bash
cd aplicativo
npm run build:ios:production
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
npm run build:ios:simulator  # gera build iOS para simulador
npm run build:ios:preview    # gera build iOS para teste em iPhone
npm run build:ios:production # gera build iOS para TestFlight/App Store
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

Se o aplicativo for desinstalado, esses dados podem ser apagados pelo Android ou iOS.

## Configuração Atual do App

- Nome exibido: `Planejamento Diário`
- Identificador Android: `com.haynan.planejamentodiario`
- Identificador iOS: `com.haynan.planejamentodiario`
- Tipo de build para instalação direta: APK
- Tipo de build para iPhone: iOS via EAS Build
- Pasta principal do app: `aplicativo`
