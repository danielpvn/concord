import dns from 'dns/promises';
import net from 'net';

// Baixa uma imagem da web pelo servidor (para o avatar por link), já que muitos sites
// bloqueiam o uso direto no navegador (CORS). Protegido contra acesso à rede interna (SSRF).

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10000;

const isPrivateAddress = (ip) => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const lower = ip.toLowerCase();
  if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7));
  return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
};

const assertPublicUrl = async (rawUrl) => {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Link inválido');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Use um link http ou https');
  }
  const addresses = await dns.lookup(url.hostname, { all: true }).catch(() => []);
  if (!addresses.length) throw new Error('Não foi possível acessar esse endereço');
  if (addresses.some(a => isPrivateAddress(a.address))) {
    throw new Error('Endereço não permitido');
  }
  return url;
};

export const fetchRemoteImage = async (rawUrl) => {
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (Concord avatar fetcher)', Accept: 'image/*' }
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`O site respondeu com erro ${res.status}`);

    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/') || contentType === 'image/svg+xml') {
      throw new Error('Esse link não é uma imagem (copie o endereço da imagem, não da página)');
    }

    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) throw new Error('Imagem muito grande (máximo 8MB)');

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_BYTES) throw new Error('Imagem muito grande (máximo 8MB)');

    return { buffer, contentType };
  }

  throw new Error('Redirecionamentos demais');
};
