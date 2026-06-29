const { v4: uuidv4 } = require('uuid');
const logModel = require('../models/logModel');

function add({ enterpriseId, userId = '', type, title, detail = '' }) {
  logModel.add({
    id: uuidv4(),
    enterprise_id: enterpriseId,
    user_id: userId,
    type,
    title,
    detail,
    created_at: new Date().toISOString()
  });
}

module.exports = {
  add
};
