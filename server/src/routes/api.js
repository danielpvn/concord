import { Router } from 'express';
import { register, login, getMe, updateProfile, changePassword } from '../controllers/authController.js';
import { getChannels, createChannel, deleteChannel, getChannelMessages } from '../controllers/channelController.js';
import { getAllUsers, promoteToAdmin, demoteFromAdmin, toggleServerMute, resetUserPassword, deleteUser, resetAllMembers } from '../controllers/adminController.js';
import { upload, handleFileUpload } from '../controllers/uploadController.js';
import { generateLiveKitToken } from '../services/livekitService.js';
import { getIceServers, hasTurnConfigured } from '../services/iceService.js';
import { requireAuth, requireAdmin, requireOwner } from '../middleware/auth.js';

const router = Router();

// --- Rotas de Autenticação ---
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', requireAuth, getMe);
router.put('/auth/profile', requireAuth, updateProfile);
router.post('/auth/change-password', requireAuth, changePassword);

// Upload dedicado para avatar
router.post('/auth/avatar', requireAuth, upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma imagem enviada' });
  }
  const avatarUrl = `/uploads/${req.file.filename}`;
  return res.json({ avatarUrl });
});

// --- Rota de Verificação de Versão (Auto-Update) ---
router.get('/version', (req, res) => {
  res.json({
    version: '1.0.1',
    releaseDate: new Date().toISOString(),
    releaseNotes: 'Melhorias de desempenho, upload de avatar personalizado e atualizações em tempo real.'
  });
});

// --- Rotas de Canais e Mensagens ---
router.get('/channels', requireAuth, getChannels);
router.post('/channels', requireAuth, requireAdmin, createChannel);
router.delete('/channels/:id', requireAuth, requireAdmin, deleteChannel);
router.get('/channels/:id/messages', requireAuth, getChannelMessages);

// --- Rotas de Administração e Moderação ---
router.get('/admin/users', requireAuth, getAllUsers);
router.post('/admin/users/:userId/promote', requireAuth, requireOwner, promoteToAdmin);
router.post('/admin/users/:userId/demote', requireAuth, requireOwner, demoteFromAdmin);
router.post('/admin/users/:userId/server-mute', requireAuth, requireAdmin, toggleServerMute);
router.post('/admin/users/:userId/reset-password', requireAuth, requireAdmin, resetUserPassword);
router.delete('/admin/users/:userId', requireAuth, requireOwner, deleteUser);
router.post('/admin/reset-all-members', requireAuth, requireOwner, resetAllMembers);


// --- Rota de Upload de Arquivos / Imagens para o Chat ---
router.post('/upload', requireAuth, upload.single('file'), handleFileUpload);

// --- Servidores ICE (STUN/TURN) para o WebRTC ---
router.get('/ice-servers', requireAuth, async (req, res) => {
  const iceServers = await getIceServers();
  return res.json({ iceServers, hasTurn: hasTurnConfigured(iceServers) });
});

// --- Rota de Token LiveKit ---
router.post('/livekit/token', requireAuth, async (req, res) => {
  try {
    const { roomName } = req.body;
    const token = await generateLiveKitToken({
      roomName: roomName || 'general-voice',
      participantIdentity: req.user.id,
      participantName: req.user.username
    });

    return res.json({
      token,
      livekitUrl: process.env.LIVEKIT_URL || null,
      isLivekitConfigured: Boolean(process.env.LIVEKIT_URL && token)
    });
  } catch (err) {
    console.error('Erro ao gerar token LiveKit:', err);
    return res.status(500).json({ error: 'Erro ao gerar token' });
  }
});

export default router;
