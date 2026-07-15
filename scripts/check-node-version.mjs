const major = Number(process.versions.node.split('.')[0]);
if (major !== 22) {
  console.error(`Node.js 22 is required; detected ${process.version}. Use nvm use (or install Node 22.22.2) before running this project.`);
  process.exit(1);
}
