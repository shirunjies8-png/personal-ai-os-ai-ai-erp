import fs from 'node:fs/promises';

const root = process.cwd();
const baseUrl = 'http://127.0.0.1:3000';
const chromePort = 9222;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await fetch(url, { method: 'GET' });
      return true;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`等待服务超时：${url}`);
}

async function chromeTabs() {
  const res = await fetch(`http://127.0.0.1:${chromePort}/json/list`);
  if (!res.ok) throw new Error('未能连接 Chrome 远程调试端口');
  return res.json();
}

async function chromeVersion() {
  const res = await fetch(`http://127.0.0.1:${chromePort}/json/version`);
  if (!res.ok) throw new Error('未能读取 Chrome 版本信息');
  return res.json();
}

async function chromeNewTab(url) {
  const version = await chromeVersion();
  if (!version.webSocketDebuggerUrl) throw new Error('Chrome 未提供浏览器级调试入口');
  const { ws, send } = await cdpConnect(version.webSocketDebuggerUrl);
  const result = await send('Target.createTarget', { url });
  ws.close();
  return result;
}

function pickTab(tabs) {
  return tabs.find(tab => tab.type === 'page') || tabs[0];
}

async function cdpConnect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const current = ++id;
    pending.set(current, { resolve, reject });
    ws.send(JSON.stringify({ id: current, method, params }));
  });
  return { ws, send };
}

async function openPage(url) {
  let tabs = await chromeTabs();
  let tab = pickTab(tabs);
  if (!tab) {
    await chromeNewTab(url);
    tabs = await chromeTabs();
    tab = pickTab(tabs);
  }
  const { ws, send } = await cdpConnect(tab.webSocketDebuggerUrl);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url });
  await sleep(4000);
  return { ws, send };
}

async function evalValue(send, expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return result.result.value;
}

async function setAuth(send) {
  await evalValue(send, `localStorage.setItem('personal-ai-os-auth', JSON.stringify({
    token: 'demo',
    user: { email: 'admin@personal-ai-os.local', name: '企业管理员', role: '企业管理员' },
    enterprise: { name: 'Personal AI OS Demo Enterprise' },
    demo: false
  }));`);
}

async function testChat() {
  const { ws, send } = await openPage(`${baseUrl}/#/chat`);
  await setAuth(send);
  await send('Page.reload');
  await sleep(3000);
  const prompt = '请用三点回答你能帮我解决什么问题，并在最后一行原样补一句：需要我针对某项业务场景展开，或直接处理一个具体文件/问题？';
  await evalValue(send, `(() => {
    const input = document.getElementById('chatInput');
    input.value = ${JSON.stringify(prompt)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-form="chat"]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  })()`);
  await sleep(12000);
  const body = await evalValue(send, 'document.body.innerText');
  if (!body.includes('需要我针对某项业务场景展开，或直接处理一个具体文件/问题？')) throw new Error('AI Chat 回复未完整显示');
  if (body.includes('模型返回为空')) throw new Error('仍出现模型返回为空');
  ws.close();
  return 'ai-chat: ok';
}

async function testOcr() {
  const { ws, send } = await openPage(`${baseUrl}/#/ocr`);
  await setAuth(send);
  await send('Page.reload');
  await sleep(3000);
  const stateBefore = await evalValue(send, `document.getElementById('ocrStatus')?.textContent || ''`);
  if (!stateBefore.includes('尚未开始') && !stateBefore.includes('未开始')) throw new Error('OCR 初始状态异常');
  await evalValue(send, `(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 280;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,800,280);
    ctx.fillStyle = '#000';
    ctx.font = '36px sans-serif';
    ctx.fillText('发货单 SO-2026-015', 30, 60);
    ctx.fillText('客户 常州新能源科技有限公司', 30, 110);
    ctx.fillText('发货数量 760', 30, 160);
    ctx.fillText('总金额 9710.00', 30, 210);
    canvas.toBlob(blob => {
      const file = new File([blob], 'ocr-test.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.querySelector('input[data-input="ocr-file"]');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  })()`);
  await sleep(1200);
  const statusAfterUpload = await evalValue(send, `document.getElementById('ocrStatus')?.textContent || ''`);
  if (!/未开始|本地处理|等待/.test(statusAfterUpload)) throw new Error('OCR 上传后状态异常');
  await evalValue(send, `document.querySelector('[data-action="ocr-run"]').click()`);
  await sleep(15000);
  const statusAfterRun = await evalValue(send, `document.getElementById('ocrStatus')?.textContent || ''`);
  const text = await evalValue(send, `document.getElementById('ocrResult')?.value || ''`);
  if (!text.trim()) throw new Error('OCR 原文为空');
  if (/Mock OCR 成功/.test(statusAfterRun)) throw new Error('OCR 仍误报 Mock 成功');
  ws.close();
  return 'ocr: ok';
}

async function testAgent() {
  const { ws, send } = await openPage(`${baseUrl}/#/agent`);
  await setAuth(send);
  await send('Page.reload');
  await sleep(2500);
  const goal = '分析一份发货单并在需要审批时暂停';
  await evalValue(send, `(() => {
    const el = document.getElementById('agentGoal');
    el.value = ${JSON.stringify(goal)};
    el.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await evalValue(send, `document.querySelector('[data-action="agent-run"]').click()`);
  await sleep(1000);
  let snapshot = '';
  for (let i = 0; i < 12; i += 1) {
    snapshot = await evalValue(send, `await (async () => {
      const taskId = window.App?.temp?.agent?.currentRunId || '';
      let task = null;
      if (taskId) {
        try {
          const res = await APIClient.request('/api/agents/tasks/' + taskId);
          task = res.data?.task || null;
        } catch {}
      }
      const runs = (Store.state.agentRuns || []).slice(0, 5).map(item => item.status || '');
      const tasks = (Store.state.taskRecords || []).slice(0, 10).map(item => item.status || '');
      const approval = (Store.state.agentApprovals || []).slice(0, 5).map(item => item.status || '');
      return JSON.stringify({ taskId, taskStatus: task?.status || '', runs, tasks, approval });
    })()`);
    if (/等待中|执行中|已完成|等待审批|失败|pending|running|waiting_human|success|failed|timeout|cancelled/.test(snapshot)) break;
    await sleep(1000);
  }
  if (!/等待中|执行中|已完成|等待审批|失败|pending|running|waiting_human|success|failed|timeout|cancelled/.test(snapshot)) {
    throw new Error('Agent 状态流转未出现');
  }
  ws.close();
  return 'agent-runtime: ok';
}

async function testMonitor() {
  const { ws, send } = await openPage(`${baseUrl}/#/monitor`);
  await setAuth(send);
  await send('Page.reload');
  await sleep(2500);
  const body = await evalValue(send, 'document.body.innerText');
  if (!body.includes('DeepSeek')) throw new Error('Monitor 未显示 DeepSeek 状态');
  if (!body.includes('最近 20 条 Agent 日志')) throw new Error('Monitor 最近日志缺失');
  ws.close();
  return 'monitor: ok';
}

async function main() {
  await waitForServer(baseUrl);
  const results = [];
  results.push(await testChat());
  results.push(await testOcr());
  results.push(await testAgent());
  results.push(await testMonitor());
  console.log(results.join('\n'));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
