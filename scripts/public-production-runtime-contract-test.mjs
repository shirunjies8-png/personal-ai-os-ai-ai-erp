import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

process.env.AI_OFFICE_SKIP_ENV_FILES = '1';
const require = createRequire(import.meta.url);
const deployment = require('../services/deploymentReadinessService');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'realityos-production-runtime-'));
const persistentRoot = path.join(root, 'persistent');
const valveRoot = path.join(persistentRoot, 'valve', 'private');
const sourcePath = path.join(valveRoot, 'reference-template.docx');
fs.mkdirSync(valveRoot, { recursive: true });
fs.writeFileSync(sourcePath, 'controlled non-business source fixture');
const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');

const keys = [
  'NODE_ENV', 'JWT_SECRET', 'DEFAULT_ADMIN_PASSWORD', 'DEFAULT_ADMIN_EMAIL',
  'DEFAULT_ENTERPRISE_NAME', 'PERSISTENT_DATA_ROOT', 'DB_PATH', 'CORS_ALLOWED_ORIGINS',
];
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));

function restoreEnvironment() {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function configureSecureProduction() {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'j'.repeat(48);
  process.env.DEFAULT_ADMIN_PASSWORD = 'SecureBootstrapPassword-2026!';
  process.env.DEFAULT_ADMIN_EMAIL = 'operator@example.test';
  process.env.DEFAULT_ENTERPRISE_NAME = 'Example Industrial Enterprise';
  process.env.PERSISTENT_DATA_ROOT = persistentRoot;
  process.env.DB_PATH = path.join(persistentRoot, 'realityos.sqlite3');
  process.env.CORS_ALLOWED_ORIGINS = 'https://shirunjies8-png.github.io';
}

function evaluateFrontendConfig({ hostname, origin, apiBase = '', publicReal = false }) {
  const source = fs.readFileSync(path.join(process.cwd(), 'config.js'), 'utf8');
  const localStorage = { getItem() { return ''; } };
  const window = {
    location: { hostname, origin, protocol: origin.startsWith('https:') ? 'https:' : 'http:' },
    localStorage,
    PERSONAL_AI_OS_API_BASE_URL: apiBase,
    PERSONAL_AI_OS_PUBLIC_REAL_MODE: publicReal,
  };
  vm.runInNewContext(source, { window }, { filename: 'config.js' });
  return window.PERSONAL_AI_OS_CONFIG;
}

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...collectFiles(candidate));
    else output.push(candidate);
  }
  return output;
}

try {
  configureSecureProduction();
  delete process.env.JWT_SECRET;
  assert.throws(
    () => deployment.validateProductionEnvironment({ nodeEnv: 'production', dbPath: process.env.DB_PATH }),
    error => error.code === 'PRODUCTION_STARTUP_CONFIG_INVALID' && error.errors.includes('JWT_SECRET_PRODUCTION_UNSAFE'),
  );

  configureSecureProduction();
  delete process.env.DEFAULT_ADMIN_PASSWORD;
  assert.throws(
    () => deployment.validateProductionEnvironment({ nodeEnv: 'production', dbPath: process.env.DB_PATH }),
    error => error.code === 'PRODUCTION_STARTUP_CONFIG_INVALID' && error.errors.includes('DEFAULT_ADMIN_PASSWORD_PRODUCTION_UNSAFE'),
  );

  configureSecureProduction();
  assert.equal(deployment.validateProductionEnvironment({ nodeEnv: 'production', dbPath: process.env.DB_PATH }).ok, true);

  process.env.DB_PATH = path.join(root, 'ephemeral', 'realityos.sqlite3');
  fs.mkdirSync(path.dirname(process.env.DB_PATH), { recursive: true });
  assert.throws(
    () => deployment.validateProductionEnvironment({ nodeEnv: 'production', dbPath: process.env.DB_PATH }),
    error => error.errors.includes('DB_PATH_OUTSIDE_PERSISTENT_ROOT'),
  );

  const valveEnv = {
    nodeEnv: 'production',
    persistentDataRoot: persistentRoot,
    valveReferencePrivateRoot: valveRoot,
    valveReferenceDocxPath: sourcePath,
    valveReferenceDocxSha256: sourceHash,
    valveReferenceEnterpriseId: 'enterprise-placeholder',
  };
  assert.equal(deployment.valveProductionReadiness(valveEnv).ready, true);
  assert.ok(deployment.valveProductionReadiness(valveEnv, { privateRoot: '' }).failures.includes('VALVE_REFERENCE_PRIVATE_ROOT_REQUIRED'));
  assert.ok(deployment.valveProductionReadiness(valveEnv, { sourcePath: '' }).failures.includes('VALVE_REFERENCE_DOCX_PATH_REQUIRED'));
  assert.ok(deployment.valveProductionReadiness(valveEnv, { expectedHash: '' }).failures.includes('VALVE_REFERENCE_DOCX_SHA256_REQUIRED'));
  assert.ok(deployment.valveProductionReadiness(valveEnv, { enterpriseId: '' }).failures.includes('VALVE_REFERENCE_ENTERPRISE_ID_REQUIRED'));

  const outsidePath = path.join(persistentRoot, 'unapproved', 'reference-template.docx');
  fs.mkdirSync(path.dirname(outsidePath), { recursive: true });
  fs.copyFileSync(sourcePath, outsidePath);
  assert.ok(deployment.valveProductionReadiness(valveEnv, { sourcePath: outsidePath }).failures.includes('SOURCE_PATH_NOT_APPROVED'));

  const nonPersistentRoot = path.join(root, 'not-persistent', 'valve');
  fs.mkdirSync(nonPersistentRoot, { recursive: true });
  const nonPersistentSource = path.join(nonPersistentRoot, 'reference-template.docx');
  fs.copyFileSync(sourcePath, nonPersistentSource);
  assert.ok(deployment.valveProductionReadiness(valveEnv, {
    privateRoot: nonPersistentRoot,
    sourcePath: nonPersistentSource,
  }).failures.includes('VALVE_PRIVATE_ROOT_OUTSIDE_PERSISTENT_ROOT'));

  assert.ok(deployment.valveProductionReadiness(valveEnv, { expectedHash: 'a'.repeat(64) }).failures.includes('VALVE_REFERENCE_SOURCE_HASH_MISMATCH'));

  const publicMissing = evaluateFrontendConfig({
    hostname: 'shirunjies8-png.github.io',
    origin: 'https://shirunjies8-png.github.io',
    publicReal: true,
  });
  assert.equal(publicMissing.PUBLIC_REAL_API_REQUIRED, true);
  assert.equal(publicMissing.BACKEND_NOT_CONFIGURED, true);
  assert.equal(publicMissing.STATIC_DEMO_ONLY, false);
  assert.equal(publicMissing.DEMO_LOGIN_ONLY, false);

  const publicInsecure = evaluateFrontendConfig({
    hostname: 'shirunjies8-png.github.io',
    origin: 'https://shirunjies8-png.github.io',
    apiBase: 'http://127.0.0.1:3000',
    publicReal: true,
  });
  assert.equal(publicInsecure.BACKEND_NOT_CONFIGURED, true);
  assert.equal(publicInsecure.API_BASE_URL, '');

  const publicConfigured = evaluateFrontendConfig({
    hostname: 'shirunjies8-png.github.io',
    origin: 'https://shirunjies8-png.github.io',
    apiBase: 'https://example-backend.invalid',
    publicReal: true,
  });
  assert.equal(publicConfigured.BACKEND_NOT_CONFIGURED, false);
  assert.equal(publicConfigured.API_BASE_URL, 'https://example-backend.invalid');

  const localDevelopment = evaluateFrontendConfig({
    hostname: '127.0.0.1',
    origin: 'http://127.0.0.1:3000',
  });
  assert.equal(localDevelopment.API_BASE_URL, 'http://127.0.0.1:3000');
  assert.equal(localDevelopment.BACKEND_NOT_CONFIGURED, false);

  const render = fs.readFileSync(path.join(process.cwd(), 'render.yaml'), 'utf8');
  assert.match(render, /CORS_ALLOWED_ORIGINS[\s\S]*value: https:\/\/shirunjies8-png\.github\.io/);
  assert.doesNotMatch(render, /CORS_ALLOWED_ORIGINS[\s\S]*value:\s*['"]?\*['"]?/);
  assert.match(render, /PERSISTENT_DATA_ROOT[\s\S]*value: \/var\/data/);
  assert.match(render, /VALVE_REFERENCE_PRIVATE_ROOT[\s\S]*value: \/var\/data\/valve\/private/);

  const core = fs.readFileSync(path.join(process.cwd(), 'core.js'), 'utf8');
  const ui = fs.readFileSync(path.join(process.cwd(), 'ui.js'), 'utf8');
  const app = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');
  const valveService = fs.readFileSync(path.join(process.cwd(), 'services', 'valveTenderWorkbenchService.js'), 'utf8');
  assert.match(core, /PUBLIC_REAL_API_REQUIRED[\s\S]*BACKEND_NOT_CONFIGURED/);
  assert.match(ui, /BACKEND_NOT_CONFIGURED/);
  assert.match(ui, /backendActionDisabled/);
  assert.match(app, /PUBLIC_REAL_API_REQUIRED[\s\S]*BACKEND_NOT_CONFIGURED[\s\S]*AuthClient\.clear\(\)/);
  assert.doesNotMatch(valveService, /const\s+EXPECTED_SOURCE_HASH/, 'production source identity must be supplied by server-side configuration');

  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  assert.deepEqual(tracked.filter(file => /\.(zip|doc|docx|dwg)$/i.test(file)), [], 'tracked source binaries are forbidden');
  for (const directory of ['public', 'dist']) {
    assert.deepEqual(
      collectFiles(path.join(process.cwd(), directory)).filter(file => /\.(zip|doc|docx|dwg)$/i.test(file)),
      [],
      `${directory} must not contain confidential source binaries`,
    );
  }

  const ownedFiles = [
    'config/env.js', 'services/deploymentReadinessService.js', 'services/valveTenderWorkbenchService.js',
    'routes/index.js', 'render.yaml', 'config.js', 'core.js', 'ui.js', 'app.js',
    'scripts/public-deployment-hardening-test.mjs', 'scripts/public-production-runtime-contract-test.mjs',
    'docs/deployment/realityos-render-production-runtime.md',
  ];
  for (const file of ownedFiles) {
    if (!fs.existsSync(file)) continue;
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /\/Users\/[A-Za-z0-9._-]+/, `${file} must not contain a private user path`);
  }

  console.log(JSON.stringify({
    PUBLIC_PRODUCTION_RUNTIME_CONTRACT: 'PASS',
    JWT_FAIL_CLOSED: 'PASS',
    ADMIN_BOOTSTRAP_FAIL_CLOSED: 'PASS',
    VALVE_PRIVATE_SOURCE_CONTRACT: 'PASS',
    APPROVED_ROOT_ENFORCEMENT: 'PASS',
    SOURCE_HASH_GATE: 'PASS',
    PERSISTENT_DB_CONTRACT: 'PASS',
    PUBLIC_REAL_FRONTEND_FAIL_CLOSED: 'PASS',
    DEVELOPMENT_LOCALHOST: 'PASS',
    PRODUCTION_CORS: 'PASS',
    RAW_SOURCE_IN_TRACKED_FILES: 'NO',
    RAW_SOURCE_IN_BUILD: 'NO',
    PRIVATE_USER_PATH_NEW_LEAK: 'NO',
  }, null, 2));
} finally {
  restoreEnvironment();
  fs.rmSync(root, { recursive: true, force: true });
}
