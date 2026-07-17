const { v4: uuidv4 } = require('uuid');
const logModel = require('../models/logModel');
const { sanitize } = require('../utils/logger');

function json(value) {
  if (value == null || value === '') return '';
  return JSON.stringify(sanitize(value));
}

function add({
  enterpriseId,
  userId = '',
  type,
  title,
  detail = '',
  entityType = '',
  entityId = '',
  action = '',
  requestId = '',
  approvalId = '',
  before = '',
  after = '',
  result = 'success',
  sourceClient = ''
}) {
  logModel.add({
    id: uuidv4(),
    enterprise_id: enterpriseId,
    user_id: userId,
    type,
    title: sanitize(title),
    detail: sanitize(detail),
    entity_type: entityType,
    entity_id: entityId,
    action,
    request_id: requestId,
    approval_id: approvalId,
    before_json: json(before),
    after_json: json(after),
    result,
    source_client: sourceClient,
    created_at: new Date().toISOString()
  });
}

module.exports = {
  add
};
