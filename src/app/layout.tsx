import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { AvisoDemo } from '@/components/ui/AvisoDemo';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Diagnóstico de energia para fazendas',
  description:
    'Descubra em 2 minutos quanto sua fazenda pode economizar por mês com um sistema de baterias.',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#047857',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-8">
          <AvisoDemo />
          <main className="flex-1">{children}</main>

          <footer className="mt-12 border-t border-stone-200 pt-5 text-sm text-stone-500">
            <nav className="flex gap-4">
              <Link href="/privacidade" className="underline">
                Privacidade
              </Link>
              <Link href="/meus-dados" className="underline">
                Meus dados
              </Link>
            </nav>
          </footer>
        </div>
      </body>
    </html>
  );
}
