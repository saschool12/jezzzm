import { Resend } from 'resend';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Jhonny AI <onboarding@resend.dev>',
      to: email,
      subject: '🔐 Password Reset Request',
      html: `
        <h1>Password Reset</h1>
        <p>Click <a href="${resetLink}">here</a> to reset your password.</p>
        <p>Or copy this link: ${resetLink}</p>
        <p>This link expires in 1 hour.</p>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json({ success: true, message: 'Password reset email sent' });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
}
