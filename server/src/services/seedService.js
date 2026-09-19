import bcrypt from 'bcryptjs';
import prisma from '../prisma.js';

export const seedDatabase = async () => {
  try {
    console.log('🌱 Inicializando verificação de banco de dados e sementes...');

    // 1. Garante canais padrão
    const channelCount = await prisma.channel.count();
    if (channelCount === 0) {
      console.log('📻 Criando canais padrão no banco de dados...');
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

    const ownerUsername = 'Daniel';
    const defaultPassword = 'daniel123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // 2. Verifica se outra pessoa assumiu o cargo de OWNER
    const otherOwners = await prisma.user.findMany({
      where: {
        role: 'OWNER',
        NOT: {
          username: { in: ['Daniel', 'daniel'] }
        }
      }
    });

    // Se outra pessoa assumiu o cargo de OWNER, reseta todas as contas anteriores
    if (otherOwners.length > 0) {
      console.log('🧹 Outro usuário assumiu o OWNER indevidamente. Resetando todas as contas...');
      await prisma.message.deleteMany({});
      await prisma.user.deleteMany({});
      console.log('✨ Todas as contas antigas foram removidas.');
    }

    // 3. Garante que a conta do Daniel exista como OWNER e com a senha padrão ativa
    const existingDaniel = await prisma.user.findFirst({
      where: {
        OR: [
          { username: 'Daniel' },
          { username: 'daniel' }
        ]
      }
    });

    if (!existingDaniel) {
      console.log(`👑 Criando conta fixa oficial do Dono (${ownerUsername})...`);
      await prisma.user.create({
        data: {
          username: ownerUsername,
          password: hashedPassword,
          role: 'OWNER',
          avatarColor: '#f59e0b'
        }
      });
      console.log(`✅ Conta fixa do Dono criada com sucesso! Usuário: "${ownerUsername}"`);
    } else {
      // Se Daniel já existia mas outra pessoa era owner, ou se o cargo não é OWNER, restaura
      await prisma.user.update({
        where: { id: existingDaniel.id },
        data: {
          role: 'OWNER',
          password: hashedPassword // Garante que a senha seja daniel123 neste reset
        }
      });
      console.log(`👑 Cargo de OWNER e senha redefinidos para o Dono (${existingDaniel.username}).`);
    }

    // 4. Garante que NENHUM outro usuário tenha o cargo OWNER
    await prisma.user.updateMany({
      where: {
        role: 'OWNER',
        NOT: {
          username: { in: ['Daniel', 'daniel'] }
        }
      },
      data: {
        role: 'MEMBER'
      }
    });

    console.log('🌟 Verificação de banco de dados concluída.');
  } catch (err) {
    console.error('Erro ao executar seed do banco de dados:', err);
  }
};
