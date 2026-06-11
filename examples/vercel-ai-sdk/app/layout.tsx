import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'askable-ui + Vercel AI SDK',
  description: 'AI that knows what you are looking at',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f0f12', color: '#e2e8f0' }}>
        {children}
      </body>
    </html>
  );
}
