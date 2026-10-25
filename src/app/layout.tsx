import type { Metadata } from 'next'
import { Sarabun } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import './globals.css'

const sarabun = Sarabun({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  variable: '--font-sarabun',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ระบบควบคุมงานก่อสร้าง',
  description: 'ระบบบริหารจัดการโครงการก่อสร้างแบบครบวงจร | Construction Management System',
}

import { AmbientBackdrop } from '@/components/architect/AmbientBackdrop'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th" suppressHydrationWarning className={sarabun.variable}>
      <head>
        {/* Prevent dark/light flash on first load - Default to Executive Light Mode */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'light';document.documentElement.classList.toggle('dark',t==='dark')}catch(e){document.documentElement.classList.remove('dark')}})()`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased relative" suppressHydrationWarning>
        <ThemeProvider>
          <AmbientBackdrop />
          <div className="relative z-10 flex flex-col min-h-screen">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
