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
  const events = [];
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.method) events.push(msg);
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
  return { ws, send, events };
}

async function openPage(url) {
  let tabs = await chromeTabs();
  let tab = pickTab(tabs);
  if (!tab) {
    await chromeNewTab(url);
    tabs = await chromeTabs();
    tab = pickTab(tabs);
  }
  const { ws, send, events } = await cdpConnect(tab.webSocketDebuggerUrl);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable').catch(() => {});
  await send('Page.navigate', { url });
  await sleep(4000);
  return { ws, send, events };
}

async function evalValue(send, expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return result.result.value;
}

async function setAuth(send) {
  const credentials = {
    enterpriseName: 'Personal AI OS Demo Enterprise',
    name: '企业管理员',
    email: 'admin@personal-ai-os.local',
    password: '123456',
    role: '企业管理员'
  };
  let auth;
  try {
    auth = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: credentials.email, password: credentials.password })
    }).then(async response => {
      const text = await response.text();
      const json = text ? JSON.parse(text) : null;
      if (!response.ok) throw new Error(json?.message || text || `HTTP ${response.status}`);
      return json;
    });
  } catch {
    auth = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    }).then(async response => {
      const text = await response.text();
      const json = text ? JSON.parse(text) : null;
      if (!response.ok) throw new Error(json?.message || text || `HTTP ${response.status}`);
      return json;
    });
  }
  const session = {
    token: auth.data?.token || auth.token || '',
    user: auth.data?.user || auth.user || {
      email: credentials.email,
      name: credentials.name,
      role: credentials.role
    },
    enterprise: auth.data?.enterprise || auth.enterprise || {
      name: credentials.enterpriseName
    },
    demo: false
  };
  await evalValue(send, `localStorage.setItem('personal-ai-os-auth', JSON.stringify(${JSON.stringify(session)}));`);
}

async function testChat() {
  const { ws, send } = await openPage(`${baseUrl}/#/chat`);
  await setAuth(send);
  await send('Page.reload');
  await sleep(3000);
  const prompt = '请用三点回答你能帮我解决什么问题。';
  await evalValue(send, `(() => {
    const input = document.getElementById('chatInput');
    input.value = ${JSON.stringify(prompt)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-form="chat"]').requestSubmit();
  })()`);
  await sleep(12000);
  const chatState = await evalValue(send, `(() => {
    const messages = [...document.querySelectorAll('#chatMessages .message')];
    const assistantMessages = messages.filter(item => !item.classList.contains('user'));
    const last = assistantMessages.at(-1);
    return JSON.stringify({
      count: messages.length,
      assistantCount: assistantMessages.length,
      lastText: last?.innerText || '',
      inputDisabled: Boolean(document.getElementById('chatInput')?.disabled),
      body: document.body.innerText
    });
  })()`);
  const parsedChat = JSON.parse(chatState);
  const body = parsedChat.body || '';
  if (!parsedChat.assistantCount || !parsedChat.lastText.trim()) throw new Error(`AI Chat 未生成可见回复：${JSON.stringify(parsedChat)}`);
  if (parsedChat.inputDisabled) throw new Error('AI Chat 回复后输入框不可用');
  if (body.includes('模型返回为空')) throw new Error('仍出现模型返回为空');
  ws.close();
  return 'ai-chat: ok';
}

async function testOcr() {
  const { ws, send } = await openPage(`${baseUrl}/#/ocr`);
  await setAuth(send);
  await send('Page.reload');
  await sleep(3000);
  const stateBefore = await evalValue(send, `window.App?.temp?.ocr?.status || ''`);
  const ocrBodyBefore = await evalValue(send, `document.body.innerText || ''`);
  if (!ocrBodyBefore.includes('OCR识别') || /undefined|null|NaN/i.test(stateBefore)) throw new Error(`OCR 初始状态异常：${stateBefore}`);
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
  const uploadState = JSON.parse(await evalValue(send, `JSON.stringify({ name: window.App?.temp?.ocr?.file?.name || '', status: window.App?.temp?.ocr?.status || '' })`));
  if (uploadState.name !== 'ocr-test.png') throw new Error(`OCR 上传后文件状态异常：${JSON.stringify(uploadState)}`);
  // A previous document session can contain text from an earlier OCR run.
  // Clear only transient UI results so this test must observe the current
  // upload completing or reaching an explicit failure/timeout state.
  await evalValue(send, `(() => {
    const o = window.App?.temp?.ocr;
    if (!o) return false;
    o.providerId = 'auto';
    o.providerResult = null;
    o.result = '';
    o.original = '';
    o.status = '等待识别';
    return true;
  })()`);
  await evalValue(send, `document.querySelector('[data-action="ocr-run"]').click()`);
  let runState = { status: '', text: '' };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(5000);
    runState = JSON.parse(await evalValue(send, `JSON.stringify({
      status: window.App?.temp?.ocr?.providerResult?.status || window.App?.temp?.ocr?.status || '',
      text: window.App?.temp?.ocr?.providerResult?.rawText || window.App?.temp?.ocr?.result || ''
    })`));
    if (runState.text.trim() || /failed|error|unavailable|timeout|失败|不可用|超时/i.test(runState.status)) break;
  }
  const statusAfterRun = runState.status;
  const text = runState.text;
  if (!text.trim() && !/failed|error|unavailable|timeout|失败|不可用|超时/i.test(statusAfterRun)) throw new Error(`OCR 未返回结果且无明确降级状态：${statusAfterRun}`);
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
    snapshot = await evalValue(send, `(() => {
      const body = document.body.innerText || '';
      const statusText = document.querySelector('.panel .status-pill')?.textContent || '';
      const logText = document.getElementById('agentLog')?.innerText || '';
      const stepText = document.querySelector('.agent-steps')?.innerText || '';
      return JSON.stringify({
        statusText,
        body: body.slice(0, 2000),
        logText: logText.slice(0, 1000),
        stepText: stepText.slice(0, 1000)
      });
    })()`);
    if (/等待中|执行中|已完成|等待审批|失败|取消|超时|pending|running|waiting_human|success|failed|timeout|cancelled/.test(snapshot)) break;
    await sleep(1000);
  }
  if (!/等待中|执行中|已完成|等待审批|失败|pending|running|waiting_human|success|failed|timeout|cancelled/.test(snapshot)) {
    throw new Error('Agent 状态流转未出现');
  }
  ws.close();
  return 'agent-runtime: ok';
}


async function testQuotation() {
  const { ws, send, events } = await openPage(`${baseUrl}/#/quotation`);
  await setAuth(send);
  await send('Page.reload');
  await sleep(3000);

  const click = async selector => evalValue(send, `(() => document.querySelector(${JSON.stringify(selector)})?.click())()`);
  const bodyText = async () => evalValue(send, 'document.body.innerText');
  const getApproval = async () => evalValue(send, `(() => document.querySelector('.panel .status-pill')?.textContent || '')()`);
  const expectNoConsoleErrors = async label => {
    const redErrors = events.filter(event => {
      const method = event.method || '';
      const params = event.params || {};
      const text = JSON.stringify(params);
      if (method === 'Runtime.exceptionThrown') return true;
      if (method === 'Log.entryAdded' && params.entry?.level === 'error') return true;
      return /ReferenceError|TypeError|Uncaught|Failed to execute/.test(text);
    });
    if (redErrors.length) {
      throw new Error(`${label} 出现浏览器红色错误：${JSON.stringify(redErrors.slice(-2))}`);
    }
  };

  await click('[data-action="quotation-sample"][data-sample="complete"]');
  await sleep(1200);
  await click('[data-action="quotation-generate"]');
  await sleep(2500);
  let body = await bodyText();
  if (!body.includes('报价草稿') && !body.includes('RFQ 报价草稿')) throw new Error('RFQ 报价草稿未生成');
  if (!body.includes('当前无阻断项') && !body.includes('可生成')) throw new Error('完整示例不应出现阻断项');

  await click('[data-action="quotation-sample"][data-sample="missingMaterial"]');
  await sleep(1200);
  await click('[data-action="quotation-generate"]');
  await sleep(1800);
  body = await bodyText();
  if (!body.includes('缺少：材料名称') && !body.includes('必填项缺失')) throw new Error('缺少材料示例未触发阻断');

  await click('[data-action="quotation-sample"][data-sample="deliveryRisk"]');
  await sleep(1200);
  await click('[data-action="quotation-generate"]');
  await sleep(1800);
  body = await bodyText();
  if (!body.includes('交期过紧') && !body.includes('交付风险')) throw new Error('交期风险示例未触发阻断');

  await click('[data-action="quotation-sample"][data-sample="qualityRisk"]');
  await sleep(1200);
  await evalValue(send, `(() => {
    const reason = document.querySelector('[data-ws-field="approvalReason"][data-module="quotation"]');
    if (reason) {
      reason.value = 'RFQ 审批通过，已完成人工确认';
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    }
  })()`);
  await evalValue(send, `(() => {
    const ws = App.getQuotationWorkspace();
    return (ws.rfqRisks || []).map(risk => risk.id);
  })()`).then(async ids => {
    for (const id of ids) {
      await evalValue(send, `App.quotationSelectRisk(${JSON.stringify(id)})`);
      await sleep(500);
      await click('[data-action="quotation-risk-action"][data-status="mitigate"]');
      await sleep(800);
    }
  });
  body = await bodyText();
  if (/阻断\s+\d+/.test(body) && !body.includes('可继续')) {
    throw new Error('风险缓解后仍存在阻断');
  }

  await click('[data-action="quotation-sample"][data-sample="complete"]');
  await sleep(1200);
  await click('[data-action="quotation-submit-approval"]');
  await sleep(800);
  await evalValue(send, `(() => {
    const reason = document.querySelector('[data-ws-field="approvalReason"][data-module="quotation"]');
    if (reason) {
      reason.value = '';
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    }
  })()`);
  await click('[data-action="quotation-decision"][data-status="rejected"]');
  await sleep(900);
  body = await bodyText();
  if (!body.includes('pending') && !body.includes('draft')) throw new Error('驳回空原因仍然变更状态');

  await evalValue(send, `(() => {
    const reason = document.querySelector('[data-ws-field="approvalReason"][data-module="quotation"]');
    if (reason) {
      reason.value = '客户要求补充交期说明';
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    }
  })()`);
  await click('[data-action="quotation-decision"][data-status="returned"]');
  await sleep(900);
  body = await bodyText();
  if (!body.includes('returned')) throw new Error('退回补充未生效');

  await evalValue(send, `(() => {
    const reason = document.querySelector('[data-ws-field="approvalReason"][data-module="quotation"]');
    if (reason) {
      reason.value = 'RFQ 审批通过，已完成人工确认';
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    }
  })()`);
  await click('[data-action="quotation-decision"][data-status="approved"]');
  await sleep(2500);
  body = await bodyText();
  if (!body.includes('审批通过') && !body.includes('approved')) throw new Error('审批通过未生效');
  if (!body.includes('报价草稿')) throw new Error('审批通过后未生成报价草稿');

  await click('[data-action="quotation-save"]');
  await sleep(1000);
  body = await bodyText();
  if (!body.includes('保存报价草稿')) throw new Error('报价草稿保存未进入审计记录');

  await click('[data-action="quotation-copy"]');
  await sleep(1000);
  body = await bodyText();
  if (!body.includes('复制报价草稿')) throw new Error('报价草稿复制未进入审计记录');

  await evalValue(send, `(() => {
    window.__rfqPrintCalled = false;
    window.open = () => ({
      document: { open() {}, write() {}, close() {} },
      focus() {},
      print() { window.__rfqPrintCalled = true; }
    });
  })()`);
  await click('[data-action="quotation-print"]');
  await sleep(1200);
  const printed = await evalValue(send, 'Boolean(window.__rfqPrintCalled)');
  body = await bodyText();
  if (!printed && !body.includes('打印报价草稿')) throw new Error('报价草稿打印动作未触发');

  await evalValue(send, 'window.confirm = () => true');
  await click('[data-action="quotation-final-send"]');
  await sleep(1200);
  body = await bodyText();
  if (!body.includes('最终发送确认')) throw new Error('最终发送人工确认未进入审计记录');

  await send('Page.reload');
  await sleep(2500);
  body = await bodyText();
  if (!body.includes('RFQ 报价草稿') || !body.includes('最终发送确认')) {
    throw new Error('页面刷新后 RFQ 数据未恢复');
  }

  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true
  });
  await sleep(800);
  const mobileLayout = await evalValue(send, `(() => {
    const body = document.body;
    const buttons = [...document.querySelectorAll('button')];
    const clipped = buttons.filter(btn => {
      const r = btn.getBoundingClientRect();
      return r.width < 12 || r.height < 12 || r.right > window.innerWidth + 4;
    }).length;
    return JSON.stringify({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      clipped,
      hasQuotation: body.innerText.includes('报价助手')
    });
  })()`);
  const parsedMobile = JSON.parse(mobileLayout);
  if (!parsedMobile.hasQuotation) throw new Error('手机尺寸下报价页面未显示');
  if (parsedMobile.scrollWidth > parsedMobile.innerWidth + 8) throw new Error('手机尺寸下存在横向溢出');
  if (parsedMobile.clipped > 0) throw new Error('手机尺寸下存在按钮遮挡或尺寸异常');
  await send('Emulation.clearDeviceMetricsOverride').catch(() => {});

  const approvalStatus = await getApproval();
  if (!approvalStatus) throw new Error('审批状态未显示');
  const audit = await evalValue(send, `document.body.innerText.includes('审计记录')`);
  if (!audit) throw new Error('审计记录未显示');
  await expectNoConsoleErrors('RFQ 报价审批');

  ws.close();
  return 'quotation: ok';
}

async function testInquiries() {
  const { ws, send, events } = await openPage(`${baseUrl}/#/inquiries`);
  await setAuth(send);
  await send('Page.reload');
  await sleep(2500);
  const marker = `E2E询盘-${Date.now()}`;
  await evalValue(send, `(() => {
    document.getElementById('inquiryCustomer').value = ${JSON.stringify(marker)};
    document.getElementById('inquiryProduct').value = '测试产品';
    document.getElementById('inquiryQuantity').value = '10';
    document.querySelector('[data-action="inquiry-save"]').click();
  })()`);
  await sleep(1800);
  await send('Page.reload');
  await sleep(2200);
  let body = await evalValue(send, 'document.body.innerText');
  if (!body.includes(marker)) throw new Error('询盘新增后刷新未恢复');

  await evalValue(send, `(() => {
    const card = [...document.querySelectorAll('.kb-item')].find(item => item.innerText.includes(${JSON.stringify(marker)}));
    card?.querySelector('[data-action="inquiry-edit"]')?.click();
  })()`);
  await sleep(500);
  await evalValue(send, `(() => {
    document.getElementById('inquiryProduct').value = '测试产品-已编辑';
    document.querySelector('[data-action="inquiry-save"]').click();
  })()`);
  await sleep(1600);
  body = await evalValue(send, 'document.body.innerText');
  if (!body.includes('测试产品-已编辑')) throw new Error('询盘编辑未生效');

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await sleep(500);
  const mobile = JSON.parse(await evalValue(send, `JSON.stringify({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, visible: document.body.innerText.includes('询盘管理') })`));
  if (!mobile.visible || mobile.scrollWidth > mobile.innerWidth + 8) throw new Error('询盘页手机布局异常');
  await send('Emulation.clearDeviceMetricsOverride').catch(() => {});

  await evalValue(send, `window.confirm = () => true`);
  await evalValue(send, `(() => {
    const card = [...document.querySelectorAll('.kb-item')].find(item => item.innerText.includes(${JSON.stringify(marker)}));
    card?.querySelector('[data-action="inquiry-delete"]')?.click();
  })()`);
  await sleep(1600);
  await send('Page.reload');
  await sleep(2200);
  body = await evalValue(send, 'document.body.innerText');
  if (body.includes(marker)) throw new Error('询盘删除后刷新仍存在');
  const browserErrors = events.filter(event => event.method === 'Runtime.exceptionThrown' || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error'));
  if (browserErrors.length) throw new Error(`询盘页出现浏览器错误：${JSON.stringify(browserErrors.slice(-2))}`);
  ws.close();
  return 'inquiries-sqlite-crud-mobile: ok';
}

async function testMonitor() {
  const { ws, send } = await openPage(`${baseUrl}/#/monitor`);
  await setAuth(send);
  await send('Page.reload');
  await sleep(2500);
  const body = await evalValue(send, 'document.body.innerText');
  if (!body.includes('系统监控') && !body.includes('健康状态') && !body.includes('Agent任务总数')) throw new Error('Monitor 页面未打开');
  ws.close();
  return 'monitor: ok';
}

async function main() {
  await waitForServer(baseUrl);
  const results = [];
  results.push(await testChat());
  results.push(await testOcr());
  results.push(await testQuotation());
  results.push(await testInquiries());
  results.push(await testAgent());
  results.push(await testMonitor());
  console.log(results.join('\n'));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
