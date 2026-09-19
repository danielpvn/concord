# Concord - Guia de Contexto para Claude (CLAUDE.md)

Este documento fornece o contexto completo sobre a arquitetura, regras de desenvolvimento, fluxos de build e decisões do projeto **Concord**.

---

## 🎯 1. Visão Geral do Projeto
O **Concord** é uma plataforma privada de comunicação para gamers inspirada no Discord, contendo canais de voz WebRTC em malha (mesh), canais de texto com upload de imagens/GIFs, compartilhamento de tela com áudio, moderação por cargos (Dono, Admin, Membro) e empacotamento para aplicativo Desktop (Windows Electron) e Mobile Web.

- **URL de Produção (Render):** `https://concord-l08s.onrender.com`
- **Repositório GitHub:** `https://github.com/danielpvn/concord` (Branch principal: `master`)
- **Dono Permanente:** Usuário `Daniel` (Senha padrão `daniel123`, cargo `OWNER`).

---

## 🏗️ 2. Estrutura do Monorepo

```
/
├── client/                     # Frontend React (SPA)
│   ├── src/
│   │   ├── components/         # Componentes organizados por domínio
│   │   │   ├── admin/          # Modal de Gerenciamento do Dono (exclusão/reset de membros)
│   │   │   ├── auth/           # Login / Registro / AuthModal
│   │   │   ├── channels/       # SidebarChannels (Drawer retrátil no Mobile, fixo no Desktop)
│   │   │   ├── chat/           # ChatDrawer, mensagens, envio de fotos/prints
│   │   │   ├── controls/       # ControlBar inferior responsiva (Mic, Fone, Tela, Settings, Dono, Sair)
│   │   │   ├── settings/       # Modal de Perfil, Foto/Crop, Cor, Sensibilidade de Voz, Troca de Senha
│   │   │   ├── ui/             # Avatar, Modal, Cropper
│   │   │   └── voice/          # VoiceGrid (Avatares/Vídeo), RemoteAudioRenderer
│   │   ├── context/            # Estados globais (AuthContext, SocketContext, VoiceContext)
│   │   └── services/           # api.js (cliente REST)
│   ├── dist/                   # Build de produção do Vite (servido pelo backend no Render)
│   └── vite.config.js
│
├── server/                     # Backend Node.js / Express / Socket.io
│   ├── prisma/
│   │   ├── schema.prisma       # Modelos SQLite (User, Channel, Message)
│   │   └── dev.db              # Banco SQLite local
│   ├── src/
│   │   ├── controllers/        # authController, channelController, adminController
│   │   ├── middleware/         # authMiddleware (JWT), uploadMiddleware (Multer para imagens)
│   │   ├── routes/             # api.js (Rotas REST /api/*)
│   │   ├── services/           # seedService.js (Garante canais e Dono fixo sem apagar usuários)
│   │   ├── sockets/            # socketHandler.js (Eventos Socket.io e sinalização WebRTC)
│   │   └── index.js            # Servidor HTTP + WebSocket + Express estático para client/dist
│   └── uploads/                # Armazenamento de avatares e mídias de chat
│
├── desktop/                    # Aplicativo Desktop (Electron para Windows)
│   ├── main.js                 # Inicialização do Electron, getDisplayMedia handler nativo
│   ├── ui/                     # Cópia estática do client/dist para fallback offline
│   ├── icon.ico                # Ícone gamer do aplicativo
│   └── package.json            # Scripts de build do executável (Inno Setup / Packager)
│
└── CLAUDE.md                   # Este guia de contexto para Claude
```

---

## ⚡ 3. Regras Arquiteturais Críticas

### 3.1. Banco de Dados e Persistência de Logins
- O banco utilizado é **SQLite via Prisma ORM**.
- **NUNCA execute `deleteMany` automático em `seedService.js`**. O `seedService.js` deve apenas garantir que os canais padrão existam e que a conta `Daniel` esteja com o cargo `OWNER`. Todas as contas criadas por outros usuários devem permanecer **salvas permanentemente**.
- Moderação de contas: O Dono tem endpoints dedicados em `adminController.js` (`DELETE /api/admin/users/:id` e `POST /api/admin/reset-members`).

### 3.2. WebRTC e Áudio
- **Comunicação Mesh P2P**: Os clientes negociam ofertas e respostas SDP via socket `webrtc_signal`.
- **Microfone**: A faixa local `audioTrack.enabled` deve permanecer `true` enquanto o usuário não estiver explicitamente mutado (`isMuted` ou `isServerMuted`).
- **Filtros WebRTC**: Devem sempre incluir `{ echoCancellation: true, noiseSuppression: true, autoGainControl: true, googNoiseSuppression: true, googEchoCancellation: true }`.
- **Reprodução Remota**: `RemoteAudioRenderer.jsx` renderiza elementos `<audio>` fora da tela com tratamento de erro em `audioEl.volume` para compatibilidade total com iOS/Safari e Android.

### 3.3. Compartilhamento de Tela (Screen Sharing)
- Ao iniciar `toggleScreenShare`, o stream é transmitido ativamente para todos os peers da sala com `streamType: 'screen'`.
- O servidor propaga `user_screen_state_changed` e atualiza `onlineUsers`.
- No Electron (`desktop/main.js`), a captura de tela utiliza `session.defaultSession.setDisplayMediaRequestHandler` com `desktopCapturer.getSources({ types: ['screen', 'window'] })`.

### 3.4. Layout e Responsividade Mobile
- A aplicação utiliza `h-[100dvh]` para respeitar a barra de navegação dinâmica do Safari/iOS.
- No celular (`md:hidden`), a lista de canais é um **Drawer deslizante** acionado pelo botão `☰` no topo do `VoiceGrid`.
- A `ControlBar.jsx` utiliza padding e ícones proporcionais (`p-1.5 xs:p-2 sm:p-3`) para garantir que todos os 8 botões caibam em telas estreitas (iPhone SE / 375px) sem rolagem lateral ou quebras.

---

## 🛠️ 4. Comandos de Desenvolvimento e Build

> [!NOTE]
> No ambiente Windows, se a política de execução do PowerShell bloquear scripts `.ps1`, utilize o prefixo `cmd /c` para rodar comandos do npm.

### Executar em Desenvolvimento Local:
```powershell
# 1. Iniciar o servidor (Porta 3001)
cd server
npm run dev

# 2. Iniciar o cliente Vite (Porta 5173)
cd client
npm run dev
```

### Compilar e Sincronizar Frontend para Deploy:
```powershell
# Compila o cliente Vite e copia os arquivos estáticos para o desktop/ui
cmd /c "cd client && npm run build && xcopy /E /I /Y dist ..\desktop\ui"
```

### Git & Deploy Automático no Render:
O Render realiza o deploy automático a cada push na branch `master`:
```powershell
git add .
git commit -m "sua mensagem"
git push origin master
```

---

## 🔒 5. Variáveis de Ambiente

### Servidor (`server/.env` ou Render Environment):
- `PORT`: `3001` (ou fornecida dinamicamente pelo Render via `$PORT`)
- `NODE_ENV`: `production`
- `DATABASE_URL`: `file:./dev.db`
- `JWT_SECRET`: Chave secreta de autenticação
- `CLIENT_URL`: `https://concord-l08s.onrender.com`

---

## 🤝 6. Dicas para Agentes Claude
- **Sempre verifique imports e desestruturações**: Em componentes React que usam `useSocket()`, `useVoice()` ou `useAuth()`, certifique-se de que todas as variáveis utilizadas (como `socket`, `videoRef`, etc.) estejam declaradas.
- **Mantenha o build limpo**: Sempre teste rodando `npm run build` na pasta `client` após alterar código de frontend.
- **Sincronize o Desktop**: Sempre que o frontend for atualizado, sincronize `client/dist` para `desktop/ui`.
