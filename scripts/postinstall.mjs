import { copyFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const source = join(__dirname, '..', 'patches', 'download-peer-file.js');
const target = require.resolve('slsk-client/lib/peer/download-peer-file.js');

copyFileSync(source, target);
console.log('Patched slsk-client/lib/peer/download-peer-file.js');
