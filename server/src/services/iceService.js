// Fornece servidores ICE (STUN + TURN) para o WebRTC dos clientes.
// Sem TURN, amigos atrás de NAT simétrico / 4G / CGNAT não conseguem se ouvir.
//
// Opções de configuração (variáveis de ambiente):
//  - Cloudflare Realtime TURN (grátis até 1000 GB/mês):
//      CLOUDFLARE_TURN_KEY_ID, CLOUDFLARE_TURN_API_TOKEN
//  - Metered.ca (grátis 50 GB/mês):
//      METERED_DOMAIN (ex: meuapp.metered.live), METERED_API_KEY
//  - TURN próprio / estático:
//      TURN_URLS (separadas por vírgula), TURN_USERNAME, TURN_CREDENTIAL

const STUN_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' }
];

let cache = { servers: null, expiresAt: 0 };

const fetchCloudflare = async () => {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!keyId || !token) return null;

  const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: 86400 })
  });
  if (!res.ok) throw new Error(`Cloudflare TURN respondeu ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];
  return list.filter(Boolean);
};

const fetchMetered = async () => {
  const domain = process.env.METERED_DOMAIN;
  const apiKey = process.env.METERED_API_KEY;
  if (!domain || !apiKey) return null;

  const res = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`);
  if (!res.ok) throw new Error(`Metered TURN respondeu ${res.status}`);
  return await res.json();
};

const staticTurn = () => {
  const urls = process.env.TURN_URLS;
  if (!urls) return null;
  return [{
    urls: urls.split(',').map(u => u.trim()).filter(Boolean),
    username: process.env.TURN_USERNAME,
    credential: process.env.TURN_CREDENTIAL
  }];
};

export const getIceServers = async () => {
  if (cache.servers && Date.now() < cache.expiresAt) {
    return cache.servers;
  }

  let turn = null;
  for (const provider of [fetchCloudflare, fetchMetered]) {
    try {
      turn = await provider();
      if (turn && turn.length) break;
    } catch (err) {
      console.error('⚠️ Falha ao obter credenciais TURN:', err.message);
    }
  }
  if (!turn || !turn.length) turn = staticTurn();

  const servers = [...STUN_SERVERS, ...(turn || [])];
  // Credenciais dinâmicas duram 24h; renova a cada 12h
  cache = { servers, expiresAt: Date.now() + (turn ? 12 : 1) * 60 * 60 * 1000 };
  return servers;
};

export const hasTurnConfigured = (servers) =>
  servers.some(s => [].concat(s.urls).some(u => /^turns?:/.test(u)));
