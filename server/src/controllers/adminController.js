import bcrypt from 'bcryptjs';
import prisma from '../prisma.js';

export const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        avatarColor: true,
        avatarUrl: true,
        role: true,
        isServerMuted: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });
    return res.json({ users });
  } catch (err) {
    console.error('Erro ao listar usuários:', err);
    return res.status(500).json({ error: 'Erro ao listar usuários' });
  }
};

// Apenas o OWNER tem permissão para promover a Administrador!
export const promoteToAdmin = async (req, res) => {
  try {
    const { userId } = req.params;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (targetUser.role === 'OWNER') {
      return res.status(400).json({ error: 'Este usuário já é o Dono (Owner)' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN' },
      select: {
        id: true,
        username: true,
        avatarColor: true,
        avatarUrl: true,
        role: true
      }
    });

    return res.json({
      message: `${updated.username} foi promovido a Administrador 🛡️`,
      user: updated
    });
  } catch (err) {
    console.error('Erro ao promover administrador:', err);
    return res.status(500).json({ error: 'Erro ao promover administrador' });
  }
};

// Apenas o OWNER tem permissão para rebaixar Administradores!
export const demoteFromAdmin = async (req, res) => {
  try {
    const { userId } = req.params;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (targetUser.role === 'OWNER') {
      return res.status(400).json({ error: 'Não é possível alterar o cargo do Dono' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: 'MEMBER' },
      select: {
        id: true,
        username: true,
        avatarColor: true,
        avatarUrl: true,
        role: true
      }
    });

    return res.json({
      message: `Permissão de Administrador removida de ${updated.username}`,
      user: updated
    });
  } catch (err) {
    console.error('Erro ao rebaixar administrador:', err);
    return res.status(500).json({ error: 'Erro ao rebaixar administrador' });
  }
};

// Admin e Owner podem mutar/desmutar usuários remotamente
export const toggleServerMute = async (req, res) => {
  try {
    const { userId } = req.params;
    const { mute } = req.body;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const shouldMute = mute !== undefined ? mute : !targetUser.isServerMuted;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isServerMuted: shouldMute },
      select: {
        id: true,
        username: true,
        isServerMuted: true
      }
    });

    return res.json({
      message: shouldMute ? `${updated.username} foi mutado pelo servidor 🔇` : `${updated.username} foi desmutado 🎙️`,
      user: updated
    });
  } catch (err) {
    console.error('Erro ao alterar mute de servidor:', err);
    return res.status(500).json({ error: 'Erro ao alterar mute do servidor' });
  }
};

// Admin e Owner podem redefinir a senha de um membro caso ele esqueça
export const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim().length < 3) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 3 caracteres' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Apenas o OWNER pode resetar a senha de outro ADMIN ou de si mesmo
    if (targetUser.role === 'OWNER' && req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Apenas o Dono pode alterar a senha do Dono' });
    }

    const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    return res.json({
      message: `Senha de ${targetUser.username} redefinida com sucesso! Nova senha: "${newPassword}"`
    });
  } catch (err) {
    console.error('Erro ao resetar senha do usuário:', err);
    return res.status(500).json({ error: 'Erro ao resetar senha do usuário' });
  }
};

// Apenas o OWNER pode excluir uma conta de usuário
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (targetUser.role === 'OWNER') {
      return res.status(400).json({ error: 'Não é possível excluir o Dono do servidor' });
    }

    await prisma.message.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    return res.json({ message: `Conta de ${targetUser.username} excluída com sucesso!` });
  } catch (err) {
    console.error('Erro ao excluir usuário:', err);
    return res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
};

// Apenas o OWNER pode resetar todas as contas de membros e mensagens (Zerar tudo exceto o Dono)
export const resetAllMembers = async (req, res) => {
  try {
    await prisma.message.deleteMany({});
    const deleted = await prisma.user.deleteMany({
      where: {
        role: {
          not: 'OWNER'
        }
      }
    });

    return res.json({
      message: `Reset concluído! ${deleted.count} contas de membros foram removidas com sucesso.`
    });
  } catch (err) {
    console.error('Erro ao resetar todos os membros:', err);
    return res.status(500).json({ error: 'Erro ao resetar todos os membros' });
  }
};
