const { v4: uuidv4 } = require('uuid');
const feedbackModel = require('../models/feedbackModel');
const feedbackEngine = require('../rl/feedbackEngine');
const { ok } = require('../utils/response');

function createFeedback(req, res) {
  const item = feedbackEngine.saveFeedback({
    id: uuidv4(),
    enterprise_id: req.user.enterprise_id,
    user_id: req.user.id,
    category: req.body.category || 'agent',
    rating: req.body.rating,
    reason: req.body.reason || '',
    modified_content: req.body.modifiedContent || '',
    created_at: new Date().toISOString()
  });
  ok(res, { item }, '反馈已保存');
}

function listFeedback(req, res) {
  const items = feedbackModel.list(req.user.enterprise_id);
  ok(res, {
    items,
    summary: feedbackEngine.summarize(items)
  });
}

module.exports = {
  createFeedback,
  listFeedback
};
