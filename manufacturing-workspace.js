(function initManufacturingWorkspace(root, factory) {
  const workspace = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = workspace;
  if (root) root.ManufacturingWorkspace = workspace;
})(typeof window !== 'undefined' ? window : globalThis, function createManufacturingWorkspace() {
  const API_ROOT = '/api/manufacturing/v1';
  const OFFLINE_NOTICE = '后端不可用，当前为 localStorage 演示降级；客户、项目、RFQ 审批和状态流转不会伪造服务端成功。';
  const RFQ_STATUS_LABELS = Object.freeze({
    draft: '草稿',
    waiting_review: '待评审',
    information_required: '补充资料',
    ready_for_quotation: '可报价',
    quotation_in_progress: '报价中',
    quoted: '已报价',
    negotiating: '洽谈中',
    won: '已成交',
    expired: '已失效'
  });

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function validateCustomer(input = {}) {
    const errors = [];
    if (!text(input.name)) errors.push('客户名称不能为空');
    return errors;
  }

  function validateContact(input = {}) {
    const errors = [];
    if (!text(input.name)) errors.push('联系人姓名不能为空');
    if (text(input.phone) && !/^(?:\+?\d[\d\s()-]{5,24})$/.test(text(input.phone))) errors.push('联系电话格式无效');
    if (text(input.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(input.email))) errors.push('邮箱格式无效');
    return errors;
  }

  function validateProject(input = {}) {
    const errors = [];
    if (!text(input.customer_id)) errors.push('请选择所属客户');
    if (!text(input.name)) errors.push('项目名称不能为空');
    if (input.planned_start_date && input.planned_end_date && input.planned_end_date < input.planned_start_date) {
      errors.push('项目计划完成日期不能早于开始日期');
    }
    return errors;
  }

  function validateRfq(input = {}) {
    const errors = [];
    if (!text(input.customer_id)) errors.push('请选择 RFQ 客户');
    if (!text(input.product_name)) errors.push('产品名称不能为空');
    if (input.quantity !== '' && input.quantity != null && Number(input.quantity) < 0) errors.push('数量不能为负数');
    return errors;
  }

  function assertServerWritable(mode) {
    if (mode === 'server') return true;
    const error = new Error(OFFLINE_NOTICE);
    error.code = 'MANUFACTURING_OFFLINE_READ_ONLY';
    throw error;
  }

  function normalizeCollection(response = {}) {
    const data = response.data || response;
    return {
      items: Array.isArray(data.items) ? data.items : [],
      meta: data.meta || { page: 1, pageSize: 100, total: 0 }
    };
  }

  function emptyState() {
    return {
      loaded: false,
      loading: false,
      mode: 'loading',
      error: '',
      query: '',
      customers: [],
      projects: [],
      rfqs: [],
      selectedCustomerId: '',
      selectedProjectId: '',
      selectedRfqId: '',
      createKeys: {},
      contactDraft: null,
      workflow: null,
      customer: null,
      project: null,
      rfq: null
    };
  }

  return {
    API_ROOT,
    OFFLINE_NOTICE,
    RFQ_STATUS_LABELS,
    validateCustomer,
    validateContact,
    validateProject,
    validateRfq,
    assertServerWritable,
    normalizeCollection,
    emptyState
  };
});
