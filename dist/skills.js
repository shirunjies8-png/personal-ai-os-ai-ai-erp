(function (global) {
  const clamp = (text, max = 200) => {
    const value = String(text || '').trim();
    if (!value) return '';
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  };

  const field = (value) => {
    const text = String(value || '').trim();
    return text ? text : '待补充';
  };

  const skillDefs = [
    {
      id: 'enterprise-intro',
      name: '企业介绍生成',
      description: '根据企业名称、主营产品、设备能力、服务行业、优势和联系方式生成简洁企业简介。',
      inputFields: ['enterpriseName', 'products', 'equipment', 'industry', 'strengths', 'contact'],
      maxWords: 200,
      promptTemplate: input => `请按固定格式生成企业介绍，不要输出思考过程，不要夸大，不超过 200 字。\n\n输入：\n企业名称：${field(input.enterpriseName)}\n主营产品：${field(input.products)}\n设备能力：${field(input.equipment)}\n服务行业：${field(input.industry)}\n优势：${field(input.strengths)}\n联系方式：${field(input.contact)}\n\n输出格式：\n企业简介：\n核心能力：\n适合客户：\n联系建议：`,
      outputFormat: ['企业简介', '核心能力', '适合客户', '联系建议'],
      mockOutput(input) {
        const enterpriseName = field(input.enterpriseName);
        const products = field(input.products);
        const equipment = field(input.equipment);
        const industry = field(input.industry);
        const strengths = field(input.strengths);
        const contact = field(input.contact);
        const intro = clamp(`${enterpriseName}，专注${products}，面向${industry}等场景，提供稳定加工与配套支持。`, 70);
        const core = clamp(`核心能力：${equipment}；优势：${strengths}。`, 70);
        const customers = clamp(`适合客户：需要${products}的采购客户、项目方和长期合作客户。`, 60);
        const contactAdvice = clamp(`联系建议：如需对接，请联系${contact}，先确认图纸、数量和交期。`, 60);
        return [
          `企业简介：${intro}`,
          `核心能力：${core.replace(/^核心能力：/, '')}`,
          `适合客户：${customers.replace(/^适合客户：/, '')}`,
          `联系建议：${contactAdvice.replace(/^联系建议：/, '')}`
        ].join('\n');
      }
    },
    {
      id: 'product-intro',
      name: '产品介绍生成',
      description: '根据产品名称、材料、工艺、用途、行业与优势生成产品简介。',
      inputFields: ['productName', 'material', 'process', 'usage', 'industry', 'strengths'],
      maxWords: 180,
      promptTemplate: input => `请按固定格式输出产品介绍，不要输出思考过程，不要夸大，不超过 180 字。\n\n产品名称：${field(input.productName)}\n材料：${field(input.material)}\n工艺：${field(input.process)}\n用途：${field(input.usage)}\n适合行业：${field(input.industry)}\n优势：${field(input.strengths)}\n\n输出格式：\n产品简介：\n加工能力：\n适合客户：\n采购建议：`,
      outputFormat: ['产品简介', '加工能力', '适合客户', '采购建议'],
      mockOutput(input) {
        const productName = field(input.productName);
        const material = field(input.material);
        const process = field(input.process);
        const usage = field(input.usage);
        const industry = field(input.industry);
        const strengths = field(input.strengths);
        return [
          `产品简介：${clamp(`${productName}，采用${material}并通过${process}加工，主要用于${usage}。`, 70)}`,
          `加工能力：${clamp(`支持${process}等工艺，可按图纸和样件确认。`, 60)}`,
          `适合客户：${clamp(`适合${industry}相关采购客户及项目配套客户。`, 60)}`,
          `采购建议：${clamp(`如需采购，请先确认规格、数量、交期与包装要求；优势：${strengths || '待补充'}。`, 70)}`
        ].join('\n');
      }
    },
    {
      id: 'quote-summary',
      name: '报价说明生成',
      description: '根据产品、材料、数量、工艺、交期与特殊要求生成报价说明。',
      inputFields: ['productName', 'material', 'quantity', 'process', 'delivery', 'requirements'],
      maxWords: 180,
      promptTemplate: input => `请按固定格式输出报价说明，不要直接编造价格，只说明影响报价的因素。\n\n产品名称：${field(input.productName)}\n材料：${field(input.material)}\n数量：${field(input.quantity)}\n工艺：${field(input.process)}\n交期：${field(input.delivery)}\n特殊要求：${field(input.requirements)}\n\n输出格式：\n报价摘要：\n影响价格因素：\n交期说明：\n需要补充的信息：\n下一步建议：`,
      outputFormat: ['报价摘要', '影响价格因素', '交期说明', '需要补充的信息', '下一步建议'],
      mockOutput(input) {
        return [
          `报价摘要：${clamp(`${field(input.productName)} 的报价需要结合材料、工艺和数量确认。`, 70)}`,
          `影响价格因素：${clamp(`材料：${field(input.material)}；数量：${field(input.quantity)}；工艺：${field(input.process)}。`, 80)}`,
          `交期说明：${clamp(`交期为${field(input.delivery)}，若有加急或特殊要求需提前确认。`, 60)}`,
          `需要补充的信息：${clamp(`${field(input.requirements)}；如有图纸、样件或包装要求请一并提供。`, 80)}`,
          `下一步建议：${clamp('先确认规格、数量、图纸和交期，再安排正式报价。', 60)}`
        ].join('\n');
      }
    },
    {
      id: 'inquiry-reply',
      name: '客户询盘回复',
      description: '根据客户需求生成礼貌的询盘回复。',
      inputFields: ['customerRequest', 'product', 'quantity', 'material', 'delivery', 'contact'],
      maxWords: 180,
      promptTemplate: input => `请生成客户询盘回复，语气礼貌，适合微信、邮件、网站留言。不要输出思考过程。\n\n客户需求：${field(input.customerRequest)}\n产品：${field(input.product)}\n数量：${field(input.quantity)}\n材料：${field(input.material)}\n交期：${field(input.delivery)}\n联系方式：${field(input.contact)}\n\n输出格式：\n回复内容：\n需要确认的问题：\n建议发送方式：`,
      outputFormat: ['回复内容', '需要确认的问题', '建议发送方式'],
      mockOutput(input) {
        return [
          `回复内容：您好，关于${field(input.product)}的需求我们已收到，可按您的数量和交期进一步确认。`,
          `需要确认的问题：${clamp(`请确认${field(input.material)}、数量${field(input.quantity)}、交期${field(input.delivery)}及图纸要求。`, 80)}`,
          `建议发送方式：微信或邮件回复更方便，必要时可附上联系方式 ${field(input.contact)}。`
        ].join('\n');
      }
    },
    {
      id: 'ocr-summary',
      name: 'OCR 识别结果总结',
      description: '根据 OCR 原文提取摘要、关键信息、可能问题和下一步建议。',
      inputFields: ['ocrText', 'fileType', 'userGoal'],
      maxWords: 180,
      promptTemplate: input => `请总结以下 OCR 识别结果，不要补充不存在的信息，识别不清楚写“待确认”或“疑似”。\n\n文件类型：${field(input.fileType)}\n用户目标：${field(input.userGoal)}\nOCR原文：\n${field(input.ocrText)}\n\n输出格式：\n内容摘要：\n关键信息：\n可能问题：\n下一步建议：`,
      outputFormat: ['内容摘要', '关键信息', '可能问题', '下一步建议'],
      mockOutput(input) {
        return [
          `内容摘要：${clamp(`文件类型为${field(input.fileType)}，OCR 结果已整理。`, 60)}`,
          `关键信息：${clamp(`${field(input.userGoal)}；OCR 原文已接收，关键字段请继续确认。`, 80)}`,
          `可能问题：${clamp('部分字符可能存在疑似识别偏差，建议人工核对。', 60)}`,
          `下一步建议：${clamp('若用于发货、报价或归档，请先核对数量、日期和单号。', 60)}`
        ].join('\n');
      }
    },
    {
      id: 'error-summary',
      name: '错误中心总结',
      description: '根据错误记录生成问题摘要、可能原因、影响范围和处理建议。',
      inputFields: ['errorLog', 'moduleName', 'count', 'recentTime'],
      maxWords: 160,
      promptTemplate: input => `请只做诊断总结，不夸大严重性，不输出思考过程。\n\n模块名称：${field(input.moduleName)}\n出现次数：${field(input.count)}\n最近时间：${field(input.recentTime)}\n错误记录：${field(input.errorLog)}\n\n输出格式：\n问题摘要：\n可能原因：\n影响范围：\n处理建议：`,
      outputFormat: ['问题摘要', '可能原因', '影响范围', '处理建议'],
      mockOutput(input) {
        return [
          `问题摘要：${clamp(`${field(input.moduleName)} 出现 ${field(input.count)} 次异常记录。`, 60)}`,
          `可能原因：${clamp('可能与配置、数据输入或前端交互有关。', 60)}`,
          `影响范围：${clamp('仅影响当前模块或相关页面，不代表系统整体故障。', 60)}`,
          `处理建议：${clamp(`请查看 ${field(input.recentTime)} 附近的日志并逐项核对。`, 60)}`
        ].join('\n');
      }
    }
  ];

  const skillMap = Object.fromEntries(skillDefs.map(item => [item.id, item]));

  const AISkills = {
    list: () => skillDefs.slice(),
    get(id) {
      return skillMap[id] || null;
    },
    buildPrompt(skillId, input = {}) {
      const skill = skillMap[skillId];
      if (!skill) return null;
      const prompt = typeof skill.promptTemplate === 'function' ? skill.promptTemplate(input) : String(skill.promptTemplate || '');
      return {
        skillId: skill.id,
        skillName: skill.name,
        system: `你是${skill.name}。${skill.description}。请严格按指定输出格式回答，缺少信息写“待补充”，不要输出思考过程，不要编造，不要夸大，控制在 ${skill.maxWords} 字以内。`,
        user: prompt,
        outputFormat: skill.outputFormat,
        maxWords: skill.maxWords,
        input
      };
    },
    mockOutput(skillId, input = {}) {
      const skill = skillMap[skillId];
      if (!skill) return '';
      return skill.mockOutput ? skill.mockOutput(input) : '';
    },
    normalize(input) {
      if (!input || typeof input !== 'object') return {};
      return { ...input };
    }
  };

  global.AISkills = AISkills;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AISkills;
  }
})(typeof window !== 'undefined' ? window : globalThis);
