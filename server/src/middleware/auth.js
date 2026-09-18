import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'concord-secret-key-gaming-friends-2026');

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        avatarColor: true,
        avatarUrl: true,
        role: true,
        isServerMuted: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

export const requireOwner = (req, res, next) => {
  if (!req.user || req.user.role !== 'OWNER') {
    return res.status(403).json({ error: 'Acesso negado: apenas o Dono (Owner) tem permissão para esta ação.' });
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'OWNER' && req.user.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Acesso negado: apenas Administradores ou o Dono podem realizar esta ação.' });
  }
  next();
};
