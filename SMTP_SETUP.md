SMTP / Email configuration

The backend supports two ways to send email:

- SendGrid API (recommended for production): set `SENDGRID_API_KEY`.
- SMTP (any provider) via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`.

Example (SendGrid):

```powershell
$env:SENDGRID_API_KEY="your_sendgrid_api_key"
$env:SMTP_FROM='"AlgoArena" <noreply@yourdomain.com>'
```

Example (Gmail using App Password):

1. Enable 2-Step Verification on your Google account and create an App Password:
   https://myaccount.google.com/apppasswords
2. Set environment variables (PowerShell):

```powershell
$env:SMTP_HOST="smtp.gmail.com"
$env:SMTP_PORT="587"
$env:SMTP_SECURE="false"
$env:SMTP_USER="your@gmail.com"
$env:SMTP_PASS="your_app_password_here"
$env:SMTP_FROM='"AlgoArena" <noreply@yourdomain.com>'
```

Notes:

- After changing env vars restart the backend: `npm run start:dev`.
- SendGrid is preferred because it handles deliverability, DKIM/SPF, and higher throughput.
- Gmail App Passwords are suitable for quick testing but not recommended for production.
