import crypto from 'crypto';

// In a real app, store tokens in database with expiration
// For demo, we'll use a simple in-memory store
const resetTokens = new Map();

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password required' });
    }

    // Verify token (in real app, check database)
    // For demo, we'll check if token exists in our map
    if (!resetTokens.has(token)) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Get user email from token
    const { email } = resetTokens.get(token);

    // In a real app: update user's password in database
    // For demo: just remove the token
    resetTokens.delete(token);

    res.status(200).json({ success: true, message: 'Password reset successful' });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Helper to store reset token (should be called from forgot-password)
// For demo, we'll expose a function to add tokens
export function storeResetToken(email, token) {
  resetTokens.set(token, { email, expires: Date.now() + 3600000 }); // 1 hour
}
