import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'concord-secret-key-gaming-friends-2026';

export const register = async (req, res) => {
  try {
    const { username, password, avatarColor } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios' });
    }

    const cleanUsername = username.trim();
    if (cleanUsername.length < 2 || cleanUsername.length > 20) {
      return res.status(400).json({ error: 'O nome de usuário deve ter entre 2 e 20 caracteres' });
    }

    // Verifica se já existe um usuário com esse nome
    const existing = await prisma.user.findUnique({
      where: { username: cleanUsername }
    });

    if (existing) {
      return res.status(400).json({ error: 'Este nome de usuário já está em uso' });
    }

    // Novos cadastros de amigos entram sempre como MEMBER (O cargo OWNER é exclusivo do Dono)
    const role = 'MEMBER';

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        password: hashedPassword,
        avatarColor: avatarColor || '#6366f1',
        role
      },
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

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    return res.status(201).json({
      message: role === 'OWNER' ? 'Conta de Dono (Owner) criada com sucesso!' : 'Conta criada com sucesso!',
      user,
      token
    });
  } catch (err) {
    console.error('Erro no registro:', err);
    return res.status(500).json({ error: 'Erro interno ao criar conta' });
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios' });
    }

    const cleanUsername = username.trim();
    let user = await prisma.user.findUnique({
      where: { username: cleanUsername }
    });

    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: cleanUsername.toLowerCase() },
            { username: cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1).toLowerCase() }
          ]
        }
      });
    }

    if (!user) {
      return res.status(400).json({ error: 'Usuário ou senha incorretos' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Usuário ou senha incorretos' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    const safeUser = {
      id: user.id,
      username: user.username,
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isServerMuted: user.isServerMuted,
      createdAt: user.createdAt
    };

    return res.json({
      message: 'Login realizado com sucesso',
      user: safeUser,
      token
    });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno ao realizar login' });
  }
};

export const getMe = async (req, res) => {
  return res.json({ user: req.user });
};

export const updateProfile = async (req, res) => {
  try {
    const { avatarColor, avatarUrl, username } = req.body;

    let cleanUsername = undefined;
    if (username !== undefined && username !== null) {
      cleanUsername = username.trim();
      if (cleanUsername.length < 2 || cleanUsername.length > 20) {
        return res.status(400).json({ error: 'O apelido deve ter entre 2 e 20 caracteres' });
      }

      // Se for diferente do username atual, verifica se outro usuário já está usando
      if (cleanUsername !== req.user.username) {
        const existing = await prisma.user.findUnique({
          where: { username: cleanUsername }
        });

        if (existing) {
          return res.status(400).json({ error: 'Este apelido já está em uso por outro usuário' });
        }
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(cleanUsername && { username: cleanUsername }),
        ...(avatarColor && { avatarColor }),
        ...(avatarUrl !== undefined && { avatarUrl })
      },
      select: {
        id: true,
        username: true,
        avatarColor: true,
        avatarUrl: true,
        role: true,
        isServerMuted: true
      }
    });

    return res.json({
      message: 'Perfil atualizado com sucesso!',
      user: updated
    });
  } catch (err) {
    console.error('Erro ao atualizar perfil:', err);
    return res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }

    if (newPassword.trim().length < 3) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 3 caracteres' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'A senha atual está incorreta' });
    }

    const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });

    return res.json({ message: 'Sua senha foi alterada com sucesso!' });
  } catch (err) {
    console.error('Erro ao alterar senha:', err);
    return res.status(500).json({ error: 'Erro ao alterar senha' });
  }
};

