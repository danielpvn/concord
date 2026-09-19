import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lê credenciais do .env caso não estejam no process.env
const rootEnvPath = path.join(__dirname, '..', '.env');
let RENDER_API_KEY = process.env.RENDER_API_KEY;
let RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID;

if ((!RENDER_API_KEY || !RENDER_SERVICE_ID) && fs.existsSync(rootEnvPath)) {
  const content = fs.readFileSync(rootEnvPath, 'utf8');
  content.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length > 0) {
      const key = k.trim();
      const val = v.join('=').trim().replace(/^["']|["']$/g, '');
      if (key === 'RENDER_API_KEY' && !RENDER_API_KEY) RENDER_API_KEY = val;
      if (key === 'RENDER_SERVICE_ID' && !RENDER_SERVICE_ID) RENDER_SERVICE_ID = val;
    }
  });
}

// Fallback para as credenciais padrão do projeto
if (!RENDER_API_KEY) RENDER_API_KEY = 'rnd_kw5SyOjQNv5MFkxcPkpQrAs6NQ0L';
if (!RENDER_SERVICE_ID) RENDER_SERVICE_ID = 'srv-damsldo473hc73emggk0';

console.log('🚀 [Render Deploy Watcher] Monitorando status do deploy na nuvem...');

async function checkDeploy() {
  const url = `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys?limit=1`;

  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${RENDER_API_KEY}`,
          Accept: 'application/json'
        }
      });

      if (!res.ok) {
        console.warn(`⚠️ [Tentativa ${attempt}] Erro ao consultar API do Render: ${res.status} ${res.statusText}`);
      } else {
        const data = await res.json();
        const latest = data[0]?.deploy;

        if (latest) {
          const status = latest.status;
          const commitMsg = latest.commit?.message || 'Novo commit';
          console.log(`⏱️ [Tentativa ${attempt}] Commit: "${commitMsg}" | Status: ${status}`);

          if (status === 'live') {
            console.log('🎉 Deploy concluído com SUCESSO! A aplicação está LIVE na nuvem.');
            console.log('🌐 URL: https://concord-l08s.onrender.com');
            process.exit(0);
          } else if (status === 'build_failed' || status === 'canceled' || status === 'deactivated') {
            console.error(`❌ O deploy falhou com status: ${status}`);
            process.exit(1);
          }
        }
      }
    } catch (err) {
      console.warn(`⚠️ [Tentativa ${attempt}] Erro de conexão com a API do Render:`, err.message);
    }

    // Aguarda 10 segundos antes de checar novamente
    await new Promise(r => setTimeout(r, 10000));
  }

  console.warn('⌛ Tempo limite de espera atingido. Verifique o painel do Render manualmente.');
  process.exit(0);
}

checkDeploy();
