import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'WACrm Pro — WhatsApp Marketing & CRM Platform',
  description: 'Premium WhatsApp Marketing, CRM, and Lead Management platform for modern businesses. Send campaigns, manage leads, and grow with AI.',
  keywords: ['WhatsApp CRM', 'WhatsApp Marketing', 'Lead Management', 'CRM India', 'WhatsApp Automation'],
  openGraph: {
    title: 'WACrm Pro',
    description: 'Premium WhatsApp Marketing & CRM Platform',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
