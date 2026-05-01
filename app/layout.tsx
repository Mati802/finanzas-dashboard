import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Ticker } from '@/components/layout/Ticker';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Toaster } from '@/components/ui/toaster';
import { AssistantPanel } from '@/components/ai/AssistantPanel';
import { isAssistantEnabled } from '@/lib/ai/client';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Finanzas',
  description: 'Panel de finanzas personales',
};

// Necesitamos rendering dinámico porque isAssistantEnabled() lee
// ANTHROPIC_API_KEY en runtime. Si Next pre-renderiza el layout en build time,
// queda cacheado el valor que hubiera en ese momento (típicamente "").
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const aiEnabled = isAssistantEnabled();
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-bg text-fg">
        <QueryProvider>
          <Ticker />
          <div className="grid grid-cols-[200px_1fr]">
            <Sidebar />
            <main className="min-h-[calc(100vh-42px)] p-6">{children}</main>
          </div>
          <AssistantPanel enabled={aiEnabled} />
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
