import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { useI18n } from '@hooks/useI18n';

const ADMIN_CSS = `
.admin-login-page{min-height:100dvh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0b0f1a 0%,#1a1040 40%,#0f172a 100%);position:relative;overflow:hidden}
.admin-login-page::before{content:'';position:absolute;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.15) 0%,transparent 70%);top:-100px;right:-100px;filter:blur(60px)}
.admin-login-page::after{content:'';position:absolute;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(239,68,68,.1) 0%,transparent 70%);bottom:-50px;left:-50px;filter:blur(40px)}
.admin-login-card{position:relative;z-index:1;width:100%;max-width:400px;padding:40px 32px;border-radius:20px;background:rgba(15,23,42,.8);border:1px solid rgba(99,102,241,.2);backdrop-filter:blur(20px)}
@media(max-width:480px){.admin-login-card{margin:16px;padding:32px 20px}}
`;

export default function AdminLogin() {
  const { t } = useI18n();
  const { loginAsync } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = 'admin-login-css';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id; s.textContent = ADMIN_CSS;
      document.head.appendChild(s);
    }
    // If already admin, redirect
    try {
      const stored = localStorage.getItem('wellkoc-auth');
      if (stored) {
        const p = JSON.parse(stored);
        if (p?.user?.role === 'admin') navigate('/admin');
      }
    } catch {}
    return () => { document.getElementById(id)?.remove(); };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await loginAsync(email, password, 'admin' as any);
    setLoading(false);
    if (result.success) {
      navigate('/admin');
    } else {
      setError(result.error || t('adminLogin.errorDefault'));
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, rgba(239,68,68,.2), rgba(249,115,22,.2))', border: '1px solid rgba(239,68,68,.3)', marginBottom: 16 }}>
            <svg width="32" height="32" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs><linearGradient id="wkAL" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ef4444"/><stop offset="100%" stopColor="#f97316"/></linearGradient></defs>
              <path d="M7 11L10.5 24L14 16L17.5 24L21 11" stroke="url(#wkAL)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M23 11V27M23 19L31 11M23 19L31 27" stroke="url(#wkAL)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontFamily: "'Noto Sans', sans-serif", fontWeight: 800, fontSize: '1.5rem', color: '#fff', marginBottom: 4 }}>WellKOC Admin</h1>
          <p style={{ color: 'rgba(255,255,255,.4)', fontSize: '.78rem' }}>{t('adminLogin.subtitle')}</p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, background: 'rgba(239,68,68,.1)', color: '#ef4444', fontSize: '.8rem', border: '1px solid rgba(239,68,68,.2)' }}>{error}</div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: '.68rem', fontWeight: 600, color: 'rgba(255,255,255,.4)', marginBottom: 6, letterSpacing: '.06em', textTransform: 'uppercase' }}>{t('adminLogin.emailLabel')}</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="admin@wellkoc.com"
              style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', color: '#fff', fontSize: '.88rem', outline: 'none', fontFamily: 'var(--ff-body, system-ui)', transition: 'border-color .2s' }}
              onFocus={e => e.target.style.borderColor = 'rgba(239,68,68,.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.1)'}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '.68rem', fontWeight: 600, color: 'rgba(255,255,255,.4)', marginBottom: 6, letterSpacing: '.06em', textTransform: 'uppercase' }}>{t('adminLogin.passwordLabel')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••"
                style={{ width: '100%', padding: '14px 48px 14px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', color: '#fff', fontSize: '.88rem', outline: 'none', fontFamily: 'var(--ff-body, system-ui)', transition: 'border-color .2s' }}
                onFocus={e => e.target.style.borderColor = 'rgba(239,68,68,.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.1)'}
              />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', fontSize: '1rem' }} tabIndex={-1}>{showPw ? '🙈' : '👁️'}</button>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #ef4444, #f97316)', color: '#fff',
              fontSize: '.92rem', fontWeight: 700, fontFamily: 'var(--ff-body, system-ui)',
              opacity: loading ? 0.7 : 1, transition: 'opacity .2s', marginTop: 4,
            }}
          >
            {loading ? t('adminLogin.authenticating') : t('adminLogin.loginBtn')}
          </button>
        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <p style={{ color: 'rgba(255,255,255,.3)', fontSize: '.7rem' }}>
            WellKOC Admin Panel v1.0 · Polygon Blockchain
          </p>
          <a href="/login" style={{ color: 'rgba(255,255,255,.3)', fontSize: '.7rem', textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>
            {t('adminLogin.backToMain')}
          </a>
        </div>
      </div>
    </div>
  );
}
