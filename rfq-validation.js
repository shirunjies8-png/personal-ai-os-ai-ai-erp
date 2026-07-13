(function (global) {
  const REQUIRED_FIELDS = [
    ['customerName', '客户名称'],
    ['productName', '产品名称'],
    ['materialName', '材料名称'],
    ['quantity', '数量'],
    ['processType', '工艺'],
    ['deliveryDate', '交期'],
    ['contactName', '联系人'],
    ['phone', '联系方式']
  ];

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function hasValue(value) {
    return text(value) !== '' && !['待补充', '未提供', 'undefined', 'null', 'NaN'].includes(text(value));
  }

  function isPositiveNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0;
  }

  function missingFields(order = {}) {
    const missing = [];
    REQUIRED_FIELDS.forEach(([key, label]) => {
      if (key === 'quantity') {
        if (!isPositiveNumber(order[key])) missing.push({ key, label, reason: `缺少${label}或数量无效`, suggestion: `请补充有效的${label}。` });
        return;
      }
      if (!hasValue(order[key])) missing.push({ key, label, reason: `缺少${label}`, suggestion: `请补充${label}后再继续报价。` });
    });
    return missing;
  }

  function handledRiskNotes(risks = []) {
    return (Array.isArray(risks) ? risks : [])
      .filter(risk => ['mitigated', 'accepted', 'closed'].includes(global.RFQRisk?.normalizeStatus(risk.status) || risk.status))
      .map(risk => {
        const status = global.RFQRisk ? global.RFQRisk.statusLabel(risk.status) : risk.status;
        const pieces = [
          risk.name || '未命名风险',
          risk.type ? `类型：${risk.type}` : '',
          risk.owner ? `负责人：${risk.owner}` : '',
          risk.mitigation ? `措施：${risk.mitigation}` : '',
          risk.acceptReason ? `接受原因：${risk.acceptReason}` : '',
          `状态：${status}`
        ].filter(Boolean);
        return pieces.join(' · ');
      });
  }

  function getQuotationBlockers(order = {}, risks = []) {
    const blockers = [];
    const missing = missingFields(order);
    if (missing.length) {
      blockers.push({
        id: 'rfq-missing-fields',
        title: '必填项缺失',
        type: 'missing-field',
        severity: 'blocking',
        reason: `缺少：${missing.map(item => item.label).join('、')}`,
        suggestion: '请补充缺失字段后再生成报价草稿。',
        items: missing
      });
    }

    const severeOpen = (Array.isArray(risks) ? risks : []).filter(risk => {
      const severity = global.RFQRisk?.normalizeSeverity(risk.severity) || String(risk.severity || '').toLowerCase();
      const status = global.RFQRisk?.normalizeStatus(risk.status) || String(risk.status || '').toLowerCase();
      const severe = ['severe', 'blocking'].includes(severity);
      return severe && ['pending', 'handling'].includes(status);
    }).map(risk => global.RFQRisk ? global.RFQRisk.normalizeRisk(risk) : risk);

    severeOpen.forEach(risk => {
      blockers.push({
        id: risk.id,
        title: risk.name || '未命名风险',
        type: risk.type || '风险',
        severity: risk.severity || 'blocking',
        reason: `${risk.name || '风险'} 仍处于 ${global.RFQRisk ? global.RFQRisk.statusLabel(risk.status) : risk.status}，需人工处理。`,
        suggestion: risk.mitigation || '请先处理、缓解或接受该风险后再继续报价。',
        risk
      });
    });

    const invalidAccepted = (Array.isArray(risks) ? risks : []).filter(risk => global.RFQRisk?.needsAcceptanceReason(risk));
    invalidAccepted.forEach(risk => {
      blockers.push({
        id: `${risk.id}-accept`,
        title: `${risk.name || '风险'} 的接受原因缺失`,
        type: 'accept-reason',
        severity: 'blocking',
        reason: '严重或阻断风险被标记为 accepted 时，必须填写接受原因。',
        suggestion: '请补充接受原因后再保存风险状态。',
        risk
      });
    });

    return blockers;
  }

  function buildQuotationDraft(order = {}, risks = [], approval = {}) {
    const handled = handledRiskNotes(risks);
    const missing = missingFields(order);
    const riskNotes = handled.length
      ? handled.map(item => `- ${item}`).join('\n')
      : '- 暂无已处理风险说明';
    const quoteDate = text(order.quoteDate) || new Date().toISOString().slice(0, 10);
    const textBlocks = [
      'RFQ 报价草稿',
      '',
      '一、客户需求',
      `客户名称：${text(order.customerName) || '待补充'}`,
      `产品名称：${text(order.productName) || '待补充'}`,
      `产品编码：${text(order.productCode) || '待补充'}`,
      `材料：${text(order.materialName) || '待补充'}`,
      `数量：${text(order.quantity) || '待补充'}`,
      `单位：${text(order.unit) || '件'}`,
      `工艺：${text(order.processType) || '待补充'}`,
      `交期：${text(order.deliveryDate) || '待补充'}`,
      `联系人：${text(order.contactName) || '待补充'}`,
      `联系方式：${text(order.phone) || '待补充'}`,
      `邮箱：${text(order.email) || '待补充'}`,
      `报价日期：${quoteDate}`,
      '',
      '二、交付与风险说明',
      `当前审批状态：${approval.status || 'draft'}`,
      riskNotes,
      missing.length ? `- 待补充项：${missing.map(item => item.label).join('、')}` : '- 必填项已齐备',
      '',
      '三、报价说明',
      `本次 RFQ 草稿基于客户需求、材料、数量、工艺与交期整理，建议在人工确认客户要求、图纸复杂度、交期与风险处理结果后再发送正式报价。`,
      '最终发送动作必须保留人工确认。'
    ];
    return textBlocks.join('\n');
  }

  const RFQValidation = {
    requiredFields: REQUIRED_FIELDS,
    missingFields,
    getQuotationBlockers,
    handledRiskNotes,
    buildQuotationDraft
  };

  global.RFQValidation = RFQValidation;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RFQValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
