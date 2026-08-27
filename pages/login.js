import Link from 'next/link';

export default function Login() {
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
        <h1 style={{ color: '#ffd700', textAlign: 'center' }}>🔐 Login</h1>
        <p style={{ color: '#8899bb', textAlign: 'center', margin: '10px 0' }}>
          This is a demo login page.
        </p>
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link href="/forgot-password" style={{ color: '#ffd700' }}>
            Forgot Password?
          </Link>
          <br />
          <Link href="/" style={{ color: '#ffd700', marginTop: '10px', display: 'inline-block' }}>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
