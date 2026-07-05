import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Finanfy — seu contador pessoal',
  description: 'Assistente financeiro por conversa para quem trabalha por conta própria.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
