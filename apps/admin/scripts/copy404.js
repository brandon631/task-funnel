import { copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '../dist');

try {
  copyFileSync(join(distDir, 'index.html'), join(distDir, '404.html'));
  console.log('✓ Copied index.html to 404.html for GitHub Pages fallback');
} catch (err) {
  console.error('Error copying 404.html:', err);
  process.exit(1);
}
