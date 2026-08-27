import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ResetPassword() {
  const router = useRouter();
  const { token } = router.query;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ Password reset successful! Redirecting to login...');
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (err) {
      setError('Failed to reset password');
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <div style={{ padding: '2rem', background: '#0a0e17', color: '#fff', minHeight: '100vh', textAlign: 'center' }}>
        <h1 style={{ color: '#ff6b6b' }}>❌ Invalid reset link</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', background: '#0a0e17', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#141f2f', padding: '40px', borderRadius: '16px', maxWidth: '400px', width: '100%', border: '1px solid #ffd70044' }}>
        <h1 style={{ color: '#ffd700', textAlign: 'center', marginBottom: '20px' }}>🔐 Reset Password</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '12px', margin: '8px 0', background: '#1e2f42', color: '#fff', border: 'none', borderRadius: '8px' }}
            required
          />
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{ width: '100%', padding: '12px', margin: '8px 0', background: '#1e2f42', color: '#fff', border: 'none', borderRadius: '8px' }}
            required
          />
          {error && <p style={{ color: '#ff6b6b', marginTop: '10px' }}>{error}</p>}
          {message && <p style={{ color: '#44ff44', marginTop: '10px' }}>{message}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '12px', background: '#ffd700', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '16px' }}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '16px', color: '#8899bb' }}>
          <a href="/login" style={{ color: '#ffd700' }}>Back to Login</a>
        </p>
      </div>
    </div>
  );
}
