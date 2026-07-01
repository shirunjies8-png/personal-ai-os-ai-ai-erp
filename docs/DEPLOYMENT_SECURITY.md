# Deployment Security Guide

Industrial AI OS is safe to demo on GitHub Pages, but real enterprise use should move to a private deployment with backend controls.

## Recommended Production Layout

- Frontend on a static host or enterprise web server
- Backend API on a private server or Vercel-like runtime
- Database on an isolated server or managed private instance
- File storage encrypted at rest
- AI credentials stored server-side only

## Security Checklist

- Enable HTTPS everywhere
- Enforce authentication and role-based access control
- Separate enterprise data by tenant or organization
- Log AI calls, uploads, exports, and administrative actions
- Rotate API keys regularly
- Back up the database on a schedule
- Apply data masking before sharing files externally

## Browser Demo Limits

- GitHub Pages is suitable for a resume demo or presentation
- GitHub Pages should not store real enterprise data
- Browser local storage is convenient, but it is not a replacement for server-side access control

## Sensitive Data Rules

- Do not store real API keys in the frontend
- Do not commit production secrets to Git
- Do not let exported backups contain credentials
- Mask phone numbers, emails, ID numbers, addresses, and customer names before demoing
