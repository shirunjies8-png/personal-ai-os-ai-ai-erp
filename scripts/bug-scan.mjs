import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const checkOnly = process.argv.includes('--check-only');
const reportPath = path.join(root, 'BUG_REPORT.md');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const logsPath = path.join(root, 'logs', 'app.log');

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readText(target) {
  try {
    return await fs.readFile(target, 'utf8');
  } catch {
    return '';
  }
}

function section(title, body) {
  return `## ${title}\n\n${body.trim()}\n`;
}

const findings = [];
const filesToScan = [
  'app.js',
  'core.js',
  'ui.js',
  'styles.css',
  'services/aiGateway.js',
  'services/aiService.js',
  'routes/index.js',
  'controllers/agentController.js'
];

for (const file of filesToScan) {
  const text = await readText(path.join(root, file));
  if (!text) continue;
  if (/Mock OCR 成功/.test(text)) findings.push({ level: 'P1', issue: 'OCR 状态仍可能误报 Mock 成功', file });
  if (/模型返回为空/.test(text) && /ui\.js|app\.js|chat/i.test(file)) {
    findings.push({ level: 'P1', issue: '聊天页面仍可能向用户暴露“模型返回为空”文案', file });
  }
  if (/console\.log\([^)]*API Key|logger\.(info|warn|error)\([^)]*API Key/i.test(text)) {
    findings.push({ level: 'P0', issue: '可能存在 API Key 相关日志输出', file });
  }
  if (/chat/i.test(file) && /message-content|chat-messages|chat-composer/.test(text) && /max-height:\s*\d/.test(text)) {
    findings.push({ level: 'P2', issue: '聊天区域可能存在固定高度裁切', file });
  }
}

const gitIgnored = await (async () => {
  try {
    const out = execFileSync('git', ['check-ignore', '.env.local'], { cwd: root, encoding: 'utf8' }).trim();
    return Boolean(out);
  } catch {
    return false;
  }
})();

const trackedEnvLocal = await (async () => {
  try {
    const out = execFileSync('git', ['ls-files', '.env.local'], { cwd: root, encoding: 'utf8' }).trim();
    return Boolean(out);
  } catch {
    return false;
  }
})();

const pubExists = await exists(publicDir);
const distExists = await exists(distDir);
const logs = await readText(logsPath);
const apiKeyLeak = /sk-[A-Za-z0-9_-]{8,}/.test(logs) || /sk-[A-Za-z0-9_-]{8,}/.test(await readText(path.join(root, 'TEST_REPORT.md')));
if (apiKeyLeak) findings.push({ level: 'P0', issue: '日志或报告中检测到疑似 API Key 模式' });
if (!gitIgnored) findings.push({ level: 'P0', issue: '.env.local 未被 gitignore 命中' });
if (trackedEnvLocal) findings.push({ level: 'P0', issue: '.env.local 仍在 Git 跟踪中' });
if (!pubExists) findings.push({ level: 'P1', issue: 'public 目录缺失' });
if (!distExists) findings.push({ level: 'P1', issue: 'dist 目录缺失' });

const report = [
  '# BUG_REPORT',
  '',
  `生成时间：${new Date().toISOString()}`,
  '',
  section('P0', findings.filter(item => item.level === 'P0').length
    ? findings.filter(item => item.level === 'P0').map(item => `- ${item.issue}${item.file ? `（${item.file}）` : ''}`).join('\n')
    : '- 未发现 P0 问题。'),
  section('P1', findings.filter(item => item.level === 'P1').length
    ? findings.filter(item => item.level === 'P1').map(item => `- ${item.issue}${item.file ? `（${item.file}）` : ''}`).join('\n')
    : '- 未发现 P1 问题。'),
  section('P2 / P3', findings.filter(item => item.level === 'P2' || item.level === 'P3').length
    ? findings.filter(item => item.level === 'P2' || item.level === 'P3').map(item => `- ${item.issue}${item.file ? `（${item.file}）` : ''}`).join('\n')
    : '- 未发现明显 UI/文案级问题。'),
  section('自动修复建议', [
    '- 若 public / dist 缺失，请先执行 `npm run build`。',
    '- 若 `.env.local` 未被忽略，请立即更新 `.gitignore`。',
    '- 若 OCR 仍误报 Mock 成功，应继续排查浏览器 OCR 引擎加载状态和 UI 文案。',
    '- 若出现真实 API 失败，应查看 `/api/health`、AI 调用历史与日志中心。'
  ].join('\n'))
].join('\n');

await fs.writeFile(reportPath, report, 'utf8');
console.log(report);

if (checkOnly && findings.length) process.exitCode = 1;
