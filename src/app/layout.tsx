import type { Metadata } from 'next'
import { Noto_Sans, Syne } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const notoSans = Noto_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
})

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-syne',
})

export const metadata: Metadata = {
  title: 'WellKOC — Web3 Social Commerce',
  description: 'Nền tảng thương mại cộng đồng Web3 với hoa hồng on-chain minh bạch và DPP blockchain',
  keywords: ['KOC', 'social commerce', 'affiliate', 'blockchain', 'DPP', 'Polygon'],
  openGraph: {
    title: 'WellKOC Platform',
    description: 'Web3 Social Commerce — Hoa hồng tự động on-chain',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${notoSans.variable} ${syne.variable}`}>
      <body className="font-sans bg-gray-50 text-gray-900 antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: { fontFamily: 'Noto Sans, system-ui, sans-serif', fontSize: '0.8rem' },
          }}
        />
      </body>
    </html>
  )
}
