import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

export default function VNeIDCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      setStatus('error');
      setError('Thiếu mã xác thực từ VNeID');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/verify/vneid/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state: state || '' }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || err.message || 'Xác thực VNeID thất bại');
        }

        const data = await res.json();

        if (data.access_token && data.user) {
          login(
            {
              id: data.user.id,
              email: data.user.email || '',
              name: data.user.full_name || data.user.display_name || 'User',
              role: data.user.role || 'user',
              avatar: data.user.avatar_url,
            },
            data.access_token,
          );
        }

        setStatus('success');
        setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
      } catch (err: any) {
        const message = err.message || 'Xác thực VNeID thất bại';
        setStatus('error');
        setError(message);
      }
    })();
  }, [searchParams, login, navigate]);

  const handleRetry = () => {
    navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-0)',
    }}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="card" style={{
        padding: '48px 40px', textAlign: 'center', maxWidth: 400, width: '100%',
        animation: 'fadeIn .4s ease',
      }}>
        {/* VNeID Branding */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          marginBottom: 28, padding: '6px 14px', borderRadius: 20,
          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
        }}>
          <span style={{ fontSize: '.85rem' }}>🇻🇳</span>
          <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#ef4444', letterSpacing: '.05em' }}>
            VNeID
          </span>
        </div>

        {status === 'processing' && (
          <>
            {/* Animated spinner */}
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              border: '3px solid var(--border)',
              borderTopColor: 'var(--c6-300, #06b6d4)',
              animation: 'spin .8s linear infinite',
              margin: '0 auto 24px',
            }} />
            <h2 style={{ color: 'var(--text-1)', marginBottom: 8, fontSize: '1.1rem', fontWeight: 700 }}>
              Đang xác thực VNeID...
            </h2>
            <p style={{ color: 'var(--text-3)', fontSize: '.85rem', lineHeight: 1.6 }}>
              Vui lòng chờ trong giây lát
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(34,197,94,.15)',
              border: '2px solid rgba(34,197,94,.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: '1.5rem',
            }}>
              ✓
            </div>
            <h2 style={{ color: 'var(--text-1)', marginBottom: 8, fontSize: '1.1rem', fontWeight: 700 }}>
              Xác thực thành công!
            </h2>
            <p style={{ color: 'var(--text-3)', fontSize: '.85rem', lineHeight: 1.6 }}>
              Đang chuyển hướng đến dashboard...
            </p>
            {/* Progress bar */}
            <div style={{
              height: 3, borderRadius: 2, background: 'var(--border)',
              overflow: 'hidden', marginTop: 20,
            }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: 'linear-gradient(90deg, var(--c6-500, #06b6d4), var(--c4-500, #22c55e))',
                animation: 'progressFill 1.5s linear forwards',
                width: '0%',
              }} />
            </div>
            <style>{`
              @keyframes progressFill {
                from { width: 0%; }
                to { width: 100%; }
              }
            `}</style>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(239,68,68,.12)',
              border: '2px solid rgba(239,68,68,.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: '1.5rem',
            }}>
              ✕
            </div>
            <h2 style={{ color: 'var(--text-1)', marginBottom: 8, fontSize: '1.1rem', fontWeight: 700 }}>
              Xác thực thất bại
            </h2>
            <p style={{
              color: '#ef4444', fontSize: '.85rem', marginBottom: 24,
              lineHeight: 1.6, wordBreak: 'break-word',
            }}>
              {error}
            </p>
            <button
              onClick={handleRetry}
              className="btn btn-primary"
              style={{ padding: '10px 28px', width: '100%' }}
            >
              Quay lại đăng nhập
            </button>
          </>
        )}
      </div>
    </div>
  );
}
