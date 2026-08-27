import nodemailer from 'nodemailer';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // In production, check if user exists in DB, generate token, store with expiry

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Jhonny AI" <${process.env.SMTP_USER}>`,
      to: email,
      subject: '🔐 Password Reset Request',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background: #0a0e17; color: #fff; padding: 40px; }
            .container { max-width: 500px; margin: 0 auto; background: #141f2f; padding: 30px; border-radius: 16px; border: 1px solid #ffd70044; }
            h1 { color: #ffd700; }
            .btn { display: inline-block; padding: 12px 30px; background: #ffd700; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .link { color: #ffd700; word-break: break-all; }
            .footer { color: #8899bb; font-size: 0.85rem; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔐 Password Reset</h1>
            <p>You requested a password reset for your Jhonny AI account.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetLink}" class="btn">Reset Password</a>
            <p>Or copy and paste this link:</p>
            <p class="link">${resetLink}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <div class="footer">— Jhonny AI Team</div>
          </div>
        </body>
        </html>
      `,
    });

    res.status(200).json({ success: true, message: 'Password reset email sent' });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ error: 'Failed to send email. Check SMTP settings.' });
  }
}
