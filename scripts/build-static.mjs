import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const publicDir = path.join(root, 'public');

const entries = [
  'README.md',
  'public'
];

async function removeDir(target) {
  await fs.rm(target, { recursive: true, force: true });
}

async function copyEntry(name) {
  if (name === 'public') {
    const items = await fs.readdir(publicDir);
    for (const item of items) {
      await fs.cp(path.join(publicDir, item), path.join(dist, item), { recursive: true });
    }
    return;
  }
  const from = path.join(root, name);
  const to = path.join(dist, name);
  await fs.cp(from, to, { recursive: true });
}

await removeDir(dist);
await fs.mkdir(dist, { recursive: true });

for (const entry of entries) {
  await copyEntry(entry);
}

await fs.copyFile(path.join(dist, 'index.html'), path.join(dist, '404.html'));

await fs.writeFile(path.join(dist, '.nojekyll'), '');
await fs.writeFile(
  path.join(dist, 'deploy-info.json'),
  JSON.stringify(
    {
      app: 'Personal AI OS',
      mode: 'static-web',
      generatedAt: new Date().toISOString(),
      notes: [
        '默认可直接作为静态网页部署',
        '本地模式无需服务端',
        'API模式/云端模式需要用户在浏览器中配置兼容接口'
      ]
    },
    null,
    2
  )
);

console.log(`Built static deployment bundle at ${dist}`);
