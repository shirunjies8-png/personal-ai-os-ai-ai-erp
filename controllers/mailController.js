const { v4: uuidv4 } = require('uuid');
const mailAgent = require('../mail/mailAgent');
const mailRecordModel = require('../models/mailRecordModel');
const { ok } = require('../utils/response');

async function testConnection(req, res, next) {
  try {
    if (!mailAgent.isConfigured()) {
      return res.status(503).json({ ok: false, message: '当前未配置 Mail Agent 企业接口，请在系统设置中完成配置。', data: { status: '未配置' } });
    }
    const inbox = await mailAgent.listInbox();
    ok(res, { inbox }, 'Mail Agent 连接可用');
  } catch (error) {
    next(error);
  }
}

async function send(req, res, next) {
  try {
    const result = await mailAgent.sendMail(req.body);
    const record = {
      id: uuidv4(),
      enterprise_id: req.user.enterprise_id,
      user_id: req.user.id,
      recipient: req.body.recipient,
      subject: req.body.subject,
      mail_type: req.body.type || '商务邮件',
      attachments: req.body.attachments || [],
      status: result.status || '已发送',
      failure_reason: result.message || '',
      created_at: new Date().toISOString()
    };
    mailRecordModel.create(record);
    ok(res, { result, record }, '邮件处理完成');
  } catch (error) {
    next(error);
  }
}

function listRecords(req, res) {
  ok(res, { items: mailRecordModel.list(req.user.enterprise_id) });
}

async function listInbox(req, res, next) {
  try {
    const items = await mailAgent.listInbox();
    ok(res, { items });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  testConnection,
  send,
  listRecords,
  listInbox
};
