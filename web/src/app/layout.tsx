import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import { ToastProvider } from '@/components/ToastProvider';

export const metadata: Metadata = {
  title: 'EdgePulse — Clinical Telemetry',
  description: 'Real-time physiological telemetry analytics · Kafka + Spark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-slate-950">
        <ToastProvider>
          <Navbar />
          <main className="pt-16">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
