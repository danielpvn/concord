import multer from 'multer';
import prisma from '../prisma.js';

// Arquivos ficam no banco de dados (o disco do Render é apagado a cada deploy/reinício)
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // Limite de 10MB para fotos, memes e arquivos
});

// Imagens que o navegador pode exibir com segurança (SVG pode conter scripts)
const INLINE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/avif']);

export const saveUpload = async (file) => {
  const saved = await prisma.upload.create({
    data: {
      filename: file.originalname || 'arquivo',
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
      data: file.buffer
    },
    select: { id: true }
  });
  return `/api/files/${saved.id}`;
};

export const handleFileUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  try {
    const fileUrl = await saveUpload(req.file);
    const isImage = INLINE_IMAGE_TYPES.has(req.file.mimetype);

    return res.json({
      url: fileUrl,
      filename: req.file.originalname,
      type: isImage ? 'image' : 'file',
      size: req.file.size
    });
  } catch (err) {
    console.error('Erro ao salvar upload:', err);
    return res.status(500).json({ error: 'Erro ao salvar arquivo' });
  }
};

export const handleAvatarUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma imagem enviada' });
  }
  if (!INLINE_IMAGE_TYPES.has(req.file.mimetype)) {
    return res.status(400).json({ error: 'Formato de imagem não suportado' });
  }

  try {
    const avatarUrl = await saveUpload(req.file);
    return res.json({ avatarUrl });
  } catch (err) {
    console.error('Erro ao salvar avatar:', err);
    return res.status(500).json({ error: 'Erro ao salvar imagem' });
  }
};

export const serveFile = async (req, res) => {
  try {
    const file = await prisma.upload.findUnique({ where: { id: req.params.id } });
    if (!file) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    const inline = INLINE_IMAGE_TYPES.has(file.mimeType);
    res.setHeader('Content-Type', inline ? file.mimeType : 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.filename)}`
    );
    return res.send(Buffer.from(file.data));
  } catch (err) {
    console.error('Erro ao servir arquivo:', err);
    return res.status(500).json({ error: 'Erro ao carregar arquivo' });
  }
};
