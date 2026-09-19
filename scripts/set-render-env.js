// Envia variáveis do .env local para o Render (sem imprimir os valores) e dispara um deploy.
//
// Uso: node scripts/set-render-env.js [--no-deploy]
//
// Lê do .env da raiz:
//   RENDER_API_KEY, RENDER_SERVICE_ID       (acesso à API do Render)
//   NEON_DATABASE_URL                        -> DATABASE_URL no Render
//   CLOUDFLARE_TURN_KEY_ID, CLOUDFLARE_TURN_API_TOKEN
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  });
}

const apiKey = process.env.RENDER_API_KEY || env.RENDER_API_KEY;
const serviceId = process.env.RENDER_SERVICE_ID || env.RENDER_SERVICE_ID;
if (!apiKey || !serviceId) {
  console.error('❌ Defina RENDER_API_KEY e RENDER_SERVICE_ID no .env');
  process.exit(1);
}

// variável no .env local -> variável no Render
const MAPPING = {
  NEON_DATABASE_URL: 'DATABASE_URL',
  CLOUDFLARE_TURN_KEY_ID: 'CLOUDFLARE_TURN_KEY_ID',
  CLOUDFLARE_TURN_API_TOKEN: 'CLOUDFLARE_TURN_API_TOKEN'
};

const api = async (method, endpoint, body) => {
  const res = await fetch(`https://api.render.com/v1${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    throw new Error(`${method} ${endpoint} -> HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
};

const main = async () => {
  const toSend = Object.entries(MAPPING).filter(([local]) => env[local]);
  if (!toSend.length) {
    console.error('❌ Nenhuma variável encontrada no .env (NEON_DATABASE_URL, CLOUDFLARE_TURN_KEY_ID, CLOUDFLARE_TURN_API_TOKEN)');
    process.exit(1);
  }

  if (env.NEON_DATABASE_URL && !/^postgres(ql)?:\/\//.test(env.NEON_DATABASE_URL)) {
    console.error('❌ NEON_DATABASE_URL deve começar com postgresql://');
    process.exit(1);
  }

  for (const [local, remote] of toSend) {
    await api('PUT', `/services/${serviceId}/env-vars/${remote}`, { value: env[local] });
    console.log(`✅ ${remote} atualizado no Render (valor oculto)`);
  }

  if (process.argv.includes('--no-deploy')) {
    console.log('ℹ️  Deploy não disparado (--no-deploy). As variáveis valem a partir do próximo deploy.');
    return;
  }

  const deploy = await api('POST', `/services/${serviceId}/deploys`, { clearCache: 'do_not_clear' });
  console.log(`🚀 Deploy disparado${deploy?.id ? ` (${deploy.id})` : ''}. Acompanhe com: node scripts/check-deploy.js`);
};

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
