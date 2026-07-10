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
    },
    {
      id: 'cost-quote',
      name: '新产品报价模板',
      category: '报价类',
      scenario: '客户发来产品需求后，业务员快速整理报价信息。',
      role: '老板、业务员、报价员、生产主管',
      description: '用于快速整理新产品报价所需信息，输出内部报价摘要与风险提示。',
      inputFields: ['productName', 'material', 'quantity', 'process', 'delivery', 'customerRequest'],
      maxWords: 180,
      promptTemplate: input => `请按固定格式整理新产品报价信息。\n\n产品名称：${field(input.productName)}\n材料：${field(input.material)}\n数量：${field(input.quantity)}\n工艺：${field(input.process)}\n交期：${field(input.delivery)}\n客户要求：${field(input.customerRequest)}\n\n输出格式：\n报价摘要：\n影响价格因素：\n交期说明：\n需要补充的信息：\n下一步建议：`,
      outputFormat: ['报价摘要', '影响价格因素', '交期说明', '需要补充的信息', '下一步建议'],
      example: '产品名称：304不锈钢连接件；材料：304不锈钢；数量：500；工艺：CNC + 数控车；交期：7天；客户要求：表面去毛刺',
      suggestion: '先确认图纸、数量、交期和材料，再给出正式报价。',
      mockOutput(input) {
        return [
          `报价摘要：${clamp(`${field(input.productName)} 报价需结合材料、数量与工艺确认。`, 70)}`,
          `影响价格因素：${clamp(`材料${field(input.material)}、数量${field(input.quantity)}、工艺${field(input.process)}。`, 80)}`,
          `交期说明：${clamp(`交期为${field(input.delivery)}，如加急需提前确认设备排产。`, 60)}`,
          `需要补充的信息：${clamp(`${field(input.customerRequest)}；请补充图纸与包装要求。`, 80)}`,
          `下一步建议：${clamp('先确认规格、图纸和交期，再输出正式报价单。', 60)}`
        ].join('\n');
      }
    },
    {
      id: 'inquiry-reply-template',
      name: '客户询价回复模板',
      category: '报价类',
      scenario: '客户留言或微信询价后，快速给出礼貌回复。',
      role: '业务员、客服、老板',
      description: '用于生成简洁礼貌的客户询价回复，方便直接发送。',
      inputFields: ['customerRequest', 'product', 'quantity', 'delivery', 'contact'],
      maxWords: 180,
      promptTemplate: input => `请生成客户询价回复。\n\n客户需求：${field(input.customerRequest)}\n产品：${field(input.product)}\n数量：${field(input.quantity)}\n交期：${field(input.delivery)}\n联系方式：${field(input.contact)}\n\n输出格式：\n回复内容：\n需要确认的问题：\n建议发送方式：`,
      outputFormat: ['回复内容', '需要确认的问题', '建议发送方式'],
      example: '客户需求：咨询 304 不锈钢连接件报价；产品：连接件；数量：500；交期：7天；联系方式：13800000000',
      suggestion: '语气要礼貌、简洁、可直接复制到微信或邮件。',
      mockOutput(input) {
        return [
          `回复内容：您好，关于${field(input.product)}的需求我们已收到，可按您的数量和交期进一步确认。`,
          `需要确认的问题：${clamp(`请确认数量${field(input.quantity)}、交期${field(input.delivery)}及图纸要求。`, 80)}`,
          `建议发送方式：微信或邮件回复更方便，必要时可附上联系方式 ${field(input.contact)}。`
        ].join('\n');
      }
    },
    {
      id: 'cost-note',
      name: '成本核算说明模板',
      category: '报价类',
      scenario: '给老板或客户说明报价依据和成本组成。',
      role: '老板、报价员、生产主管',
      description: '用于解释报价组成、利润率与风险提示。',
      inputFields: ['productName', 'material', 'quantity', 'process', 'profitRate', 'delivery'],
      maxWords: 180,
      promptTemplate: input => `请输出成本核算说明。\n\n产品名称：${field(input.productName)}\n材料：${field(input.material)}\n数量：${field(input.quantity)}\n工艺：${field(input.process)}\n目标利润率：${field(input.profitRate)}\n交期：${field(input.delivery)}\n\n输出格式：\n成本摘要：\n影响因素：\n风险提示：\n下一步建议：`,
      outputFormat: ['成本摘要', '影响因素', '风险提示', '下一步建议'],
      example: '产品名称：304不锈钢连接件；材料：304不锈钢；数量：500；工艺：CNC + 数控车；目标利润率：25%；交期：7天',
      suggestion: '只说明影响价格的因素，不直接编造固定价格。',
      mockOutput(input) {
        return [
          `成本摘要：${field(input.productName)} 的报价需结合材料、数量、工艺和交期确认。`,
          `影响因素：材料${field(input.material)}、数量${field(input.quantity)}、工艺${field(input.process)}、目标利润率${field(input.profitRate)}。`,
          `风险提示：若交期紧或图纸复杂，成本与风险会同步上升。`,
          `下一步建议：先确认规格、图纸和交期，再整理正式报价。`
        ].join('\n');
      }
    },
    {
      id: 'production-plan-breakdown',
      name: '生产计划拆解模板',
      category: '生产类',
      scenario: '把订单拆成当天可执行的生产计划。',
      role: '生产计划员、PMC、主管',
      description: '用于拆解订单、设备、工序和交期，形成执行计划。',
      inputFields: ['orderNo', 'productName', 'quantity', 'delivery', 'equipment', 'process'],
      maxWords: 180,
      promptTemplate: input => `请按固定格式拆解生产计划。\n\n订单号：${field(input.orderNo)}\n产品名称：${field(input.productName)}\n数量：${field(input.quantity)}\n交期：${field(input.delivery)}\n设备：${field(input.equipment)}\n工序：${field(input.process)}\n\n输出格式：\n计划摘要：\n拆解步骤：\n风险提示：\n下一步建议：`,
      outputFormat: ['计划摘要', '拆解步骤', '风险提示', '下一步建议'],
      example: '订单号：SO-20260707-001；产品名称：连接件；数量：500；交期：7天；设备：CNC；工序：下料、加工、检验',
      suggestion: '拆解时保留关键数字和日期，方便现场执行。',
      mockOutput(input) {
        return [
          `计划摘要：订单${field(input.orderNo)} 可拆解为加工、检验和发货三步。`,
          `拆解步骤：${clamp(`1. ${field(input.process)}；2. ${field(input.equipment)} 生产；3. ${field(input.delivery)} 前完成交付。`, 90)}`,
          `风险提示：${clamp('如设备冲突或物料未齐，交期可能受影响。', 60)}`,
          `下一步建议：先确认设备排产与物料准备情况。`
        ].join('\n');
      }
    },
    {
      id: 'daily-report',
      name: '今日生产日报模板',
      category: '生产类',
      scenario: '班组长或生产主管快速汇总当天生产情况。',
      role: '生产主管、班组长、PMC',
      description: '用于生成简洁生产日报，方便汇报当天完成情况。',
      inputFields: ['date', 'completed', 'delayed', 'qualityIssues', 'nextPlan'],
      maxWords: 180,
      promptTemplate: input => `请按固定格式生成今日生产日报。\n\n日期：${field(input.date)}\n已完成：${field(input.completed)}\n延期：${field(input.delayed)}\n质量问题：${field(input.qualityIssues)}\n明日计划：${field(input.nextPlan)}\n\n输出格式：\n日报摘要：\n完成情况：\n异常情况：\n明日计划：`,
      outputFormat: ['日报摘要', '完成情况', '异常情况', '明日计划'],
      example: '日期：2026-07-07；已完成：2 单；延期：1 单；质量问题：毛刺；明日计划：继续加工剩余订单',
      suggestion: '保持数据简洁，适合发群或发老板。',
      mockOutput(input) {
        return [
          `日报摘要：${field(input.date)} 的生产情况已汇总。`,
          `完成情况：${field(input.completed)}。`,
          `异常情况：${field(input.delayed)}；${field(input.qualityIssues)}。`,
          `明日计划：${field(input.nextPlan)}。`
        ].join('\n');
      }
    },
    {
      id: 'order-followup',
      name: '订单进度跟进模板',
      category: '生产类',
      scenario: '跟踪客户订单进度并及时同步状态。',
      role: '业务员、PMC、客服',
      description: '用于跟进订单状态、交期和异常，方便对客户同步。',
      inputFields: ['orderNo', 'customerName', 'status', 'delivery', 'issue'],
      maxWords: 160,
      promptTemplate: input => `请按固定格式生成订单进度跟进内容。\n\n订单号：${field(input.orderNo)}\n客户名称：${field(input.customerName)}\n当前状态：${field(input.status)}\n交期：${field(input.delivery)}\n问题：${field(input.issue)}\n\n输出格式：\n跟进摘要：\n当前状态：\n风险提示：\n下一步建议：`,
      outputFormat: ['跟进摘要', '当前状态', '风险提示', '下一步建议'],
      example: '订单号：SO-01；客户名称：新能源客户；当前状态：加工中；交期：7天；问题：待确认包装',
      suggestion: '面向客户时语气要及时、清楚、不过度承诺。',
      mockOutput(input) {
        return [
          `跟进摘要：订单${field(input.orderNo)} 当前进度已更新。`,
          `当前状态：${field(input.status)}，客户${field(input.customerName)} 可继续同步。`,
          `风险提示：${field(input.issue)}。`,
          `下一步建议：在${field(input.delivery)} 前完成并回传进度。`
        ].join('\n');
      }
    },
    {
      id: 'quality-issue',
      name: '质量异常记录模板',
      category: '质量类',
      scenario: '发现质量问题后快速记录并整理。',
      role: '质检员、生产主管、老板',
      description: '用于记录异常、初步原因和处理动作。',
      inputFields: ['productName', 'issue', 'quantity', 'cause', 'action'],
      maxWords: 180,
      promptTemplate: input => `请按固定格式生成质量异常记录。\n\n产品名称：${field(input.productName)}\n异常现象：${field(input.issue)}\n数量：${field(input.quantity)}\n初步原因：${field(input.cause)}\n处理动作：${field(input.action)}\n\n输出格式：\n异常摘要：\n初步原因：\n影响范围：\n处理建议：`,
      outputFormat: ['异常摘要', '初步原因', '影响范围', '处理建议'],
      example: '产品名称：连接件；异常现象：毛刺偏大；数量：20；初步原因：刀具磨损；处理动作：返工去毛刺',
      suggestion: '先记录事实，再写原因判断，避免提前定性。',
      mockOutput(input) {
        return [
          `异常摘要：${field(input.productName)} 出现 ${field(input.issue)}。`,
          `初步原因：${field(input.cause)}。`,
          `影响范围：${field(input.quantity)} 件相关产品。`,
          `处理建议：${field(input.action)}，并跟踪复检结果。`
        ].join('\n');
      }
    },
    {
      id: 'rework-analysis',
      name: '返工原因分析模板',
      category: '质量类',
      scenario: '对返工原因做简短分析并形成说明。',
      role: '质检员、生产主管、老板',
      description: '用于返工场景的简短原因分析和改进建议。',
      inputFields: ['productName', 'issue', 'cause', 'improvement'],
      maxWords: 180,
      promptTemplate: input => `请按固定格式生成返工原因分析。\n\n产品名称：${field(input.productName)}\n返工现象：${field(input.issue)}\n原因：${field(input.cause)}\n改进措施：${field(input.improvement)}\n\n输出格式：\n原因摘要：\n主要问题：\n改进建议：\n后续跟踪：`,
      outputFormat: ['原因摘要', '主要问题', '改进建议', '后续跟踪'],
      example: '产品名称：连接件；返工现象：尺寸偏差；原因：程序误差；改进措施：复核程序',
      suggestion: '保持结论客观，避免扩大问题。',
      mockOutput(input) {
        return [
          `原因摘要：${field(input.productName)} 的返工与 ${field(input.cause)} 有关。`,
          `主要问题：${field(input.issue)}。`,
          `改进建议：${field(input.improvement)}。`,
          `后续跟踪：复检同批次产品，确认是否再次出现。`
        ].join('\n');
      }
    },
    {
      id: 'device-repair',
      name: '设备维修记录模板',
      category: '设备类',
      scenario: '设备维修后快速记录维修内容。',
      role: '机修工、设备管理员、主管',
      description: '用于记录设备故障、维修过程和恢复状态。',
      inputFields: ['deviceName', 'fault', 'repair', 'downtime'],
      maxWords: 160,
      promptTemplate: input => `请按固定格式生成设备维修记录。\n\n设备名称：${field(input.deviceName)}\n故障现象：${field(input.fault)}\n维修内容：${field(input.repair)}\n停机时间：${field(input.downtime)}\n\n输出格式：\n维修摘要：\n故障原因：\n处理结果：\n后续建议：`,
      outputFormat: ['维修摘要', '故障原因', '处理结果', '后续建议'],
      example: '设备名称：CNC加工中心；故障现象：主轴报警；维修内容：更换传感器；停机时间：2小时',
      suggestion: '记录时保留停机时长和恢复状态。',
      mockOutput(input) {
        return [
          `维修摘要：${field(input.deviceName)} 已完成维修。`,
          `故障原因：${field(input.fault)}。`,
          `处理结果：${field(input.repair)}。`,
          `后续建议：${field(input.downtime)} 内关注运行状态。`
        ].join('\n');
      }
    },
    {
      id: 'device-check',
      name: '设备点检模板',
      category: '设备类',
      scenario: '每日点检记录和异常说明。',
      role: '设备管理员、机修工、班组长',
      description: '用于记录点检项目、结果和异常。',
      inputFields: ['deviceName', 'checkItem', 'result', 'exception'],
      maxWords: 160,
      promptTemplate: input => `请按固定格式生成设备点检记录。\n\n设备名称：${field(input.deviceName)}\n点检项目：${field(input.checkItem)}\n点检结果：${field(input.result)}\n异常：${field(input.exception)}\n\n输出格式：\n点检摘要：\n检查结果：\n异常说明：\n后续处理：`,
      outputFormat: ['点检摘要', '检查结果', '异常说明', '后续处理'],
      example: '设备名称：数控车床；点检项目：润滑；点检结果：正常；异常：无',
      suggestion: '点检结果要简短明确，方便班组留档。',
      mockOutput(input) {
        return [
          `点检摘要：${field(input.deviceName)} 点检已完成。`,
          `检查结果：${field(input.checkItem)}，结果 ${field(input.result)}。`,
          `异常说明：${field(input.exception)}。`,
          `后续处理：如有异常请及时报修并复检。`
        ].join('\n');
      }
    },
    {
      id: 'customer-followup',
      name: '客户跟进记录模板',
      category: '客户类',
      scenario: '记录客户沟通要点和后续动作。',
      role: '业务员、客服、老板',
      description: '用于跟进客户、记录沟通结果和下一步。',
      inputFields: ['customerName', 'contact', 'subject', 'nextStep'],
      maxWords: 160,
      promptTemplate: input => `请按固定格式生成客户跟进记录。\n\n客户名称：${field(input.customerName)}\n联系人：${field(input.contact)}\n沟通主题：${field(input.subject)}\n下一步：${field(input.nextStep)}\n\n输出格式：\n跟进摘要：\n沟通要点：\n下一步建议：\n联系方式备注：`,
      outputFormat: ['跟进摘要', '沟通要点', '下一步建议', '联系方式备注'],
      example: '客户名称：新能源设备客户；联系人：张工；沟通主题：报价跟进；下一步：发送正式报价单',
      suggestion: '跟进内容要聚焦下一步动作。',
      mockOutput(input) {
        return [
          `跟进摘要：已与${field(input.customerName)} 完成沟通。`,
          `沟通要点：${field(input.subject)}。`,
          `下一步建议：${field(input.nextStep)}。`,
          `联系方式备注：${field(input.contact)}。`
        ].join('\n');
      }
    },
    {
      id: 'cnc-recruit',
      name: 'CNC 操作工招聘模板',
      category: '招聘类',
      scenario: '发布 CNC 操作工招聘信息。',
      role: '老板、HR、行政',
      description: '用于快速生成 CNC 操作工招聘文案。',
      inputFields: ['companyName', 'location', 'salary', 'requirements'],
      maxWords: 180,
      promptTemplate: input => `请按固定格式生成 CNC 操作工招聘模板。\n\n公司名称：${field(input.companyName)}\n工作地点：${field(input.location)}\n薪资：${field(input.salary)}\n要求：${field(input.requirements)}\n\n输出格式：\n岗位简介：\n岗位要求：\n薪资福利：\n联系方式建议：`,
      outputFormat: ['岗位简介', '岗位要求', '薪资福利', '联系方式建议'],
      example: '公司名称：某机械厂；工作地点：常州；薪资：6000-9000；要求：会看图纸，熟悉 CNC',
      suggestion: '文案要简洁、真实，不夸大待遇。',
      mockOutput(input) {
        return [
          `岗位简介：${field(input.companyName)} 招聘 CNC 操作工，工作地点 ${field(input.location)}。`,
          `岗位要求：${field(input.requirements)}。`,
          `薪资福利：${field(input.salary)}。`,
          `联系方式建议：建议在招聘平台或微信中说明岗位职责与到岗时间。`
        ].join('\n');
      }
    },
    {
      id: 'mounter-recruit',
      name: '机修工招聘模板',
      category: '招聘类',
      scenario: '发布机修工招聘信息。',
      role: '老板、HR、行政',
      description: '用于生成机修工招聘文案。',
      inputFields: ['companyName', 'location', 'salary', 'requirements'],
      maxWords: 180,
      promptTemplate: input => `请按固定格式生成机修工招聘模板。\n\n公司名称：${field(input.companyName)}\n工作地点：${field(input.location)}\n薪资：${field(input.salary)}\n要求：${field(input.requirements)}\n\n输出格式：\n岗位简介：\n岗位要求：\n薪资福利：\n联系方式建议：`,
      outputFormat: ['岗位简介', '岗位要求', '薪资福利', '联系方式建议'],
      example: '公司名称：某工厂；工作地点：常州；薪资：7000-10000；要求：会设备维修，有机修经验',
      suggestion: '突出设备经验和响应速度，避免空泛表述。',
      mockOutput(input) {
        return [
          `岗位简介：${field(input.companyName)} 招聘机修工，工作地点 ${field(input.location)}。`,
          `岗位要求：${field(input.requirements)}。`,
          `薪资福利：${field(input.salary)}。`,
          `联系方式建议：注明设备维修经验和上岗时间。`
        ].join('\n');
      }
    },
    {
      id: 'customer-complaint-reply',
      name: '客户投诉回复模板',
      category: '质量类',
      scenario: '客户投诉后快速给出回复口径。',
      role: '客服、业务员、老板',
      description: '用于客户投诉场景的安抚回复与处理建议。',
      inputFields: ['customerName', 'problem', 'response', 'nextStep'],
      maxWords: 180,
      promptTemplate: input => `请按固定格式生成客户投诉回复。\n\n客户名称：${field(input.customerName)}\n投诉问题：${field(input.problem)}\n当前回复：${field(input.response)}\n下一步：${field(input.nextStep)}\n\n输出格式：\n回复内容：\n需要确认的问题：\n处理建议：\n跟进方式：`,
      outputFormat: ['回复内容', '需要确认的问题', '处理建议', '跟进方式'],
      example: '客户名称：新能源客户；投诉问题：交期延迟；当前回复：正在协调；下一步：确认补发时间',
      suggestion: '先安抚，再说明处理计划，最后给出跟进方式。',
      mockOutput(input) {
        return [
          `回复内容：您好，关于${field(input.problem)} 我们已经收到并在处理。`,
          `需要确认的问题：${field(input.customerName)} 的具体诉求和期望交期。`,
          `处理建议：${field(input.response)}，并在${field(input.nextStep)} 前反馈结果。`,
          `跟进方式：建议邮件或微信同步处理进度。`
        ].join('\n');
      }
    },
    {
      id: 'old-customer-followup',
      name: '老客户回访模板',
      category: '客户类',
      scenario: '回访老客户并记录新需求。',
      role: '业务员、客服、老板',
      description: '用于回访老客户时整理新需求和后续动作。',
      inputFields: ['customerName', 'contact', 'recentNeed', 'nextStep'],
      maxWords: 160,
      promptTemplate: input => `请按固定格式生成老客户回访模板。\n\n客户名称：${field(input.customerName)}\n联系人：${field(input.contact)}\n近期需求：${field(input.recentNeed)}\n下一步：${field(input.nextStep)}\n\n输出格式：\n回访摘要：\n近期需求：\n下一步建议：\n备注：`,
      outputFormat: ['回访摘要', '近期需求', '下一步建议', '备注'],
      example: '客户名称：老客户A；联系人：李工；近期需求：追加订单；下一步：发送样品',
      suggestion: '突出复购机会和客户关系维护。',
      mockOutput(input) {
        return [
          `回访摘要：已完成对${field(input.customerName)} 的回访。`,
          `近期需求：${field(input.recentNeed)}。`,
          `下一步建议：${field(input.nextStep)}。`,
          `备注：${field(input.contact)}。`
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
