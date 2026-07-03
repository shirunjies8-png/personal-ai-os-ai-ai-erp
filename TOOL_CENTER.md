# Tool Center V1

## 当前已接入工具

- `excel_tool`
- `csv_tool`
- `pdf_tool`
- `ocr_tool`
- `sqlite_query_tool`
- `file_generate_tool`
- `web_api_tool`
- `human_approval_tool`

## 统一能力

每个工具当前都具备：

- `toolName`
- `description`
- `inputSchema`
- `required`
- 类型校验
- 边界校验
- 权限级别
- `timeoutMs`
- `retryPolicy`
- `execute`
- 统一返回结构

## 统一返回结构

```json
{
  "ok": true,
  "data": {},
  "error": "",
  "requestId": "tool-xxxx",
  "toolName": "excel_tool",
  "durationMs": 120,
  "status": "success",
  "retryCount": 0
}
```

## 权限层

- `viewer`：只能执行只读或低风险工具
- `operator`：可执行普通业务工具
- `admin`：可执行高风险工具

## 高风险动作

以下工具或场景会触发审批或高风险限制：

- `file_generate_tool`
- `web_api_tool`
- `human_approval_tool`
- 后续扩展的写文件 / 外部接口 / 批量处理类工具

## 已验证能力

- `csv_tool`：真实执行通过
- `csv_tool` 参数错误：返回中文 `参数缺失：text`
- `file_generate_tool`：在 `viewer` 权限下会被拒绝
- 高风险任务可通过审批链路继续执行
- 工具调用结果可进入 Agent Runtime 最终汇总

## 当前限制

- `file_generate_tool` 当前为高风险生成预演，不直接落真实文件
- `web_api_tool` 当前只允许 GET
- `sqlite_query_tool` 仅允许白名单只读查询
- 未接入企业生产 Connector 数据前，不会冒充真实 ERP/MES/PLC 能力
