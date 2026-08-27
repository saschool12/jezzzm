import { useState } from 'react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ Password reset link sent to your email!');
        setEmail('');
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (err) {
      setError('Failed to send reset email');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0e17',
      color: '#fff',
      padding: '20px'
    }}>
      <div style={{
        background: '#141f2f',
        padding: '40px',
        borderRadius: '16px',
        maxWidth: '400px',
        width: '100%',
        border: '1px solid #ffd70044'
      }}>
        <h1 style={{ color: '#ffd700', textAlign: 'center' }}>🔐 Forgot Password</h1>
        <p style={{ color: '#8899bb', textAlign: 'center', margin: '10px 0' }}>Enter your email to receive a reset link.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              margin: '8px 0',
              background: '#1e2f42',
              color: '#fff',
              border: 'none',
              borderRadius: '8px'
            }}
            required
          />
          {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}
          {message && <p style={{ color: '#44ff44' }}>{message}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: '#ffd700',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginTop: '16px'
            }}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '16px', color: '#8899bb' }}>
          <a href="/login" style={{ color: '#ffd700' }}>Back to Login</a>
        </p>
      </div>
    </div>
  );
}
