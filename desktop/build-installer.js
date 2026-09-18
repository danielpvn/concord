import inno from 'innosetup-compiler';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const issPath = path.join(__dirname, 'installer.iss');

console.log('📦 Gerando instalador profissional Concord-Setup.exe com Inno Setup...');

inno(issPath, { verbose: false }, (err) => {
  if (err) {
    console.error('❌ Erro ao compilar instalador:', err);
    process.exit(1);
  }
  console.log('✅ Instalador Concord-Setup.exe gerado com sucesso em desktop/dist-installer/Concord-Setup.exe!');
});
