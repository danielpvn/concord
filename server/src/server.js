import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import apiRoutes from './routes/api.js';
import { setupSocketHandlers } from './sockets/socketHandler.js';
import { seedDatabase } from './services/seedService.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json());

// Servir arquivos estáticos da pasta de uploads (imagens e arquivos do chat)
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Download do app desktop: sempre a última versão publicada nas Releases do GitHub
app.get('/Concord-Setup.exe', (req, res) => {
  res.redirect(302, 'https://github.com/danielpvn/concord/releases/latest/download/Concord-Setup.exe');
});

// Rotas da API
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Servir frontend compilado (All-in-One Mode para Render / Nuvem / Web)
const possibleDistPaths = [
  path.join(process.cwd(), 'client', 'dist'),
  path.join(process.cwd(), '..', 'client', 'dist'),
  path.join(process.cwd(), 'dist')
];

const clientDistPath = possibleDistPaths.find(p => fs.existsSync(path.join(p, 'index.html')));

if (clientDistPath) {
  console.log(`🌐 Servindo interface web do frontend a partir de: ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  // SPA Fallback: Qualquer rota não-API direciona para o index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Configurar WebSockets
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;

// Inicializar banco e iniciar servidor
const startServer = async () => {
  try {
    await seedDatabase();
    server.listen(PORT, () => {
      console.log(`🚀 Servidor Concord rodando com sucesso na porta ${PORT}`);
      console.log(`📡 WebSocket pronto para conexões em tempo real`);
    });
  } catch (err) {
    console.error('Erro ao iniciar o servidor:', err);
  }
};

startServer();
