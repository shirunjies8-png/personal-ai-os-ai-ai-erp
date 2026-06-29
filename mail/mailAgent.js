const env = require('../config/env');

async function sendMail(payload) {
  if (!env.mailAgentBaseUrl || !env.mailAgentApiKey) {
    return {
      mode: 'demo',
      status: '演示模式',
      message: '未配置 Mail Agent，已进入演示发送'
    };
  }

  const response = await fetch(`${env.mailAgentBaseUrl.replace(/\/$/, '')}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.mailAgentApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Mail Agent HTTP ${response.status}`);
  return response.json();
}

async function listInbox() {
  if (!env.mailAgentBaseUrl || !env.mailAgentApiKey) {
    return [
      { id: 'demo-1', subject: '标书确认回执', from: 'tender@demo-company.com', preview: '已收到投标文件，请等待下一步通知。' },
      { id: 'demo-2', subject: '报价确认邮件', from: 'buyer@demo-company.com', preview: '报价已收到，请补充交期。' }
    ];
  }
  const response = await fetch(`${env.mailAgentBaseUrl.replace(/\/$/, '')}/inbox`, {
    headers: { Authorization: `Bearer ${env.mailAgentApiKey}` }
  });
  if (!response.ok) throw new Error(`Mail Agent HTTP ${response.status}`);
  return response.json();
}

module.exports = {
  sendMail,
  listInbox
};
