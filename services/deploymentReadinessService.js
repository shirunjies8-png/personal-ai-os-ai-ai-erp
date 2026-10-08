'use strict';

const fs = require('node:fs');
const path = require('node:path');

const UNSAFE_JWT_SECRETS = new Set([
  '',
  'change-me',
  'change-me-in-production',
  'secret',
  'jwt-secret',
  'default-secret',
]);

const UNSAFE_ADMIN_PASSWORDS = new Set([
  '',
  '123456',
  'admin',
  'admin123',
  'password',
  'changeme',
  'change-me',
  'change-me-in-production',
]);

function isProduction(env = {}) {
  return String(env.nodeEnv || process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function normalize(value) {
  return String(value || '').trim();
}

function isUnsafeJwtSecret(value) {
  const text = normalize(value);
  return text.length < 32 || UNSAFE_JWT_SECRETS.has(text.toLowerCase());
}

function isUnsafeAdminPassword(value) {
  const text = normalize(value);
  return text.length < 12 || UNSAFE_ADMIN_PASSWORDS.has(text.toLowerCase());
}

function assertWritableDirectory(dirPath) {
  fs.accessSync(dirPath, fs.constants.W_OK);
}

function isPathInside(rootPath, targetPath) {
  const root = path.resolve(normalize(rootPath));
  const target = path.resolve(normalize(targetPath));
  const relative = path.relative(root, target);
  return Boolean(rootPath && targetPath) && target !== root && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function sha256File(filePath) {
  const crypto = require('node:crypto');
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function valveProductionReadiness(env = {}, options = {}) {
  const production = isProduction(env);
  const persistentRoot = normalize(options.persistentRoot ?? env.persistentDataRoot ?? process.env.PERSISTENT_DATA_ROOT);
  const privateRoot = normalize(options.privateRoot ?? env.valveReferencePrivateRoot ?? process.env.VALVE_REFERENCE_PRIVATE_ROOT);
  const sourcePath = normalize(options.sourcePath ?? env.valveReferenceDocxPath ?? process.env.VALVE_REFERENCE_DOCX_PATH);
  const expectedHash = normalize(options.expectedHash ?? env.valveReferenceDocxSha256 ?? process.env.VALVE_REFERENCE_DOCX_SHA256 ?? (production ? '' : process.env.VALVE_REFERENCE_DOCX_EXPECTED_SHA256));
  const enterpriseId = normalize(options.enterpriseId ?? env.valveReferenceEnterpriseId ?? process.env.VALVE_REFERENCE_ENTERPRISE_ID);
  const failures = [];
  if (!privateRoot) failures.push('VALVE_REFERENCE_PRIVATE_ROOT_REQUIRED');
  if (!sourcePath) failures.push('VALVE_REFERENCE_DOCX_PATH_REQUIRED');
  if (!expectedHash) failures.push('VALVE_REFERENCE_DOCX_SHA256_REQUIRED');
  if (!enterpriseId) failures.push('VALVE_REFERENCE_ENTERPRISE_ID_REQUIRED');
  if (production && !persistentRoot) failures.push('PERSISTENT_DATA_ROOT_PRODUCTION_REQUIRED');
  if (persistentRoot && !path.isAbsolute(persistentRoot)) failures.push('PERSISTENT_DATA_ROOT_MUST_BE_ABSOLUTE');
  if (privateRoot && !path.isAbsolute(privateRoot)) failures.push('VALVE_PRIVATE_ROOT_MUST_BE_ABSOLUTE');
  if (sourcePath && !path.isAbsolute(sourcePath)) failures.push('VALVE_SOURCE_PATH_MUST_BE_ABSOLUTE');
  if (persistentRoot && privateRoot && path.isAbsolute(persistentRoot) && path.isAbsolute(privateRoot) && !isPathInside(persistentRoot, privateRoot)) failures.push('VALVE_PRIVATE_ROOT_OUTSIDE_PERSISTENT_ROOT');
  if (privateRoot && sourcePath && !isPathInside(privateRoot, sourcePath)) failures.push('SOURCE_PATH_NOT_APPROVED');
  if (expectedHash && !/^[a-f0-9]{64}$/i.test(expectedHash)) failures.push('VALVE_REFERENCE_DOCX_SHA256_INVALID');
  if (production && privateRoot && !fs.existsSync(privateRoot)) failures.push('VALVE_PRIVATE_ROOT_NOT_AVAILABLE');
  if (production && sourcePath && !fs.existsSync(sourcePath)) {
    failures.push('VALVE_REFERENCE_SOURCE_NOT_PROVISIONED');
  } else if (production && sourcePath && expectedHash && /^[a-f0-9]{64}$/i.test(expectedHash)) {
    try {
      if (!fs.statSync(sourcePath).isFile()) failures.push('VALVE_REFERENCE_SOURCE_NOT_FILE');
      else if (sha256File(sourcePath) !== expectedHash.toLowerCase()) failures.push('VALVE_REFERENCE_SOURCE_HASH_MISMATCH');
    } catch {
      failures.push('VALVE_REFERENCE_SOURCE_NOT_READABLE');
    }
  }
  return {
    ready: failures.length === 0,
    status: failures.length ? 'NOT_READY' : 'READY',
    code: failures.length ? 'VALVE_WORKBENCH_NOT_CONFIGURED' : 'READY',
    failures,
    storage_contract: 'PERSISTENT_PRIVATE_FILESYSTEM',
    persistent_root: persistentRoot ? 'CONFIGURED_REDACTED' : 'NOT_CONFIGURED',
    source_path: sourcePath ? 'CONFIGURED_REDACTED' : 'NOT_CONFIGURED',
    source_hash: expectedHash ? 'CONFIGURED_REDACTED' : 'NOT_CONFIGURED',
    enterprise_binding: enterpriseId ? 'CONFIGURED_REDACTED' : 'NOT_CONFIGURED',
  };
}

function validateProductionEnvironment(env = {}) {
  if (!isProduction(env)) return { ok: true, skipped: true, mode: env.nodeEnv || 'development' };

  const errors = [];
  const jwtSecret = normalize(process.env.JWT_SECRET);
  const adminPassword = normalize(process.env.DEFAULT_ADMIN_PASSWORD);
  const adminEmail = normalize(process.env.DEFAULT_ADMIN_EMAIL);
  const enterpriseName = normalize(process.env.DEFAULT_ENTERPRISE_NAME);
  const dbPath = normalize(process.env.DB_PATH || env.dbPath);
  const persistentRoot = normalize(process.env.PERSISTENT_DATA_ROOT || env.persistentDataRoot);
  const corsOrigins = normalize(process.env.CORS_ALLOWED_ORIGINS);

  if (!jwtSecret || isUnsafeJwtSecret(jwtSecret)) errors.push('JWT_SECRET_PRODUCTION_UNSAFE');
  if (!adminPassword || isUnsafeAdminPassword(adminPassword)) errors.push('DEFAULT_ADMIN_PASSWORD_PRODUCTION_UNSAFE');
  if (!adminEmail || /@personal-ai-os\.local$/i.test(adminEmail)) errors.push('DEFAULT_ADMIN_EMAIL_PRODUCTION_REQUIRED');
  if (!enterpriseName || /demo/i.test(enterpriseName)) errors.push('DEFAULT_ENTERPRISE_NAME_PRODUCTION_REQUIRED');
  if (!persistentRoot) errors.push('PERSISTENT_DATA_ROOT_PRODUCTION_REQUIRED');
  if (persistentRoot && !path.isAbsolute(persistentRoot)) errors.push('PERSISTENT_DATA_ROOT_MUST_BE_ABSOLUTE');
  if (!dbPath) errors.push('DB_PATH_PRODUCTION_REQUIRED');
  if (dbPath && !path.isAbsolute(dbPath)) errors.push('DB_PATH_MUST_BE_ABSOLUTE_IN_PRODUCTION');
  if (persistentRoot && dbPath && path.isAbsolute(dbPath) && !isPathInside(persistentRoot, dbPath)) errors.push('DB_PATH_OUTSIDE_PERSISTENT_ROOT');
  if (corsOrigins.split(',').map(item => item.trim()).filter(Boolean).some(origin => origin === '*')) errors.push('CORS_WILDCARD_FORBIDDEN_IN_PRODUCTION');
  if (!corsOrigins) errors.push('CORS_ALLOWED_ORIGINS_PRODUCTION_REQUIRED');

  if (dbPath && path.isAbsolute(dbPath)) {
    try {
      assertWritableDirectory(path.dirname(dbPath));
    } catch {
      errors.push('DB_PATH_PARENT_NOT_WRITABLE_OR_MISSING');
    }
  }

  if (errors.length) {
    const error = new Error(`Production startup blocked: ${errors.join(', ')}`);
    error.code = 'PRODUCTION_STARTUP_CONFIG_INVALID';
    error.status = 500;
    error.errors = errors;
    throw error;
  }

  return {
    ok: true,
    mode: 'production',
    jwtSecret: 'CONFIGURED',
    defaultAdminPassword: 'CONFIGURED',
    dbPath: 'CONFIGURED',
    persistentDataRoot: 'CONFIGURED',
    corsAllowedOrigins: 'CONFIGURED',
  };
}

function runtimeReadiness(env = {}, database) {
  const databaseState = database ? databaseReadiness(database) : { database: 'unknown', realityos_store: 'unknown' };
  const valve = valveProductionReadiness(env);
  return {
    process: 'ready',
    production_configuration: isProduction(env) ? 'ready' : 'development',
    database: databaseState.database,
    realityos_store: databaseState.realityos_store,
    valve_workbench: valve.status,
    valve_reason: valve.ready ? 'READY' : valve.code,
  };
}

function databaseReadiness(database) {
  try {
    database.prepare('SELECT 1').get();
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);
    return {
      database: 'ready',
      realityos_store: tables.includes('realityos_kernel_runs') ? 'ready' : 'not_initialized',
    };
  } catch {
    return {
      database: 'blocked',
      realityos_store: 'unknown',
    };
  }
}

module.exports = {
  isProduction,
  isUnsafeJwtSecret,
  isUnsafeAdminPassword,
  isPathInside,
  sha256File,
  validateProductionEnvironment,
  valveProductionReadiness,
  runtimeReadiness,
  databaseReadiness,
};
