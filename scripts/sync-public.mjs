import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');

const entries = [
  'index.html',
  'styles.css',
  'config.js',
  'runtime-init.js',
  'skills.js',
  'rfq-store.js',
  'rfq-validation.js',
  'rfq-risk.js',
  'apqp-workspace.js',
  'core.js',
  'ui.js',
  'app.js',
  'step5-final-polish.js',
  'assets',
  'vendor'
];

await fs.mkdir(publicDir, { recursive: true });

for (const entry of entries) {
  const from = path.join(root, entry);
  const to = path.join(publicDir, entry);
  await fs.rm(to, { recursive: true, force: true });
  await fs.cp(from, to, { recursive: true });
}

await fs.writeFile(
  path.join(publicDir, 'manifest.json'),
  JSON.stringify(
    {
      name: 'Personal AI OS',
      short_name: 'PersonalAIOS',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      background_color: '#f4f5f7',
      theme_color: '#1d2433'
    },
    null,
    2
  )
);

await fs.writeFile(path.join(publicDir, '.nojekyll'), '');

console.log(`Synced frontend assets to ${publicDir}`);
