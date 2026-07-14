const DAILY = new Map();
const MAX_REQUEST_CHARS = 120000;
const MAX_DAILY_TOKENS = Number(process.env.AI_DAILY_TOKEN_LIMIT || 200000);

function key(enterpriseId = 'default') { return `${enterpriseId}:${new Date().toISOString().slice(0, 10)}`; }
function estimate(messages = []) { return Math.ceil(JSON.stringify(messages).length / 2); }
function reserve({ enterpriseId, messages }) {
  const id = key(enterpriseId); const used = DAILY.get(id) || 0; const tokens = estimate(messages);
  if (JSON.stringify(messages).length > MAX_REQUEST_CHARS) throw new Error('AI 输入超过资源限制');
  if (used + tokens > MAX_DAILY_TOKENS) throw new Error('AI 每日资源额度已用尽');
  DAILY.set(id, used + tokens); return tokens;
}
function record({ enterpriseId, totalTokens = 0, reserved = 0 }) {
  const id = key(enterpriseId); DAILY.set(id, Math.max(0, (DAILY.get(id) || 0) + Number(totalTokens || 0) - Number(reserved || 0)));
}
function usage(enterpriseId) { return { usedTokens: DAILY.get(key(enterpriseId)) || 0, limitTokens: MAX_DAILY_TOKENS }; }
module.exports = { reserve, record, usage, estimate };
