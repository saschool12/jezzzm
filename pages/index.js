import { useState, useEffect } from 'react';

export default function Home() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMessage('✅ Jhonny AI is running!');
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0e17',
      color: '#fff',
      fontFamily: 'sans-serif',
      padding: '20px'
    }}>
      <h1 style={{ color: '#ffd700' }}>🎰 Jhonny AI</h1>
      <p style={{ color: '#8899bb' }}>{message}</p>
      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        <a href="/forgot-password" style={{ color: '#ffd700' }}>Forgot Password</a>
        <span style={{ color: '#8899bb' }}>|</span>
        <a href="/login" style={{ color: '#ffd700' }}>Login</a>
      </div>
    </div>
  );
}
