import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yumna AI — your slightly cold companion',
  description: 'Ngobrol bareng Yumna, AI yang kelihatannya cuek tapi sebenarnya peduli.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
