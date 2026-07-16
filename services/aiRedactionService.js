const crypto = require('node:crypto');

const RULES = Object.freeze([
  ['authorization', /\b(?:authorization|bearer)\s*[:=]?\s*[A-Za-z0-9._~+/=-]{8,}/gi, '[REDACTED_AUTHORIZATION]'],
  ['api_key', /\b(?:api[_ -]?key|secret|token)\s*[:=]\s*[A-Za-z0-9._~+/=-]{8,}/gi, '[REDACTED_API_KEY]'],
  ['phone', /(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g, '[REDACTED_PHONE]'],
  ['id_card', /(?<!\d)\d{17}[\dXx](?!\d)/g, '[REDACTED_ID]'],
  ['bank_card', /(?<!\d)(?:\d[ -]?){16,19}(?!\d)/g, '[REDACTED_BANK_CARD]'],
  ['email', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]'],
  ['bank_account', /(?:银行账(?:号|户)|收款账号)\s*[:：]?\s*[\d -]{8,}/gi, '银行账户：[REDACTED_BANK_ACCOUNT]'],
  ['tax_id', /(?:税号|统一社会信用代码)\s*[:：]?\s*[0-9A-Z]{15,20}/gi, '税号：[REDACTED_TAX_ID]'],
  ['customer_name', /(?:客户姓名|联系人)\s*[:：]\s*[\u4e00-\u9fa5A-Za-z· ]{2,30}/gi, '客户姓名：[REDACTED_CUSTOMER_NAME]'],
  ['customer_company', /(?:客户(?:企业|公司|名称)|企业名称)\s*[:：]\s*[^\n,，;；]{2,80}/gi, '客户企业：[REDACTED_CUSTOMER_COMPANY]'],
  ['order_no', /(?:内部订单号|订单号|单据编号)\s*[:：]\s*[A-Za-z0-9_-]{4,64}/gi, '订单号：[REDACTED_ORDER_NO]'],
  ['device_no', /(?:设备编号|设备号)\s*[:：]\s*[A-Za-z0-9_-]{3,64}/gi, '设备编号：[REDACTED_DEVICE_NO]'],
  ['local_path', /(?:\/[Uu]sers\/[^\s'"<>]+|[A-Za-z]:\\(?:[^\\\s]+\\)*[^\\\s]*)/g, '[REDACTED_LOCAL_PATH]']
]);

function redactText(value = '') {
  let text = String(value || '');
  const counts = {};
  for (const [type, pattern, replacement] of RULES) {
    let count = 0;
    text = text.replace(pattern, () => {
      count += 1;
      return replacement;
    });
    if (count) counts[type] = (counts[type] || 0) + count;
  }
  return { text, counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0) };
}

function protectMessages(messages = [], options = {}) {
  const mode = ['block', 'mask', 'raw_confirmed'].includes(options.mode) ? options.mode : 'mask';
  const mapped = [];
  const counts = {};
  let total = 0;
  for (const item of messages) {
    const result = redactText(item?.content || '');
    total += result.total;
    for (const [key, count] of Object.entries(result.counts)) counts[key] = (counts[key] || 0) + count;
    mapped.push({ ...item, content: mode === 'raw_confirmed' ? String(item?.content || '') : result.text });
  }
  if (mode === 'block' && total > 0) {
    const error = new Error('检测到敏感内容，当前策略禁止发送。');
    error.code = 'SENSITIVE_CONTENT_BLOCKED';
    error.status = 422;
    throw error;
  }
  if (mode === 'raw_confirmed' && !options.confirmed) {
    const error = new Error('发送原始敏感内容前必须由用户明确确认。');
    error.code = 'SENSITIVE_CONFIRMATION_REQUIRED';
    error.status = 409;
    throw error;
  }
  return { messages: mapped, total, counts, mode, changed: total > 0 && mode !== 'raw_confirmed' };
}

function hashPayload(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

module.exports = { RULES, redactText, protectMessages, hashPayload };
