const crypto = require('node:crypto');

function migrationChecksum(migration) {
  return crypto.createHash('sha256')
    .update([migration.version, migration.name, migration.signature].join('|'))
    .digest('hex');
}

function ensureColumn(db, table, name, type) {
  const columns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(item => item.name));
  if (!columns.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
}

const migrations = [
  {
    version: '20260717_001',
    name: 'manufacturing_foundation',
    signature: 'document_sequences legacy_migration_records entity_attachments v1',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS document_sequences (
          id TEXT PRIMARY KEY,
          enterprise_id TEXT NOT NULL,
          document_type TEXT NOT NULL,
          period_key TEXT NOT NULL,
          current_value INTEGER NOT NULL DEFAULT 0 CHECK(current_value >= 0),
          padding INTEGER NOT NULL DEFAULT 6 CHECK(padding BETWEEN 4 AND 10),
          updated_at TEXT NOT NULL,
          UNIQUE(enterprise_id, document_type, period_key),
          FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS legacy_migration_records (
          id TEXT PRIMARY KEY,
          enterprise_id TEXT NOT NULL,
          source_area TEXT NOT NULL,
          source_record_id TEXT NOT NULL,
          source_hash TEXT NOT NULL,
          target_type TEXT NOT NULL,
          target_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('imported','skipped','failed')),
          error_summary TEXT DEFAULT '',
          migrated_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(enterprise_id, source_area, source_record_id, source_hash),
          FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS entity_attachments (
          id TEXT PRIMARY KEY,
          enterprise_id TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_type TEXT DEFAULT '',
          file_size INTEGER NOT NULL DEFAULT 0 CHECK(file_size >= 0),
          checksum TEXT DEFAULT '',
          storage_status TEXT NOT NULL DEFAULT 'metadata_only'
            CHECK(storage_status IN ('metadata_only','stored','missing','quarantined','deleted')),
          storage_key TEXT DEFAULT '',
          uploaded_by TEXT DEFAULT '',
          created_at TEXT NOT NULL,
          deleted_at TEXT,
          deleted_by TEXT,
          delete_reason TEXT DEFAULT '',
          FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_legacy_migration_enterprise
          ON legacy_migration_records(enterprise_id, source_area, migrated_at);
        CREATE INDEX IF NOT EXISTS idx_entity_attachments_lookup
          ON entity_attachments(enterprise_id, entity_type, entity_id, created_at);
      `);
    }
  },
  {
    version: '20260717_002',
    name: 'business_audit_columns',
    signature: 'logs entity_type entity_id action request approval before after result client v1',
    up(db) {
      ensureColumn(db, 'logs', 'entity_type', "TEXT DEFAULT ''");
      ensureColumn(db, 'logs', 'entity_id', "TEXT DEFAULT ''");
      ensureColumn(db, 'logs', 'action', "TEXT DEFAULT ''");
      ensureColumn(db, 'logs', 'request_id', "TEXT DEFAULT ''");
      ensureColumn(db, 'logs', 'approval_id', "TEXT DEFAULT ''");
      ensureColumn(db, 'logs', 'before_json', "TEXT DEFAULT ''");
      ensureColumn(db, 'logs', 'after_json', "TEXT DEFAULT ''");
      ensureColumn(db, 'logs', 'result', "TEXT DEFAULT 'success'");
      ensureColumn(db, 'logs', 'source_client', "TEXT DEFAULT ''");
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_logs_entity
          ON logs(enterprise_id, entity_type, entity_id, created_at);
      `);
    }
  },
  {
    version: '20260717_010',
    name: 'customer_project_rfq',
    signature: 'customers contacts projects rfqs requirements risks followups v1',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          enterprise_id TEXT NOT NULL,
          customer_no TEXT NOT NULL,
          name TEXT NOT NULL,
          source TEXT DEFAULT '',
          level TEXT NOT NULL DEFAULT 'normal' CHECK(level IN ('normal','important','strategic')),
          owner TEXT DEFAULT '',
          notes TEXT DEFAULT '',
          status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','inactive','archived')),
          version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
          created_by TEXT NOT NULL,
          updated_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          deleted_by TEXT,
          UNIQUE(enterprise_id, customer_no),
          FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS customer_contacts (
          id TEXT PRIMARY KEY,
          enterprise_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          name TEXT NOT NULL,
          title TEXT DEFAULT '',
          phone TEXT DEFAULT '',
          email TEXT DEFAULT '',
          is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
          notes TEXT DEFAULT '',
          created_by TEXT NOT NULL,
          updated_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          deleted_by TEXT,
          FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE,
          FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          enterprise_id TEXT NOT NULL,
          project_no TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          owner TEXT DEFAULT '',
          planned_start_date TEXT DEFAULT '',
          planned_end_date TEXT DEFAULT '',
          status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','on_hold','completed','closed')),
          version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
          created_by TEXT NOT NULL,
          updated_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          deleted_by TEXT,
          UNIQUE(enterprise_id, project_no),
          FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE,
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        );

        CREATE TABLE IF NOT EXISTS rfqs (
          id TEXT PRIMARY KEY,
          enterprise_id TEXT NOT NULL,
          rfq_no TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          project_id TEXT,
          source TEXT DEFAULT 'manual',
          source_reference TEXT DEFAULT '',
          product_name TEXT NOT NULL,
          product_code TEXT DEFAULT '',
          material TEXT DEFAULT '',
          quantity REAL NOT NULL DEFAULT 0 CHECK(quantity >= 0),
          unit TEXT NOT NULL DEFAULT '件',
          process_requirements TEXT DEFAULT '',
          tolerance_requirements TEXT DEFAULT '',
          surface_treatment TEXT DEFAULT '',
          packaging_requirements TEXT DEFAULT '',
          budget_minor INTEGER CHECK(budget_minor IS NULL OR budget_minor >= 0),
          currency TEXT NOT NULL DEFAULT 'CNY',
          requested_delivery_date TEXT DEFAULT '',
          owner TEXT DEFAULT '',
          contact_name TEXT DEFAULT '',
          contact_details TEXT DEFAULT '',
          notes TEXT DEFAULT '',
          missing_summary TEXT DEFAULT '',
          risk_summary TEXT DEFAULT '',
          status TEXT NOT NULL DEFAULT 'draft'
            CHECK(status IN ('draft','waiting_review','information_required','ready_for_quotation','quotation_in_progress','quoted','negotiating','won','expired')),
          review_task_id TEXT DEFAULT '',
          review_approval_id TEXT DEFAULT '',
          quote_workspace_ref TEXT DEFAULT '',
          version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
          created_by TEXT NOT NULL,
          updated_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          deleted_by TEXT,
          UNIQUE(enterprise_id, rfq_no),
          FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE,
          FOREIGN KEY (customer_id) REFERENCES customers(id),
          FOREIGN KEY (project_id) REFERENCES projects(id)
        );

        CREATE TABLE IF NOT EXISTS rfq_requirements (
          id TEXT PRIMARY KEY,
          enterprise_id TEXT NOT NULL,
          rfq_id TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'general',
          field_key TEXT NOT NULL,
          label TEXT NOT NULL,
          value TEXT DEFAULT '',
          unit TEXT DEFAULT '',
          required INTEGER NOT NULL DEFAULT 0 CHECK(required IN (0,1)),
          confirmed INTEGER NOT NULL DEFAULT 0 CHECK(confirmed IN (0,1)),
          source TEXT DEFAULT 'manual',
          updated_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(enterprise_id, rfq_id, field_key),
          FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE,
          FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS rfq_risks (
          id TEXT PRIMARY KEY,
          enterprise_id TEXT NOT NULL,
          rfq_id TEXT NOT NULL,
          title TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'delivery',
          severity INTEGER NOT NULL DEFAULT 1 CHECK(severity BETWEEN 1 AND 5),
          probability INTEGER NOT NULL DEFAULT 1 CHECK(probability BETWEEN 1 AND 5),
          impact INTEGER NOT NULL DEFAULT 1 CHECK(impact BETWEEN 1 AND 5),
          risk_score INTEGER NOT NULL DEFAULT 1 CHECK(risk_score BETWEEN 1 AND 25),
          risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN ('low','medium','high','critical')),
          is_blocking INTEGER NOT NULL DEFAULT 0 CHECK(is_blocking IN (0,1)),
          owner TEXT DEFAULT '',
          due_date TEXT DEFAULT '',
          mitigation TEXT DEFAULT '',
          status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','handling','mitigated','accepted','closed')),
          acceptance_reason TEXT DEFAULT '',
          closure_evidence TEXT DEFAULT '',
          version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
          created_by TEXT NOT NULL,
          updated_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          deleted_by TEXT,
          FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE,
          FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS rfq_followups (
          id TEXT PRIMARY KEY,
          enterprise_id TEXT NOT NULL,
          rfq_id TEXT NOT NULL,
          method TEXT NOT NULL DEFAULT 'note',
          content TEXT NOT NULL,
          next_followup_at TEXT DEFAULT '',
          owner TEXT DEFAULT '',
          result TEXT DEFAULT '',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE,
          FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_customers_list
          ON customers(enterprise_id, status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer
          ON customer_contacts(enterprise_id, customer_id, is_primary);
        CREATE INDEX IF NOT EXISTS idx_projects_list
          ON projects(enterprise_id, customer_id, status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_rfqs_list
          ON rfqs(enterprise_id, status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_rfqs_customer
          ON rfqs(enterprise_id, customer_id, created_at);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_rfqs_source_reference
          ON rfqs(enterprise_id, source, source_reference) WHERE source_reference <> '';
        CREATE INDEX IF NOT EXISTS idx_rfq_requirements_rfq
          ON rfq_requirements(enterprise_id, rfq_id, required);
        CREATE INDEX IF NOT EXISTS idx_rfq_risks_rfq
          ON rfq_risks(enterprise_id, rfq_id, status, risk_level);
        CREATE INDEX IF NOT EXISTS idx_rfq_followups_rfq
          ON rfq_followups(enterprise_id, rfq_id, created_at);
      `);
    }
  },
  {
    version: '20260722_020',
    name: 'manufacturing_journey_integrity',
    signature: 'idempotency customer project rfq relationship and requirement columns v1',
    up(db) {
      ensureColumn(db, 'rfqs', 'quality_requirements', "TEXT DEFAULT ''");
      ensureColumn(db, 'rfqs', 'customer_special_requirements', "TEXT DEFAULT ''");
      db.exec(`
        CREATE TABLE IF NOT EXISTS manufacturing_idempotency_keys (
          enterprise_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          idempotency_key TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (enterprise_id, operation, idempotency_key),
          FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_manufacturing_idempotency_entity
          ON manufacturing_idempotency_keys(enterprise_id, entity_type, entity_id);
      `);
    }
  }
];

function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL CHECK(status IN ('running','applied','failed','rolled_back')),
      error_summary TEXT DEFAULT '',
      app_commit TEXT DEFAULT ''
    );
  `);
}

function runManufacturingPhase2Migrations(db) {
  ensureMigrationTable(db);
  for (const migration of migrations) {
    const checksum = migrationChecksum(migration);
    const existing = db.prepare('SELECT * FROM schema_migrations WHERE version = ?').get(migration.version);
    if (existing?.status === 'applied') {
      if (existing.checksum !== checksum) throw new Error(`数据库迁移 ${migration.version} 校验失败`);
      continue;
    }
    const startedAt = new Date().toISOString();
    db.prepare(`INSERT INTO schema_migrations(version,name,checksum,started_at,finished_at,status,error_summary,app_commit)
      VALUES(?,?,?,?,NULL,'running','','')
      ON CONFLICT(version) DO UPDATE SET name=excluded.name,checksum=excluded.checksum,
        started_at=excluded.started_at,finished_at=NULL,status='running',error_summary=''`)
      .run(migration.version, migration.name, checksum, startedAt);
    try {
      db.transaction(() => {
        migration.up(db);
        db.prepare(`UPDATE schema_migrations SET status='applied',finished_at=?,error_summary='' WHERE version=?`)
          .run(new Date().toISOString(), migration.version);
      })();
    } catch (error) {
      db.prepare(`UPDATE schema_migrations SET status='failed',finished_at=?,error_summary=? WHERE version=?`)
        .run(new Date().toISOString(), '迁移执行失败，请查看服务端脱敏日志', migration.version);
      throw error;
    }
  }
}

module.exports = { migrations, runManufacturingPhase2Migrations };
