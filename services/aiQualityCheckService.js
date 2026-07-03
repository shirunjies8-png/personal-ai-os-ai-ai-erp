const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const env = require('../config/env');
const { complete } = require('./aiService');

function normalizeText(value) {
  if (Array.isArray(value)) return value.map(normalizeText).join('\n');
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value ?? '').trim();
}

function detectQuality(input = {}, moduleName = 'general') {
  const text = normalizeText(input.text || input.content || input.before || input.after || input.source || input.payload || '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const issues = [];
  const push = (type, message, severity = '中', suggestion = '') => {
    issues.push({ type, message, severity, suggestion });
  };

  if (!text) push('empty', '内容为空', '高', '请先填写文本或上传文件后再检测。');
  if (/\bmock\b|示例数据|demo/i.test(text)) push('mock', '检测到 Mock / 示例数据', '高', '请替换为真实业务数据后再处理。');
  if (/(null|undefined|NaN)/i.test(text)) push('invalid', '存在空值或无效值标记', '中', '请清理无效值并重新校验。');
  if (/重复|duplicate/i.test(text) || lines.some((line, idx) => lines.indexOf(line) !== idx)) push('duplicate', '疑似重复内容', '中', '请合并重复项或删除重复行。');
  if (/\b(19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/.test(text) && !/\b(19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/.test(text.replace(/\b(19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, ''))) {
    // no-op placeholder for consistent flow
  }
  if (/(电话|手机号|tel|phone)[^\n]*\d{7,}/i.test(text) && /(金额|单价|数量|price|amount)[^\n]*\d{7,}/i.test(text)) {
    push('field-mix', '电话号码与金额/数量可能混淆', '中', '请检查字段类型和单位。');
  }
  if (/DELETE\s+FROM|DROP\s+TABLE|TRUNCATE|UPDATE\s+\w+\s+SET(?![^;]*WHERE)/i.test(text)) {
    push('danger-sql', '存在危险 SQL 语句', '高', '必须添加 WHERE 条件并人工确认后再执行。');
  }
  if (/(\d+\s*%|\d+\.\d+\s*%)\s*(税率|tax)/i.test(text) === false && moduleName === 'erp') {
    push('erp-tax', 'ERP 可能缺少税率字段', '中', '请补充税率并核对金额一致性。');
  }
  if (moduleName === 'ocr' && /[^\x00-\x7F]{0,}\d{1,}[^\x00-\x7F]{0,}/.test(text) && /0|O|I/.test(text)) {
    push('ocr-number', 'OCR 数字可能存在识别误差', '中', '请核对数量、金额、日期和编号。');
  }
  if (moduleName === 'excel' && !/\b(合计|总计|sum|total)\b/i.test(text)) {
    push('excel-total', '未检测到合计信息', '低', '如需统计请补充合计行或汇总公式。');
  }
  if (moduleName === 'mes' && !/(工单|工序|产品编码|交期|设备|人员|时间)/.test(text)) {
    push('mes-fields', 'MES 关键字段可能缺失', '高', '请补充工单、工序、产品编码、交期、设备和人员字段。');
  }
  if (moduleName === 'pdf' && /扫描|截图|图片/.test(text)) {
    push('pdf-scan', '可能为扫描件或图片型 PDF', '中', '建议走 OCR 后再总结。');
  }
  if (moduleName === 'word' && /#\s|```|>\s/.test(text)) {
    push('markdown', '文档中存在 Markdown/结构标记', '低', '可转为正文展示以提升可读性。');
  }
  if (moduleName === 'ppt' && lines.length < 3) push('ppt-short', '内容过短，PPT 大纲可能不完整', '中', '请补充主题、行业、页数和用途。');
  if (!issues.length) push('ok', '未发现明显质量问题', '低', '可以继续执行下一步。');

  const high = issues.some(item => item.severity === '高');
  const medium = issues.some(item => item.severity === '中');
  const risk = high ? '高' : medium ? '中' : '低';
  return {
    requestId: `qc-${uuidv4().slice(0, 8)}`,
    module: moduleName,
    ok: true,
    risk,
    issues,
    summary: issues.map(item => `${item.message}：${item.suggestion || '建议人工确认'}`).join('\n'),
    before: text,
    after: text
  };
}

async function maybeAiRefine(report, allowAi = false) {
  if (!allowAi || !env.deepseekApiKey) return report;
  try {
    const prompt = [
      '你是企业办公质量审校助手。请基于以下检测结果，输出更简洁的修复建议，要求不要编造，不要改变事实。',
      '只返回 JSON，字段包含 risk, summary, before, after, issues。',
      JSON.stringify(report, null, 2)
    ].join('\n\n');
    const response = await complete({
      messages: [{ role: 'user', content: prompt }],
      moduleName: 'quality-check',
      model: env.deepseekModel,
      provider: env.aiProvider || 'deepseek',
      baseUrl: env.deepseekBaseUrl,
      timeout: 30000,
      allowMockFallback: false,
      demoMode: false
    });
    const content = String(response.text || response.content || '').trim();
    if (!content) return report;
    try {
      const parsed = JSON.parse(content.replace(/^```json\s*/i, '').replace(/```$/, ''));
      return {
        ...report,
        ai: {
          provider: response.provider || 'deepseek',
          model: response.model || env.deepseekModel,
          content
        },
        risk: parsed.risk || report.risk,
        summary: parsed.summary || report.summary,
        after: parsed.after || report.after,
        issues: Array.isArray(parsed.issues) && parsed.issues.length ? parsed.issues : report.issues
      };
    } catch {
      return {
        ...report,
        ai: {
          provider: response.provider || 'deepseek',
          model: response.model || env.deepseekModel,
          content
        }
      };
    }
  } catch (error) {
    logger.error('quality ai refine failed', { error: error.message, module: 'quality-check', requestId: report.requestId });
    return report;
  }
}

function exportReport(report, moduleName = 'general') {
  const lines = [
    `模块：${moduleName}`,
    `时间：${new Date().toISOString()}`,
    `风险：${report.risk}`,
    `请求ID：${report.requestId}`,
    '',
    '问题列表：'
  ];
  report.issues.forEach((item, index) => {
    lines.push(`${index + 1}. [${item.severity}] ${item.message}`);
    if (item.suggestion) lines.push(`   建议：${item.suggestion}`);
  });
  lines.push('', '修复前：', report.before || '', '', '修复后：', report.after || '');
  if (report.ai?.content) {
    lines.push('', 'AI 辅助：', report.ai.content);
  }
  return lines.join('\n');
}

async function checkQuality(payload = {}) {
  const report = detectQuality(payload, payload.module || 'general');
  const refined = await maybeAiRefine(report, Boolean(payload.allowAi));
  logger.info('quality check', {
    requestId: refined.requestId,
    module: `quality-${payload.module || 'general'}`,
    risk: refined.risk,
    issueCount: refined.issues.length,
    success: true
  });
  return refined;
}

async function fixQuality(payload = {}) {
  const checked = await checkQuality(payload);
  const requireApproval = checked.risk === '高' || Boolean(payload.requireApproval);
  const fixed = {
    ...checked,
    approvalRequired: requireApproval,
    fixed: false,
    fixedPreview: checked.after,
    fixSuggestion: checked.issues.map(item => item.suggestion).filter(Boolean).join('；')
  };
  logger.info('quality fix preview', {
    requestId: fixed.requestId,
    module: `quality-${payload.module || 'general'}`,
    risk: fixed.risk,
    approvalRequired: fixed.approvalRequired
  });
  return fixed;
}

module.exports = {
  checkQuality,
  fixQuality,
  exportReport,
  detectQuality
};
