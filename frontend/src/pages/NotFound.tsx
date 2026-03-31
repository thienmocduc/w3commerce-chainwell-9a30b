import { Link } from 'react-router-dom';
import { useI18n } from '@hooks/useI18n';

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-0)',
      position: 'relative', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: .06; transform: scale(1); }
          50% { opacity: .12; transform: scale(1.05); }
        }
      `}</style>

      {/* Background glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute', top: '20%', left: '50%',
          transform: 'translateX(-50%)',
          width: 600, height: 400, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(99,102,241,.15) 0%, transparent 70%)',
          animation: 'glowPulse 4s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '15%', right: '10%',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(6,182,212,.08) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', top: '30%', left: '5%',
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(251,191,36,.06) 0%, transparent 70%)',
        }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '24px 16px', maxWidth: 560 }}>
        {/* Floating 404 */}
        <div style={{ animation: 'float 3s ease-in-out infinite', marginBottom: 8 }}>
          <div className="gradient-text" style={{
            fontFamily: 'var(--ff-display, system-ui)', fontWeight: 800,
            fontSize: 'clamp(5rem, 18vw, 10rem)', lineHeight: 1,
            letterSpacing: '-.02em',
          }}>
            404
          </div>
        </div>

        {/* Heading */}
        <h1 style={{
          fontFamily: 'var(--ff-display, system-ui)', fontWeight: 700,
          fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
          color: 'var(--text-1)', marginBottom: 12,
        }}>
          {t('notFound.title') || '404 - Trang không tìm thấy'}
        </h1>

        {/* Description */}
        <p style={{
          color: 'var(--text-3)', fontSize: '.92rem',
          maxWidth: 400, margin: '0 auto 32px', lineHeight: 1.7,
        }}>
          {t('notFound.desc') || 'Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển. Hãy quay lại trang chủ hoặc khám phá các sản phẩm của chúng tôi.'}
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 40, flexWrap: 'wrap' }}>
          <Link to="/" className="btn btn-primary btn-lg" style={{ textDecoration: 'none', minWidth: 160 }}>
            {t('notFound.goHome') || '← Về trang chủ'}
          </Link>
          <Link to="/marketplace" className="btn btn-secondary btn-lg" style={{ textDecoration: 'none', minWidth: 160 }}>
            {t('notFound.viewProducts') || 'Xem sản phẩm'}
          </Link>
        </div>

        {/* Quick Links card */}
        <div className="card" style={{ padding: 24, maxWidth: 400, margin: '0 auto' }}>
          <div style={{
            fontSize: '.68rem', fontWeight: 700, color: 'var(--text-4)',
            textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14,
          }}>
            {t('notFound.quickLinks') || 'Liên kết nhanh'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { to: '/hot', label: t('notFound.hotProducts') || 'Sản phẩm Hot', icon: '🔥' },
              { to: '/dashboard', label: 'Dashboard', icon: '📊' },
              { to: '/academy', label: 'KOC Academy', icon: '🎓' },
              { to: '/agents', label: '333 AI Agents', icon: '🤖' },
            ].map(link => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  padding: '10px 16px', textDecoration: 'none', color: 'var(--text-1)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--bg-2)', borderRadius: 10,
                  border: '1px solid var(--border)',
                  transition: 'border-color .2s, background .2s',
                  fontSize: '.82rem', fontWeight: 600,
                }}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-4)', fontSize: '.75rem' }}>→</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Subtle brand note */}
        <p style={{ marginTop: 28, color: 'var(--text-4)', fontSize: '.72rem' }}>
          WellKOC Web3 Ecommerce &middot; Nền tảng thương mại điện tử chuỗi khối
        </p>
      </div>
    </div>
  );
}
