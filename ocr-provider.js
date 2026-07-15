(function init(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OCRArchitecture = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function factory() {
  const SCHEMA_VERSION = 2;
  const RUN_STATUSES = new Set(['waiting', 'processing', 'success', 'partial_success', 'failed', 'timeout', 'fallback', 'cancelled']);
  const REVIEW_STATUSES = new Set(['pending', 'reviewing', 'approved', 'rejected', 'needs_retry']);
  const KEY_FIELDS = new Set(['customer_name', 'document_no', 'date', 'quantity', 'unit_price', 'total_amount', 'tax_rate', 'delivery_date']);
  const FIELD_DEFINITIONS = [
    ['customer_name', '客户名称', true], ['contact', '联系方式', false], ['document_no', '单据编号', true],
    ['date', '日期', true], ['product_name', '产品名称', true], ['material', '材料', false],
    ['specification', '规格', false], ['quantity', '数量', true], ['unit_price', '单价', false],
    ['total_amount', '总金额', false], ['tax_rate', '税率', false], ['delivery_date', '交期', false],
    ['address', '地址', false], ['notes', '备注', false]
  ].map(([key, label, required]) => ({ key, label, required, keyField: KEY_FIELDS.has(key) }));
  const LEGACY_MAP = Object.freeze({
    '客户名称': 'customer_name', '电话': 'contact', '联系方式': 'contact', '单据编号': 'document_no',
    '日期': 'date', '交货日期': 'delivery_date', '产品名称': 'product_name', '材料': 'material',
    '规格型号': 'specification', '规格': 'specification', '数量': 'quantity', '单价': 'unit_price',
    '总金额': 'total_amount', '金额': 'total_amount', '税率': 'tax_rate', '地址': 'address', '备注': 'notes'
  });
  const now = () => new Date().toISOString();
  const uid = () => `ocr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const clamp = value => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));
  const ocrError = (message, code = 'ocr_error', detail = {}) => Object.assign(new Error(message), { code, detail });

  function detectGarbled(value = '') {
    const text = String(value || '').trim();
    const reasons = [];
    if (!text) reasons.push('识别结果为空');
    if (/<(?:html|body|head|script|!doctype)\b/i.test(text)) reasons.push('返回内容疑似 HTML 错误页面');
    if (/^\s*[{[]/.test(text) && /"(?:error|message|code)"\s*:/.test(text)) reasons.push('JSON 错误内容被当成识别文字');
    const length = Math.max(1, text.length);
    const invalidRatio = (text.match(/[�□■◆◇●○]|[^\u0000-\u007f\u4e00-\u9fff，。；：、“”‘’（）《》【】￥%‰·—…\s]/g) || []).length / length;
    const chineseRatio = (text.match(/[\u4e00-\u9fff]/g) || []).length / length;
    const digitRatio = (text.match(/\d/g) || []).length / length;
    if (invalidRatio > 0.12) reasons.push('不可识别字符比例过高');
    if (/(.)\1{7,}/.test(text)) reasons.push('存在连续重复乱码字符');
    const chunks = text.split(/\n{2,}/).map(item => item.trim()).filter(Boolean);
    if (chunks.length > 2 && new Set(chunks).size <= Math.ceil(chunks.length / 3)) reasons.push('同一段内容连续重复');
    if (text.length >= 30 && chineseRatio < 0.02 && /[\u0080-\uffff]/.test(text)) reasons.push('中文图片结果几乎没有有效中文');
    if (text.length >= 30 && digitRatio > 0.82) reasons.push('数字比例异常过高');
    return { garbled: reasons.length > 0, reasons, metrics: { invalidRatio, chineseRatio, digitRatio, length: text.length } };
  }

  function parseNumber(value) {
    const text = String(value ?? '').replace(/[,，￥¥%\s]/g, '');
    return /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : NaN;
  }

  function validateField(definition, value) {
    const text = String(value ?? '').trim();
    const warnings = [];
    if (!text || text === '待补充' || text === '未识别') return warnings;
    if (['quantity', 'unit_price', 'total_amount', 'tax_rate'].includes(definition.key) && !Number.isFinite(parseNumber(text))) warnings.push('数字格式疑似异常');
    if (['date', 'delivery_date'].includes(definition.key) && Number.isNaN(Date.parse(text.replace(/[年月]/g, '-').replace(/日/g, '')))) warnings.push('日期格式疑似异常');
    return warnings;
  }

  function normalizeFields(inputFields = [], legacyFields = {}, overallConfidence = 0, options = {}) {
    const lowConfidenceThreshold = clamp(options.lowConfidenceThreshold ?? 0.85);
    const map = new Map();
    for (const field of Array.isArray(inputFields) ? inputFields : []) {
      const key = field.key || LEGACY_MAP[field.label] || field.field;
      if (key) map.set(key, field);
    }
    for (const [label, value] of Object.entries(legacyFields || {})) {
      const key = LEGACY_MAP[label] || label;
      if (!map.has(key)) map.set(key, { key, label, value, originalValue: value });
    }
    return FIELD_DEFINITIONS.map(definition => {
      const source = map.get(definition.key) || {};
      const value = String(source.value ?? '').trim();
      const confidence = clamp(source.confidence ?? overallConfidence);
      const warnings = validateField(definition, value);
      let status = !value || value === '待补充' || value === '未识别' ? 'missing'
        : warnings.length ? 'suspicious' : confidence < lowConfidenceThreshold ? 'low_confidence' : 'normal';
      if (source.manuallyEdited) status = 'manually_corrected';
      if (source.verified) status = 'verified';
      return { ...definition, value, originalValue: String(source.originalValue ?? value), confidence,
        sourceText: String(source.sourceText || source.value || ''), verified: Boolean(source.verified),
        manuallyEdited: Boolean(source.manuallyEdited), status, warnings: [...new Set([...(source.warnings || []), ...warnings])] };
    });
  }

  function consistencyWarnings(fields) {
    const values = Object.fromEntries(fields.map(field => [field.key, field.value]));
    const quantity = parseNumber(values.quantity), unitPrice = parseNumber(values.unit_price), total = parseNumber(values.total_amount);
    const warnings = [];
    if ([quantity, unitPrice, total].every(Number.isFinite)
      && Math.abs(quantity * unitPrice - total) > Math.max(0.01, Math.abs(total) * 0.01)) warnings.push('总金额与数量、单价计算不一致');
    const missing = fields.filter(field => field.required && field.status === 'missing').map(field => field.label);
    if (missing.length) warnings.push(`必填字段缺失：${missing.join('、')}`);
    return warnings;
  }

  function normalizeResult(raw = {}, context = {}, provider = {}) {
    const startedAt = raw.startedAt || context.startedAt || now();
    const finishedAt = raw.finishedAt || now();
    const rawText = String(raw.rawText ?? raw.text ?? raw.data?.text ?? '');
    const garbage = detectGarbled(rawText);
    const confidence = clamp(raw.confidence ?? raw.data?.confidence ?? (rawText ? 0.75 : 0));
    const fields = normalizeFields(raw.fields, raw.legacyFields || raw.structured?.fields || raw.fieldsByLabel || {}, confidence, context);
    const warnings = [...new Set([...(raw.warnings || []), ...garbage.reasons, ...consistencyWarnings(fields)])];
    const errors = [...(raw.errors || [])];
    if (!rawText && !errors.length) errors.push({ type: 'empty_result', message: 'OCR 未返回文字' });
    let status = RUN_STATUSES.has(raw.status) ? raw.status : errors.length ? 'failed' : warnings.length ? 'partial_success' : 'success';
    if (garbage.garbled && status === 'success') status = 'partial_success';
    return {
      schemaVersion: SCHEMA_VERSION, success: ['success', 'partial_success', 'fallback'].includes(status),
      requestId: raw.requestId || context.requestId || uid(), providerId: raw.providerId || provider.providerId || '',
      providerName: raw.providerName || provider.providerName || '', providerVersion: raw.providerVersion || provider.version || '',
      mode: raw.mode || context.mode || provider.providerType || '', documentType: raw.documentType || raw.structured?.template || context.documentType || '通用',
      rawText, rawResponse: String(raw.rawResponse || '').slice(0, 12000),
      paragraphs: raw.paragraphs || rawText.split(/\n{2,}/).map(text => text.trim()).filter(Boolean),
      blocks: Array.isArray(raw.blocks) ? raw.blocks : rawText.split('\n').map((text, index) => ({ id: index + 1, text, confidence })).filter(block => block.text.trim()),
      fields, confidence, warnings, errors, validationSuggestions: [...new Set([...(raw.validationSuggestions || []), ...warnings])],
      status, startedAt, finishedAt, durationMs: Math.max(0, Number(raw.durationMs) || Date.parse(finishedAt) - Date.parse(startedAt) || 0),
      fallbackUsed: Boolean(raw.fallbackUsed), fallbackProviderId: raw.fallbackProviderId || '',
      environment: { ...(context.environment || {}), ...(raw.environment || {}) }, sourceFile: { ...(context.sourceFile || {}), ...(raw.sourceFile || {}) }
    };
  }

  function normalizeLegacyResult(value = {}) {
    if (value?.schemaVersion >= SCHEMA_VERSION && Array.isArray(value.fields)) return normalizeResult(value, value, value);
    const raw = typeof value === 'string' ? { rawText: value } : { ...value,
      rawText: value.rawText ?? value.text ?? value.result ?? '',
      legacyFields: value.fields && !Array.isArray(value.fields) ? value.fields : value.confirmedFields?.fields || {},
      status: value.status === 'idle' ? 'waiting' : value.status };
    return normalizeResult(raw, { requestId: value.requestId, sourceFile: value.imageMeta || value.sourceFile || {} },
      { providerId: value.providerId || 'legacy', providerName: value.providerName || '旧版 OCR 数据', version: value.providerVersion || '1' });
  }

  function metadata(input = {}) {
    return { providerId: String(input.providerId || ''), providerName: String(input.providerName || ''), providerType: String(input.providerType || ''),
      version: String(input.version || '1.0'), enabled: input.enabled !== false, available: Boolean(input.available),
      availabilityReason: String(input.availabilityReason || ''), supportsLocal: Boolean(input.supportsLocal),
      supportsCloud: Boolean(input.supportsCloud), supportsTable: Boolean(input.supportsTable),
      supportsHandwriting: Boolean(input.supportsHandwriting), supportsChinese: input.supportsChinese !== false };
  }

  class ProviderRegistry {
    constructor(options = {}) { this.providers = new Map(); this.onError = options.onError || (() => {}); this.onLog = options.onLog || (() => {}); }
    register(provider) {
      const info = metadata(provider);
      if (!info.providerId || typeof provider.recognize !== 'function') throw ocrError('OCR Provider 定义无效', 'invalid_provider');
      const stored = { ...provider, ...info }; this.providers.set(info.providerId, stored); return stored;
    }
    get(id) { return this.providers.get(id) || null; }
    list() { return [...this.providers.values()].map(provider => ({ ...metadata(provider), capabilities: this.getCapabilities(provider.providerId) })); }
    getCapabilities(id) { const provider = this.get(id); return provider ? (provider.getCapabilities?.() || metadata(provider)) : null; }
    async healthCheck(id) {
      const provider = this.get(id); if (!provider) return { available: false, status: 'not_found', message: 'Provider 不存在' };
      return provider.healthCheck?.() || { available: provider.enabled && provider.available, status: provider.available ? 'ready' : 'unavailable', message: provider.availabilityReason };
    }
    async run({ providerId = 'auto', file, onProgress = () => {}, allowFallback = true, timeoutMs = 120000, context = {} } = {}) {
      const requestId = context.requestId || uid(), startedAt = now();
      const candidates = providerId === 'auto' ? [...this.providers.values()].filter(item => item.providerType === 'current' && item.enabled) : [this.get(providerId)].filter(Boolean);
      if (!candidates.length) throw ocrError('所选 OCR Provider 不存在', 'provider_unavailable', { providerId });
      let lastError = null;
      for (const provider of candidates) {
        if (!provider.available || !provider.enabled) {
          lastError = ocrError(provider.availabilityReason || '所选 OCR Provider 暂不可用', 'provider_unavailable', { providerId: provider.providerId });
          this.onError({ requestId, provider, error: lastError, file, startedAt, fallbackUsed: false });
          this.onLog({ requestId, action: 'recognize', providerId: provider.providerId, providerName: provider.providerName,
            fileName: file?.name || context.sourceFile?.name || '', status: 'failed', error: lastError.message,
            errorSummary: String(lastError.message || '').slice(0, 160) });
          continue;
        }
        try {
          this.onLog({ requestId, action: 'recognize', providerId: provider.providerId, providerName: provider.providerName,
            fileName: file?.name || context.sourceFile?.name || '', status: 'processing', startedAt });
          let timeoutHandle;
          const timeout = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => reject(ocrError('OCR 请求超时', 'request_timeout', { providerId: provider.providerId })), timeoutMs);
          });
          let raw;
          try {
            raw = await Promise.race([provider.recognize(file, onProgress, { ...context, requestId, startedAt }), timeout]);
          } finally {
            clearTimeout(timeoutHandle);
          }
          const result = normalizeResult(raw, { ...context, requestId, startedAt }, provider);
          if (!result.rawText.trim()) throw ocrError('OCR 未返回文字', 'empty_result', { providerId: provider.providerId, result });
          if (result.status === 'failed') throw ocrError(result.errors[0]?.message || 'OCR 识别失败', result.errors[0]?.type || 'invalid_response', { result });
          this.onLog({ requestId, action: 'recognize', providerId: provider.providerId, providerName: provider.providerName,
            fileName: file?.name || context.sourceFile?.name || '', status: result.status, durationMs: result.durationMs,
            fallbackUsed: result.fallbackUsed, resultSummary: result.rawText.slice(0, 120) }); return result;
        } catch (error) {
          lastError = error; this.onError({ requestId, provider, error, file, startedAt, fallbackUsed: false });
          this.onLog({ requestId, action: 'recognize', providerId: provider.providerId, providerName: provider.providerName,
            fileName: file?.name || context.sourceFile?.name || '', status: error.code === 'request_timeout' ? 'timeout' : 'failed',
            error: error.message, errorSummary: String(error.message || '').slice(0, 160) });
        }
      }
      const fallback = this.get('mock');
      if (allowFallback && providerId === 'auto' && fallback?.available && fallback.enabled) {
        try {
          const raw = await fallback.recognize(file, onProgress, { ...context, requestId, startedAt });
          const result = normalizeResult({ ...raw, status: 'fallback', fallbackUsed: true, fallbackProviderId: fallback.providerId }, { ...context, requestId, startedAt }, fallback);
          result.warnings.unshift(`真实识别不可用，已使用演示降级：${lastError?.message || '未知原因'}`);
          this.onLog({ requestId, action: 'fallback', providerId: fallback.providerId, providerName: fallback.providerName,
            fileName: file?.name || context.sourceFile?.name || '', status: 'fallback', fallbackUsed: true,
            durationMs: result.durationMs, error: lastError?.message || '', errorSummary: String(lastError?.message || '').slice(0, 160),
            resultSummary: result.rawText.slice(0, 120) }); return result;
        } catch (error) { this.onError({ requestId, provider: fallback, error, file, startedAt, fallbackUsed: true }); throw ocrError('OCR 降级失败', 'fallback_failed'); }
      }
      throw lastError || ocrError('OCR Provider 暂不可用', 'provider_unavailable', { providerId });
    }
  }

  function createPlaceholderProvider(providerId, providerName, providerType, extra = {}) {
    return { providerId, providerName, providerType, version: 'placeholder-1', enabled: true, available: false,
      availabilityReason: '未配置，暂不可用，需要后续接入', ...extra,
      async recognize() { throw ocrError('该 OCR Provider 未配置，暂不可用', 'provider_unavailable', { providerId }); },
      async healthCheck() { return { available: false, status: 'unconfigured', message: '未配置，暂不可用，需要后续接入' }; },
      normalizeResult(raw, context) { return normalizeResult(raw, context, this); }, getCapabilities() { return metadata(this); } };
  }

  function createCurrentProvider({ recognize, healthCheck, structure } = {}) {
    return { providerId: 'current', providerName: '当前 OCR', providerType: 'current', version: '1.0', enabled: true, available: true,
      supportsLocal: true, supportsTable: true, supportsChinese: true,
      async recognize(file, onProgress, context) { const text = await recognize(file, onProgress, context); const structured = structure?.(text); return { rawText: text, structured, confidence: Number(structured?.quality?.score || 75) / 100 }; },
      async healthCheck() { return healthCheck?.() || { available: true, status: 'ready' }; }, normalizeResult(raw, context) { return normalizeResult(raw, context, this); }, getCapabilities() { return metadata(this); } };
  }

  function createMockProvider() {
    const rawText = ['当前为演示数据，非真实 OCR 识别结果。', '单据编号：DEMO-2026-001', '客户名称：示例客户', '日期：2026-07-15', '产品名称：示例连接件', '材料：304不锈钢', '数量：100', '单价：20.00', '总金额：2000.00', '交期：2026-08-15', '备注：仅用于演示与测试'].join('\n');
    const values = { document_no: 'DEMO-2026-001', customer_name: '示例客户', date: '2026-07-15', product_name: '示例连接件',
      material: '304不锈钢', quantity: '100', unit_price: '20.00', total_amount: '2000.00', delivery_date: '2026-08-15', notes: '仅用于演示与测试' };
    return { providerId: 'mock', providerName: '演示模式', providerType: 'mock', version: '1.0', enabled: true, available: true,
      supportsLocal: true, supportsTable: true, supportsChinese: true,
      async recognize() { return { rawText, status: 'success', documentType: '报价单', confidence: 0.72,
        fields: FIELD_DEFINITIONS.map(definition => ({ ...definition, value: values[definition.key] || '', originalValue: values[definition.key] || '',
          sourceText: values[definition.key] ? `${definition.label}：${values[definition.key]}` : '', confidence: values[definition.key] ? 0.72 : 0 })),
        warnings: ['当前为演示数据，非真实 OCR 识别结果。'], mode: 'mock' }; },
      async healthCheck() { return { available: true, status: 'demo', message: '稳定演示 Provider，不处理真实图片内容' }; },
      normalizeResult(raw, context) { return normalizeResult(raw, context, this); }, getCapabilities() { return metadata(this); } };
  }

  function createReview(result, existing = {}) {
    const normalized = normalizeLegacyResult(result);
    return { schemaVersion: SCHEMA_VERSION, id: existing.id || `review-${normalized.requestId}`, requestId: normalized.requestId,
      status: REVIEW_STATUSES.has(existing.status) ? existing.status : 'pending',
      fields: normalizeFields(existing.fields || normalized.fields, {}, normalized.confidence),
      modifications: Array.isArray(existing.modifications) ? existing.modifications : [],
      createdAt: existing.createdAt || now(), updatedAt: existing.updatedAt || now(), reviewedAt: existing.reviewedAt || '',
      reviewer: existing.reviewer || '', rejectionReason: existing.rejectionReason || '',
      source: { providerId: normalized.providerId, documentType: normalized.documentType, sourceFile: normalized.sourceFile } };
  }

  function updateReviewField(review, key, value) {
    const current = createReview({ requestId: review.requestId, fields: review.fields }, review), field = current.fields.find(item => item.key === key);
    if (!field) throw ocrError('复核字段不存在', 'review_field_not_found', { key });
    const nextValue = String(value ?? '');
    if (field.value !== nextValue) current.modifications.push({ time: now(), field: key, label: field.label, originalValue: field.value, newValue: nextValue, operation: 'manual_edit', confirmed: false, reviewStatus: 'reviewing' });
    field.value = nextValue; field.manuallyEdited = field.originalValue !== nextValue; field.verified = false;
    field.status = field.manuallyEdited ? 'manually_corrected' : (!nextValue ? 'missing' : field.confidence < 0.85 ? 'low_confidence' : 'normal');
    current.status = 'reviewing'; current.updatedAt = now(); return current;
  }

  function approveReview(review, reviewer = '') {
    const current = createReview({ requestId: review.requestId, fields: review.fields }, review);
    current.status = 'approved'; current.reviewedAt = now(); current.updatedAt = current.reviewedAt; current.reviewer = reviewer;
    current.fields = current.fields.map(field => {
      const hasValue = Boolean(String(field.value || '').trim());
      return { ...field, verified: hasValue, status: hasValue ? 'verified' : 'missing' };
    });
    current.modifications = current.modifications.map(item => ({ ...item, confirmed: true, reviewStatus: 'approved' })); return current;
  }

  function rejectReview(review, reason = '', reviewer = '') {
    if (!String(reason).trim()) throw ocrError('驳回必须填写原因', 'review_reason_required');
    const current = createReview({ requestId: review.requestId, fields: review.fields }, review);
    current.status = 'rejected'; current.rejectionReason = String(reason).trim(); current.reviewer = reviewer; current.reviewedAt = now(); current.updatedAt = current.reviewedAt; return current;
  }

  function reviewSummary(review) {
    const current = createReview({ requestId: review.requestId, fields: review.fields }, review), approved = current.status === 'approved';
    return { lowConfidenceCount: current.fields.filter(field => String(field.value || '').trim() && field.confidence < 0.85).length,
      missingCount: current.fields.filter(field => !String(field.value || '').trim()).length,
      manuallyEditedCount: current.fields.filter(field => field.manuallyEdited).length,
      confirmedKeyFieldCount: current.fields.filter(field => field.keyField && field.verified && String(field.value || '').trim()).length,
      canTransferToQuotation: approved, canTransferToInquiry: approved };
  }

  function confirmedPayload(review, result) {
    if (!reviewSummary(review).canTransferToQuotation) throw ocrError('OCR 结果尚未人工确认，不能转入正式业务', 'review_not_approved');
    const confirmedFields = review.fields.filter(field => field.verified && String(field.value || '').trim());
    return { schemaVersion: SCHEMA_VERSION, fields: Object.fromEntries(confirmedFields.map(field => [field.key, field.value])),
      fieldDetails: confirmedFields.map(field => ({ key: field.key, label: field.label, value: field.value,
        originalValue: field.originalValue, confidence: field.confidence, sourceText: field.sourceText,
        status: field.status, warnings: [...(field.warnings || [])], manuallyEdited: Boolean(field.manuallyEdited), verified: true })),
      modifications: (review.modifications || []).map(item => ({ ...item })), warnings: [...(result?.warnings || [])],
      confidence: Number(result?.confidence || 0), fallbackUsed: Boolean(result?.fallbackUsed), mode: result?.mode || '',
      source: 'ocr', requestId: review.requestId, documentType: result?.documentType || review.source?.documentType || '', reviewedAt: review.reviewedAt,
      reviewer: review.reviewer || '', reviewStatus: review.status, providerId: result?.providerId || review.source?.providerId || '',
      providerName: result?.providerName || '', sourceFile: result?.sourceFile || review.source?.sourceFile || {} };
  }

  function sanitizeDiagnostics(input = {}) {
    const secrets = /(api[_-]?key|token|secret|authorization|password)/i;
    const privateContent = /(raw[_-]?(text|content|response)|ocr[_-]?text|customer[_-]?(data|content)|screenshot|image[_-]?content)/i;
    const redactString = value => String(value)
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
      .replace(/(?:sk|key|token)[-_a-z0-9]{8,}/gi, '[REDACTED]')
      .replace(/\b1[3-9]\d{9}\b/g, '[REDACTED_PHONE]')
      .replace(/\b\d{17}[0-9Xx]\b/g, '[REDACTED_ID]')
      .replace(/\b\d{16,19}\b/g, '[REDACTED_CARD]')
      .replace(/\/Users\/[^/\s]+(?:\/[^\s]*)?/g, '[REDACTED_LOCAL_PATH]')
      .replace(/[A-Za-z]:\\Users\\[^\s]+/g, '[REDACTED_LOCAL_PATH]');
    const redact = value => Array.isArray(value) ? value.map(redact) : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, secrets.test(key) ? '[REDACTED]'
        : privateContent.test(key) && typeof item === 'string' ? '[REDACTED_CONTENT]' : redact(item)]))
      : typeof value === 'string' ? redactString(value) : value;
    return redact(input);
  }

  return { SCHEMA_VERSION, FIELD_DEFINITIONS, KEY_FIELDS, ProviderRegistry, createPlaceholderProvider, createCurrentProvider,
    createMockProvider, normalizeResult, normalizeLegacyResult, normalizeFields, detectGarbled, createReview,
    updateReviewField, approveReview, rejectReview, reviewSummary, confirmedPayload, sanitizeDiagnostics, ocrError };
});
