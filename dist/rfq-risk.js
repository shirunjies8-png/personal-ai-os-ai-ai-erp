(function (global) {
  const STATUS_META = {
    pending: { label: 'pending', className: 'amber', name: '待处理' },
    handling: { label: 'handling', className: 'blue', name: '处理中' },
    mitigated: { label: 'mitigated', className: 'success', name: '已缓解' },
    accepted: { label: 'accepted', className: 'warning', name: '已接受' },
    closed: { label: 'closed', className: 'success', name: '已关闭' }
  };

  const SEVERITY_META = {
    low: { key: 'low', name: '低' },
    medium: { key: 'medium', name: '中' },
    high: { key: 'high', name: '严重' },
    severe: { key: 'severe', name: '严重' },
    blocking: { key: 'blocking', name: '阻断' }
  };

  const statusAliases = {
    待处理: 'pending',
    pending: 'pending',
    处理中: 'handling',
    handling: 'handling',
    已缓解: 'mitigated',
    mitigated: 'mitigated',
    已接受: 'accepted',
    accepted: 'accepted',
    已关闭: 'closed',
    closed: 'closed'
  };

  const severityAliases = {
    低: 'low',
    low: 'low',
    中: 'medium',
    medium: 'medium',
    严重: 'high',
    high: 'high',
    severe: 'severe',
    阻断: 'blocking',
    blocking: 'blocking'
  };

  function normalizeStatus(value = '') {
    const text = String(value || '').trim();
    return statusAliases[text] || statusAliases[text.toLowerCase()] || 'pending';
  }

  function normalizeSeverity(value = '') {
    const text = String(value || '').trim();
    return severityAliases[text] || severityAliases[text.toLowerCase()] || 'medium';
  }

  function statusClass(value = '') {
    return STATUS_META[normalizeStatus(value)]?.className || 'amber';
  }

  function statusLabel(value = '') {
    return STATUS_META[normalizeStatus(value)]?.name || '待处理';
  }

  function severityLabel(value = '') {
    return SEVERITY_META[normalizeSeverity(value)]?.name || '中';
  }

  function severityClass(value = '') {
    const key = normalizeSeverity(value);
    return key === 'blocking' || key === 'severe' ? 'warning' : key === 'high' ? 'warning' : key === 'low' ? 'success' : 'amber';
  }

  function safeText(value, fallback = '') {
    const text = String(value == null ? '' : value).trim();
    return text || fallback;
  }

  function normalizeRisk(input = {}) {
    const now = Date.now();
    const status = normalizeStatus(input.status);
    const severity = normalizeSeverity(input.severity);
    const history = Array.isArray(input.history)
      ? input.history.map(item => ({
        id: item.id || `risk-history-${now}`,
        action: safeText(item.action, '更新'),
        note: safeText(item.note, ''),
        status: normalizeStatus(item.status || status),
        time: Number(item.time || item.updatedAt || now)
      }))
      : [];
    return {
      id: safeText(input.id, `rfq-risk-${now}-${Math.random().toString(36).slice(2, 8)}`),
      name: safeText(input.name || input.title, '未命名风险'),
      type: safeText(input.type || input.category, '交付风险'),
      severity,
      status,
      owner: safeText(input.owner, '待分配'),
      mitigation: safeText(input.mitigation || input.measure, '待补充'),
      acceptReason: safeText(input.acceptReason || input.accept_reason, ''),
      history,
      createdAt: Number(input.createdAt || now),
      updatedAt: Number(input.updatedAt || input.time || now),
      source: safeText(input.source, 'rfq')
    };
  }

  function normalizeRiskList(list = []) {
    return (Array.isArray(list) ? list : []).map(item => normalizeRisk(item));
  }

  function isSevereRisk(risk = {}) {
    return ['severe', 'blocking'].includes(normalizeSeverity(risk.severity));
  }

  function isBlockingRisk(risk = {}) {
    return isSevereRisk(risk) && ['pending', 'handling'].includes(normalizeStatus(risk.status));
  }

  function needsAcceptanceReason(risk = {}) {
    return isSevereRisk(risk) && normalizeStatus(risk.status) === 'accepted' && !safeText(risk.acceptReason);
  }

  function lifecycleName(risk = {}) {
    return statusLabel(risk.status);
  }

  const RFQRisk = {
    STATUS_META,
    SEVERITY_META,
    normalizeStatus,
    normalizeSeverity,
    normalizeRisk,
    normalizeRiskList,
    statusClass,
    statusLabel,
    severityLabel,
    severityClass,
    isSevereRisk,
    isBlockingRisk,
    needsAcceptanceReason,
    lifecycleName
  };

  global.RFQRisk = RFQRisk;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RFQRisk;
  }
})(typeof window !== 'undefined' ? window : globalThis);
