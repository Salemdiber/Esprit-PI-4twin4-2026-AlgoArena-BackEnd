import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
    private transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: 'sandbox.smtp.mailtrap.io',
            port: 2525,
            auth: {
                user: '3c703bd7912d71',
                pass: '69f3099cdaf6c1',
            },
        });
    }

    async sendPasswordResetEmail(email: string, token: string) {
        // Updated to match React Router: /reset-password/:token
        const resetLink = `http://localhost:5173/reset-password/${token}`;

        const htmlTemplate = `
      <div style="margin: 0; padding: 0; background-color: #0d1117; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding-top: 40px; padding-bottom: 40px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border: 1px solid #1e293b;">
          
          <!-- Header -->
          <div style="text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-bottom: 1px solid #1e293b;">
            <div style="font-size: 28px; font-weight: 800; color: #ffffff; text-decoration: none; letter-spacing: -0.5px;">
              Algo<span style="color: #22d3ee;">Arena</span>
            </div>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px; text-align: center;">
            <div style="color: #ffffff; font-size: 24px; font-weight: 700; margin-bottom: 16px;">Secure Password Reset</div>
            <div style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
              We received a request to reset the password for your AlgoArena account. If you didn't initiate this request, you can safely ignore this email.
              <br><br>
              To regain access to the arena, click the button below to establish a new secure password.
            </div>
            
            <a href="${resetLink}" style="display: inline-block; background-color: #22d3ee; background-image: linear-gradient(to right, #06b6d4, #22d3ee); color: #0f172a; padding: 14px 28px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 16px; box-shadow: 0 4px 14px 0 rgba(34, 211, 238, 0.39); text-transform: uppercase; letter-spacing: 0.5px;">
              Reset Password
            </a>
            
            <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #1e293b; color: #64748b; font-size: 13px; word-break: break-all;">
              Or copy and paste this link manually:<br>
              <a href="${resetLink}" style="color: #22d3ee; text-decoration: underline; margin-top: 8px; display: inline-block;">${resetLink}</a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="padding: 20px; text-align: center; color: #475569; font-size: 12px; background-color: #0b1120;">
            &copy; ${new Date().getFullYear()} AlgoArena. All rights reserved.<br>
            Level up your coding syntax securely.
          </div>
          
        </div>
      </div>
    `;

        await this.transporter.sendMail({
            from: '"AlgoArena" <noreply@algoarena.com>',
            to: email,
            subject: 'Reset Your Password - AlgoArena',
            html: htmlTemplate,
        });
    }
}
