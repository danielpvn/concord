// Ajusta o provider do Prisma conforme a DATABASE_URL:
//  - postgres://... ou postgresql://...  -> "postgresql" (banco persistente, ex.: Neon)
//  - file:...                           -> "sqlite" (desenvolvimento local)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverDir, '.env') });

const url = process.env.DATABASE_URL || '';
const provider = /^postgres(ql)?:\/\//i.test(url) ? 'postgresql' : 'sqlite';

const schemaPath = path.join(serverDir, 'prisma', 'schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');
const updated = schema.replace(
  /(datasource db \{[^}]*?provider\s*=\s*)"[^"]+"/,
  `$1"${provider}"`
);

if (updated !== schema) {
  fs.writeFileSync(schemaPath, updated);
}

console.log(`🗄️  Prisma configurado para ${provider}${provider === 'sqlite' ? ' (dados NÃO persistem no Render!)' : ''}`);
