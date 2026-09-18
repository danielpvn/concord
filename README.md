# ?? Concord — Hub Privado Gamer

<p align=center>
  <img src=client/public/concord-wordmark-master.webp alt=Concord Logo width=360 />
</p>

Concord é uma plataforma privada, leve e moderna de comunicação por voz, compartilhamento de tela e chat em tempo real, construída sob medida para grupos de amigos e comunidades de jogos.

---

## ? Principais Funcionalidades

- ??? **Canais de Voz em Tempo Real (Mesh P2P WebRTC & WebSockets):**
  - Detecção de Atividade de Voz (Noise Gate configurável).
  - Indicador visual de fala com auréola verde (*speaking glow*).
  - Sliders de volume individual para cada amigo na sala.
  - Moderação com Mute e Deafen local e de servidor.
- ??? **Compartilhamento de Tela em Alta Definição:**
  - Transmissão de gameplay e telas inteiras com áudio do sistema.
  - Palco dinâmico com foco central e visualização de streams simultâneas.
- ?? **Chat em Tempo Real & Drag and Drop:**
  - Envio de imagens e memes via arrastar e soltar diretamente no chat.
  - Pré-visualização instantânea de links de imagens da internet.
  - Arrastar e soltar amigos entre canais de voz (Moderadores/Dono).
- ?? **Controle de Acesso (RBAC) & Segurança:**
  - Papéis de **OWNER** (Dono da sala), **ADMIN** (Moderador) e **MEMBER** (Membro).
  - Redefinição instantânea de senhas esquecidas pelo Dono/Admin sem dependência de e-mails.
  - Troca de apelido em tempo real com propagação instantânea via WebSocket.
- ??? **Personalização de Perfil:**
  - Recorte e redimensionamento interativo de fotos de perfil (Upload do PC ou URL da Web).
  - 8 opções de cores de destaque na paleta dark gaming.
- ?? **Aplicativo Desktop Profissional:**
  - Instalador completo para Windows (Concord-Setup.exe) com atalhos na Área de Trabalho e Menu Iniciar.
  - Banner inteligente de aviso e aplicação de novas versões (UpdateBanner).

---

## ?? Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) v18+ ou v20+

### Instalação e Execução
`ash
# Instalar dependências de todos os módulos
npm install
npm install --prefix server
npm install --prefix client
npm install --prefix desktop

# Iniciar servidor e frontend juntos
npm run dev
# Ou no Windows com 1 duplo clique em iniciar.bat
`

---

## ?? Como Gerar o Instalador Desktop para Windows

Para compilar um instalador .exe pronto para enviar para os amigos:
`ash
# Executa o script automatizado de build e Inno Setup
.\gerar_app_desktop.bat
`
O arquivo gerado estará em desktop/dist-installer/Concord-Setup.exe.

---

## ?? Deploy na Nuvem (Render / All-in-One)

1. Conecte este repositório no **[Render.com](https://render.com)**.
2. Crie um novo **Web Service**.
3. Configure:
   - **Build Command:** 
pm run build
   - **Start Command:** 
pm start
4. O Render irá compilar o frontend e rodar o servidor Node.js com WebSockets e SSL automático!

---

## ?? Licença
Distribuído sob licença privada para amigos.
