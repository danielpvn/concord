import prisma from '../prisma.js';

// Função para garantir canais padrão
export const seedDefaultChannels = async () => {
  const count = await prisma.channel.count();
  if (count === 0) {
    console.log('🌱 Criando canais padrão no banco de dados...');
    await prisma.channel.createMany({
      data: [
        { name: 'Geral', type: 'voice', order: 0 },
        { name: '🎮 Jogatina 1', type: 'voice', order: 1 },
        { name: '🎮 Jogatina 2', type: 'voice', order: 2 },
        { name: '💤 AFK / Ausente', type: 'voice', order: 3 },
        { name: 'chat-geral', type: 'text', order: 4 },
        { name: 'memes-e-clips', type: 'text', order: 5 }
      ]
    });
  }
};

export const getChannels = async (req, res) => {
  try {
    const channels = await prisma.channel.findMany({
      orderBy: { order: 'asc' }
    });
    return res.json({ channels });
  } catch (err) {
    console.error('Erro ao buscar canais:', err);
    return res.status(500).json({ error: 'Erro ao buscar canais' });
  }
};

export const createChannel = async (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'O nome do canal é obrigatório' });
    }

    const count = await prisma.channel.count();
    const channel = await prisma.channel.create({
      data: {
        name: name.trim(),
        type: type === 'text' ? 'text' : 'voice',
        order: count
      }
    });

    return res.status(201).json({ channel });
  } catch (err) {
    console.error('Erro ao criar canal:', err);
    return res.status(500).json({ error: 'Erro ao criar canal' });
  }
};

export const deleteChannel = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.channel.delete({
      where: { id }
    });
    return res.json({ message: 'Canal excluído com sucesso' });
  } catch (err) {
    console.error('Erro ao excluir canal:', err);
    return res.status(500).json({ error: 'Erro ao excluir canal' });
  }
};

export const getChannelMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);

    const messages = await prisma.message.findMany({
      where: { channelId: id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarColor: true,
            avatarUrl: true,
            role: true
          }
        }
      },
      // Busca as mais recentes e devolve em ordem cronológica
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return res.json({ messages: messages.reverse() });
  } catch (err) {
    console.error('Erro ao buscar mensagens:', err);
    return res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
};
