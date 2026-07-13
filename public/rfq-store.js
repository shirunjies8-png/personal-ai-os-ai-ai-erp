(function (global) {
  const samples = {
    complete: {
      label: '信息完整、可直接进入风险评审的订单',
      order: {
        customerName: '新能源设备客户',
        productName: '304不锈钢连接件',
        productCode: 'RFQ-CNC-001',
        materialName: '304不锈钢',
        quantity: '500',
        unit: '件',
        processType: 'CNC + 数控车',
        deliveryDate: '2026-07-20',
        contactName: '李工',
        phone: '13800000000',
        email: 'li@example.com',
        quoteDate: new Date().toISOString().slice(0, 10),
        requirements: '尺寸公差±0.05，批量发货，包装防刮花'
      },
      risks: [
        {
          name: '批量发货排程',
          type: '交期风险',
          severity: '中',
          status: 'mitigated',
          owner: '计划员',
          mitigation: '已锁定周内排产窗口',
          updatedAt: Date.now() - 1000 * 60 * 60 * 4,
          history: [{ action: '已处理', note: '已锁定周内排产窗口', status: 'mitigated', time: Date.now() - 1000 * 60 * 60 * 4 }]
        }
      ]
    },
    missingMaterial: {
      label: '缺少材料信息的订单',
      order: {
        customerName: '常州新能源科技有限公司',
        productName: '支架组件',
        productCode: 'RFQ-MISS-001',
        materialName: '',
        quantity: '300',
        unit: '件',
        processType: '焊接 + 打磨',
        deliveryDate: '2026-07-18',
        contactName: '张工',
        phone: '0519-87654321',
        email: 'zhang@demo.com',
        quoteDate: new Date().toISOString().slice(0, 10),
        requirements: '请补充材料牌号与表面处理要求'
      },
      risks: []
    },
    deliveryRisk: {
      label: '存在交期风险的订单',
      order: {
        customerName: '常州自动化设备客户',
        productName: 'CNC 加工件',
        productCode: 'RFQ-DLY-001',
        materialName: '45#钢',
        quantity: '1200',
        unit: '件',
        processType: 'CNC + 铣床',
        deliveryDate: '2026-07-15',
        contactName: '周经理',
        phone: '13900001111',
        email: 'zhou@example.com',
        quoteDate: new Date().toISOString().slice(0, 10),
        requirements: '客户要求提前 2 天交付'
      },
      risks: [
        {
          name: '交期过紧',
          type: '交付风险',
          severity: '严重',
          status: 'pending',
          owner: '计划员',
          mitigation: '待评估是否需要加班与外协',
          updatedAt: Date.now() - 1000 * 60 * 10,
          history: [{ action: '新建', note: '交期过紧', status: 'pending', time: Date.now() - 1000 * 60 * 10 }]
        }
      ]
    },
    qualityRisk: {
      label: '存在严重质量风险、必须人工处理的订单',
      order: {
        customerName: '工业设备客户',
        productName: '精密结构件',
        productCode: 'RFQ-QLT-001',
        materialName: '304不锈钢',
        quantity: '800',
        unit: '件',
        processType: 'CNC + 表面处理',
        deliveryDate: '2026-07-28',
        contactName: '王工',
        phone: '13700002222',
        email: 'wang@example.com',
        quoteDate: new Date().toISOString().slice(0, 10),
        requirements: '关键尺寸公差±0.02，外观必须无划伤'
      },
      risks: [
        {
          name: '关键尺寸公差风险',
          type: '质量风险',
          severity: '阻断',
          status: 'pending',
          owner: '质量工程师',
          mitigation: '需人工复核图纸与检具能力',
          updatedAt: Date.now() - 1000 * 60 * 20,
          history: [{ action: '新建', note: '关键尺寸公差风险', status: 'pending', time: Date.now() - 1000 * 60 * 20 }]
        },
        {
          name: '外观划伤风险',
          type: '质量风险',
          severity: '严重',
          status: 'handling',
          owner: '生产主管',
          mitigation: '已调整包装与转运流程',
          updatedAt: Date.now() - 1000 * 60 * 30,
          history: [{ action: '处理中', note: '已调整包装与转运流程', status: 'handling', time: Date.now() - 1000 * 60 * 30 }]
        }
      ]
    }
  };

  function ensureQuotationWorkspace(ws = {}) {
    const now = Date.now();
    if (!Array.isArray(ws.rfqRisks)) ws.rfqRisks = [];
    if (!Array.isArray(ws.rfqAuditTrail)) ws.rfqAuditTrail = [];
    if (!Array.isArray(ws.rfqSavedDrafts)) ws.rfqSavedDrafts = [];
    if (!Array.isArray(ws.rfqBlockers)) ws.rfqBlockers = [];
    if (!ws.rfqApproval || typeof ws.rfqApproval !== 'object') {
      ws.rfqApproval = { status: 'draft', reason: '', history: [], updatedAt: now };
    } else {
      if (!Array.isArray(ws.rfqApproval.history)) ws.rfqApproval.history = [];
      if (!ws.rfqApproval.status) ws.rfqApproval.status = 'draft';
      if (typeof ws.rfqApproval.reason !== 'string') ws.rfqApproval.reason = '';
    }
    if (typeof ws.rfqSelectedRiskId !== 'string') ws.rfqSelectedRiskId = ws.rfqRisks[0]?.id || '';
    if (typeof ws.rfqSelectedRiskReason !== 'string') ws.rfqSelectedRiskReason = '';
    if (typeof ws.rfqSampleKey !== 'string') ws.rfqSampleKey = '';
    if (typeof ws.rfqDraft !== 'string') ws.rfqDraft = ws.result || '';
    if (typeof ws.rfqLastComputedAt !== 'number') ws.rfqLastComputedAt = 0;
    if (typeof ws.rfqLastSubmittedAt !== 'number') ws.rfqLastSubmittedAt = 0;
    if (typeof ws.rfqApprovedAt !== 'number') ws.rfqApprovedAt = 0;
    if (typeof ws.rfqFinalSentAt !== 'number') ws.rfqFinalSentAt = 0;
    if (typeof ws.rfqCurrentHistoryId !== 'string') ws.rfqCurrentHistoryId = '';
    if (typeof ws.rfqApprovalReason !== 'string') ws.rfqApprovalReason = ws.rfqApproval.reason || '';
    return ws;
  }

  function cloneSample(key = 'complete') {
    const sample = samples[key] || samples.complete;
    return {
      key: samples[key] ? key : 'complete',
      label: sample.label,
      order: structuredClone(sample.order || {}),
      risks: structuredClone(sample.risks || [])
    };
  }

  const RFQStore = {
    samples,
    ensureQuotationWorkspace,
    cloneSample
  };

  global.RFQStore = RFQStore;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RFQStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
