import type { Metadata, Viewport } from 'next'
import { Antonio, IBM_Plex_Mono } from 'next/font/google'

import { Backdrop } from '@/components/backdrop'
import { siteConfig } from '@/lib/site'

import './globals.css'

const display = Antonio({
  variable: '--font-antonio',
  subsets: ['latin'],
  weight: ['500', '700'],
})

const mono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#07080c',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-GB" className={`${display.variable} ${mono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <Backdrop />
        {children}
      </body>
    </html>
  )
}
