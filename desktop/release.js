// Publica uma nova versão do app desktop nas Releases do GitHub.
// Os apps instalados baixam e instalam a atualização sozinhos.
//
// Uso: aumente "version" em desktop/package.json e rode:
//   npm --prefix desktop run release
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const desktopDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(desktopDir, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(desktopDir, 'package.json'), 'utf8'));

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });

// Não sobrescreve uma versão já publicada
try {
  execSync(`gh release view v${version} -R danielpvn/concord`, { stdio: 'ignore' });
  console.error(`❌ A versão v${version} já existe no GitHub. Aumente "version" em desktop/package.json.`);
  process.exit(1);
} catch {
  // não existe: pode publicar
}

console.log('1/3 Compilando a interface (fallback offline do app)...');
run('npm run build', { cwd: path.join(rootDir, 'client') });
fs.rmSync(path.join(desktopDir, 'ui'), { recursive: true, force: true });
fs.cpSync(path.join(rootDir, 'client', 'dist'), path.join(desktopDir, 'ui'), { recursive: true });

console.log(`2/3 Gerando e publicando Concord v${version}...`);
const token = execSync('gh auth token').toString().trim();
run('npx electron-builder --win --publish always', { cwd: desktopDir, env: { ...process.env, GH_TOKEN: token } });

console.log(`3/3 ✅ Concord v${version} publicado! Os apps instalados vão se atualizar sozinhos.`);
console.log('   Download: https://github.com/danielpvn/concord/releases/latest/download/Concord-Setup.exe');
