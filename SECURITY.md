# Security Policy

Industrial AI OS is intended for browser-based demo use and internal deployment. Treat any production configuration as potentially sensitive.

## Data Handling Rules

- Do not commit API keys, database passwords, or enterprise secrets.
- Do not upload real customer contracts, invoices, order files, payroll data, or staff records to the public demo.
- Keep production AI credentials in server-side environment variables only.
- Use local-only storage for demo data unless a private backend is intentionally configured.

## Secrets and Configuration

- Store local demo settings in browser `localStorage` only.
- Keep `.env` out of version control.
- Keep `.env.example` updated so deployment settings can be reproduced safely.
- Never expose production keys in frontend code, screenshots, logs, or exported backups.

## Reporting Issues

If you discover a security issue in this project, document the exact reproduction steps and the affected file or route. Avoid sharing live credentials in the report.
