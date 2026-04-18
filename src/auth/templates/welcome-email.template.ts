export const welcomeEmailTemplate = (platformName: string, ctaUrl?: string, logoUrl?: string) => {
  const safeCtaUrl = ctaUrl || 'http://localhost:5173/signin';
  const safeLogoUrl =
    logoUrl ||
    'https://dummyimage.com/180x48/0f172a/8be9fd.png&text=NextGen';

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to ${platformName}</title>
    <style>
      @media only screen and (max-width: 640px) {
        .shell { padding: 16px !important; }
        .hero-title { font-size: 30px !important; line-height: 1.2 !important; }
        .hero-subtitle { font-size: 15px !important; }
        .card { border-radius: 16px !important; }
        .card-body { padding: 20px !important; }
        .feature-title { font-size: 14px !important; }
        .feature-copy { font-size: 12px !important; }
        .cta-button { width: 100% !important; text-align: center !important; display: block !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#eff3fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="shell" style="background:#eff3fb;padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;">
            <tr>
              <td style="padding:24px 12px 22px;text-align:center;background:linear-gradient(160deg,#111827 0%,#1f2d53 45%,#2f4f87 100%);border-radius:24px 24px 0 0;">
                <img src="${safeLogoUrl}" alt="${platformName} logo" width="168" style="max-width:168px;height:auto;display:block;margin:0 auto 18px;" />
                <h1 class="hero-title" style="margin:0;font-size:40px;font-weight:800;line-height:1.15;color:#ffffff;letter-spacing:-0.4px;">Welcome to ${platformName} 🚀</h1>
                <p class="hero-subtitle" style="margin:12px 0 0;font-size:17px;line-height:1.6;color:#dbeafe;">Your journey starts now</p>
              </td>
            </tr>
            <tr>
              <td class="card" style="background:#ffffff;border:1px solid #e5eaf5;border-top:none;border-radius:0 0 24px 24px;box-shadow:0 20px 45px rgba(15,23,42,0.12);overflow:hidden;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td class="card-body" style="padding:30px 30px 18px;">
                      <p style="margin:0 0 12px;font-size:15px;line-height:1.8;color:#334155;">
                        Thanks for joining <strong style="color:#0f172a;">${platformName}</strong>. Your account is live and ready for action.
                      </p>
                      <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#334155;">
                        Build momentum from day one with focused challenges, progress tracking, and a competitive community.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 30px 14px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fbff;border:1px solid #dbeafe;border-radius:14px;">
                        <tr>
                          <td style="padding:16px 16px 2px;">
                            <p class="feature-title" style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.2px;color:#1d4ed8;text-transform:uppercase;">What you can do next</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:0 16px 16px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                              <tr>
                                <td width="24" valign="top" style="font-size:16px;line-height:1.6;">✔</td>
                                <td class="feature-copy" style="padding:0 0 10px;font-size:14px;line-height:1.65;color:#1e293b;">Explore curated coding challenges built for fast, practical growth.</td>
                              </tr>
                              <tr>
                                <td width="24" valign="top" style="font-size:16px;line-height:1.6;">📈</td>
                                <td class="feature-copy" style="padding:0 0 10px;font-size:14px;line-height:1.65;color:#1e293b;">Track your progress in real-time and unlock stronger performance insights.</td>
                              </tr>
                              <tr>
                                <td width="24" valign="top" style="font-size:16px;line-height:1.6;">🏆</td>
                                <td class="feature-copy" style="font-size:14px;line-height:1.65;color:#1e293b;">Compete, level up your rank, and grow with top-performing developers.</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 30px 14px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;">
                        <tr>
                          <td style="padding:14px 16px 6px;font-size:13px;font-weight:700;color:#9a3412;text-transform:uppercase;letter-spacing:0.2px;">
                            Security reminders
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:0 16px 16px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                              <tr>
                                <td width="24" valign="top" style="font-size:16px;line-height:1.6;">🔒</td>
                                <td style="padding:0 0 8px;font-size:14px;line-height:1.65;color:#7c2d12;">Keep your credentials private and never share them.</td>
                              </tr>
                              <tr>
                                <td width="24" valign="top" style="font-size:16px;line-height:1.6;">🔑</td>
                                <td style="padding:0 0 8px;font-size:14px;line-height:1.65;color:#7c2d12;">Use a strong, unique password for your ${platformName} account.</td>
                              </tr>
                              <tr>
                                <td width="24" valign="top" style="font-size:16px;line-height:1.6;">⚠️</td>
                                <td style="font-size:14px;line-height:1.65;color:#7c2d12;">Respect platform rules; misuse can lead to account restrictions.</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 30px 26px;text-align:center;">
                      <a class="cta-button" href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:linear-gradient(90deg,#2563eb,#0891b2);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.2px;padding:14px 30px;border-radius:14px;box-shadow:0 12px 22px rgba(14,116,144,0.34);">
                        Get Started
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 10px 0;text-align:center;">
                <p style="margin:0;font-size:12px;line-height:1.7;color:#64748b;">
                  ${platformName} • Need help? <a href="mailto:support@nextgen.app" style="color:#2563eb;text-decoration:none;">Contact support</a>
                </p>
                <p style="margin:0;font-size:12px;line-height:1.7;color:#64748b;">
                  You received this email because a new ${platformName} account was created with this address.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
};
