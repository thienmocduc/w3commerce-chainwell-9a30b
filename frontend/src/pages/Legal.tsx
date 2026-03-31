import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '@hooks/useI18n';
import legalData from '@data/legal-content.json';

type DocType = 'tos' | 'privacy';
type Role = 'buyer' | 'koc' | 'vendor' | 'general';

const DOC_TITLES: Record<string, Record<string, string>> = {
  tos_general: { vi: 'Điều khoản Dịch vụ Chung', en: 'General Terms of Service', zh: '通用服务条款', th: 'ข้อกำหนดการใช้บริการทั่วไป', hi: 'सामान्य सेवा की शर्तें' },
  tos_buyer: { vi: 'Điều khoản Dịch vụ — Người mua', en: 'Terms of Service — Buyer', zh: '服务条款 — 买家', th: 'ข้อกำหนด — ผู้ซื้อ', hi: 'सेवा की शर्तें — खरीदार' },
  tos_koc: { vi: 'Điều khoản Dịch vụ — KOC/KOL', en: 'Terms of Service — KOC/KOL', zh: '服务条款 — KOC/KOL', th: 'ข้อกำหนด — KOC/KOL', hi: 'सेवा की शर्तें — KOC/KOL' },
  tos_vendor: { vi: 'Điều khoản Dịch vụ — Vendor', en: 'Terms of Service — Vendor', zh: '服务条款 — 供应商', th: 'ข้อกำหนด — ผู้ขาย', hi: 'सेवा की शर्तें — विक्रेता' },
  privacy_buyer: { vi: 'Chính sách Bảo mật — Người mua', en: 'Privacy Policy — Buyer', zh: '隐私政策 — 买家', th: 'นโยบายความเป็นส่วนตัว — ผู้ซื้อ', hi: 'गोपनीयता नीति — खरीदार' },
  privacy_koc: { vi: 'Chính sách Bảo mật — KOC/KOL', en: 'Privacy Policy — KOC/KOL', zh: '隐私政策 — KOC/KOL', th: 'นโยบายความเป็นส่วนตัว — KOC/KOL', hi: 'गोपनीयता नीति — KOC/KOL' },
  privacy_vendor: { vi: 'Chính sách Bảo mật — Vendor', en: 'Privacy Policy — Vendor', zh: '隐私政策 — 供应商', th: 'นโยบายความเป็นส่วนตัว — ผู้ขาย', hi: 'गोपनीयता नीति — विक्रेता' },
};

function formatContent(raw: string): string[] {
  // Split into paragraphs at "ĐIỀU", "MỤC", or double spaces before caps
  return raw.split(/(?=ĐIỀU \d|MỤC \d|📌|⚠|🔒|⛓)/).filter(p => p.trim().length > 0);
}

export default function Legal() {
  const { locale } = useI18n();
  const [params] = useSearchParams();
  const docParam = params.get('doc') || 'tos';
  const roleParam = (params.get('role') || 'general') as Role;

  const [docType, setDocType] = useState<DocType>(docParam === 'privacy' ? 'privacy' : 'tos');
  const [role, setRole] = useState<Role>(roleParam);

  const getDocKey = (): string => {
    if (docType === 'tos' && role === 'general') return 'tos_general';
    return `${docType}_${role === 'general' ? 'buyer' : role}`;
  };

  const docKey = getDocKey();
  const content = (legalData as Record<string, string>)[docKey] || '';
  const title = DOC_TITLES[docKey]?.[locale] || DOC_TITLES[docKey]?.vi || docKey;
  const paragraphs = formatContent(content);

  return (
    <section style={{ minHeight: '100vh', background: 'var(--bg-0)', padding: '32px 24px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span className="section-badge" style={{ marginBottom: 12, display: 'inline-block' }}>Legal</span>
          <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, color: 'var(--text-1)', marginBottom: 8 }}>{title}</h1>
          <p style={{ color: 'var(--text-3)', fontSize: '.88rem' }}>WellKOC Platform — Công ty TNHH WellKOC Việt Nam</p>
        </div>

        {/* Tab: TOS / Privacy */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 16, padding: 4, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-card)', maxWidth: 400, margin: '0 auto 16px' }}>
          {([['tos', 'Điều khoản DV'], ['privacy', 'Chính sách BM']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setDocType(key as DocType)} style={{ flex: 1, padding: '8px 14px', borderRadius: 8, border: 'none', background: docType === key ? 'var(--chakra-flow)' : 'transparent', color: docType === key ? '#fff' : 'var(--text-3)', fontSize: '.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all .2s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Role */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 32, padding: 4, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-card)', maxWidth: 520, margin: '0 auto 32px' }}>
          {([
            ['general', 'Chung', '📋'],
            ['buyer', 'Người mua', '🛒'],
            ['koc', 'KOC/KOL', '⭐'],
            ['vendor', 'Vendor', '🏪'],
          ] as const).map(([key, label, icon]) => (
            <button key={key} onClick={() => setRole(key as Role)} style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
              background: role === key ? 'var(--surface-hover)' : 'transparent',
              color: role === key ? 'var(--text-1)' : 'var(--text-3)',
              fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="card" style={{ padding: '32px 28px', borderRadius: 16, lineHeight: 1.8, fontSize: '.88rem', color: 'var(--text-2)' }}>
          {paragraphs.map((p, i) => {
            const isHeader = /^(ĐIỀU|MỤC|📌|⚠|🔒|⛓)/.test(p.trim());
            return (
              <div key={i} style={{ marginBottom: isHeader ? 24 : 12 }}>
                {isHeader ? (
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                    {p.trim().split('.')[0]}{p.includes('.') ? '.' : ''}
                  </h3>
                ) : null}
                <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {isHeader ? p.trim().substring(p.indexOf('.') + 1).trim() : p.trim()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: '.75rem', color: 'var(--text-4)' }}>
          Công ty TNHH WellKOC Việt Nam · 35 Thái Phiên, Hải Châu, Đà Nẵng · legal@wellkoc.com
        </div>
      </div>
    </section>
  );
}
