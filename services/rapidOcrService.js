const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const env = require('../config/env');

const PROVIDER_ID = 'rapidocr-local';
const SUPPORTED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ADAPTER_PATH = path.join(__dirname, 'rapidocr_adapter.py');

function serviceError(message, code, status = 400, detail = {}) {
  return Object.assign(new Error(message), { code, status, detail });
}

function providerContract(readiness = 'DECLARED', failureReason = '') {
  return {
    providerId: PROVIDER_ID,
    providerName: 'RapidOCR 本地文档识别',
    providerType: 'local',
    engine: 'RapidOCR',
    runtime: 'Python / ONNX Runtime',
    placement: 'LOCAL_ONLY',
    supportedMimeTypes: [...SUPPORTED_MIME_TYPES],
    supportsLayout: true,
    supportsChinese: true,
    externalUpload: false,
    readiness,
    dependencies: ['configured Python runtime', 'rapidocr', 'onnxruntime', 'local OCR models', 'CPUExecutionProvider', 'adapter executable'],
    failureReason,
  };
}

function parseAdapterOutput(stdout, operation) {
  const text = String(stdout || '').trim();
  if (!text) throw serviceError(`${operation} 未返回结构化结果`, 'OCR_EXECUTION_FAILED', 502);
  try {
    return JSON.parse(text);
  } catch {
    throw serviceError(`${operation} 返回无法解析`, 'OCR_EXECUTION_FAILED', 502);
  }
}

function readiness() {
  const python = env.rapidOcrPythonPath;
  if (!python) return { ...providerContract('UNAVAILABLE', 'RAPIDOCR_PYTHON_PATH 未配置'), available: false };
  if (!path.isAbsolute(python) || !fs.existsSync(python)) {
    return { ...providerContract('BLOCKED', '已配置的 Python runtime 不存在'), available: false };
  }
  if (!fs.existsSync(ADAPTER_PATH)) return { ...providerContract('BLOCKED', 'RapidOCR adapter 不存在'), available: false };
  const check = spawnSync(python, [ADAPTER_PATH, '--preflight'], {
    cwd: os.tmpdir(),
    env: { ...process.env, PYTHONNOUSERSITE: '1' },
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  let evidence;
  try {
    evidence = parseAdapterOutput(check.stdout, 'RapidOCR readiness');
  } catch (error) {
    return { ...providerContract('BLOCKED', error.message), available: false, failureCode: error.code };
  }
  const ready = check.status === 0 && evidence.status === 'READY' && evidence.executionProvider === 'CPUExecutionProvider';
  return {
    ...providerContract(ready ? 'READY' : evidence.status === 'DEGRADED' ? 'DEGRADED' : 'BLOCKED', ready ? '' : evidence.failureReason || 'RapidOCR 依赖预检未通过'),
    available: ready,
    executionMetadata: evidence,
  };
}

function runAdapter(python, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(python, args, options);
    let stdout = '';
    let stderrBytes = 0;
    let settled = false;
    let timedOut = false;
    let forceKillTimer = null;
    const timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      child.kill('SIGTERM');
      forceKillTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
    }, env.rapidOcrTimeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderrBytes += chunk.length; });
    child.on('error', error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceKillTimer);
      reject(serviceError('RapidOCR adapter 无法启动', 'CAPABILITY_NOT_READY', 503, { errorType: error.name }));
    });
    child.on('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceKillTimer);
      if (timedOut) {
        reject(serviceError('RapidOCR 执行超时', 'OCR_EXECUTION_FAILED', 504, { subtype: 'TIMEOUT' }));
        return;
      }
      let payload;
      try { payload = parseAdapterOutput(stdout, 'RapidOCR adapter'); }
      catch (error) { reject(error); return; }
      if (code !== 0 || payload.status !== 'SUCCESS') {
        reject(serviceError('RapidOCR 未完成识别', 'OCR_EXECUTION_FAILED', 502, {
          errorType: payload.errorType || '', failureReason: payload.failureReason || '', stderrPresent: stderrBytes > 0,
        }));
        return;
      }
      resolve(payload);
    });
  });
}

async function recognize({ buffer, mimeType, inputHash, classification, placement }) {
  if (classification !== 'CONFIDENTIAL' || placement !== 'LOCAL_ONLY') {
    throw serviceError('RapidOCR 产品路径要求 CONFIDENTIAL + LOCAL_ONLY', 'PROVIDER_BLOCKED_BY_POLICY', 403);
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw serviceError('OCR 输入为空', 'INPUT_IDENTITY_BLOCKED', 400);
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) throw serviceError('OCR 图片格式不支持', 'INPUT_IDENTITY_BLOCKED', 415);
  if (buffer.length > 8 * 1024 * 1024) throw serviceError('OCR 图片超过 8MB 限制', 'INPUT_IDENTITY_BLOCKED', 413);
  const computedHash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (inputHash && inputHash !== computedHash) throw serviceError('OCR 输入 SHA-256 不匹配', 'INPUT_IDENTITY_BLOCKED', 409);

  const health = readiness();
  if (!health.available) throw serviceError('RapidOCR capability 未就绪', 'CAPABILITY_NOT_READY', 503, { readiness: health.readiness, failureReason: health.failureReason });

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ai-office-rapidocr-'));
  const extension = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
  const inputPath = path.join(tempDir, `input${extension}`);
  try {
    await fsp.writeFile(inputPath, buffer, { flag: 'wx', mode: 0o600 });
    const payload = await runAdapter(env.rapidOcrPythonPath, [ADAPTER_PATH, '--input', inputPath], {
      cwd: tempDir,
      env: { ...process.env, PYTHONNOUSERSITE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (payload.inputHash !== computedHash) throw serviceError('Adapter 输入身份回读不一致', 'RESULT_VERIFICATION_FAILED', 502);
    return {
      ...payload,
      inputHash: computedHash,
      inputMime: mimeType,
      classification,
      placement,
      executionStatus: 'SUCCESS',
      externalUpload: false,
    };
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

module.exports = { PROVIDER_ID, providerContract, readiness, recognize };
