import type { Metadata, Viewport } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

const outfit = Outfit({ 
  subsets: ['latin'],
  variable: '--font-outfit',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#090d16',
};

export const metadata: Metadata = {
  title: 'PDF Reader AI - Smart Document Assistant & Audio Player',
  description: 'Upload PDFs, search document content using AI, interact via side-by-side chat, and listen to natural text-to-speech voice narration with live speed control.',
  keywords: ['PDF Reader', 'AI Document Assistant', 'Text to Speech', 'RAG', 'FAISS', 'Ollama', 'PDF Chat'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PDF Reader AI',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${outfit.variable}`}>
      <body className="min-h-[100dvh] bg-slate-950 font-sans antialiased text-slate-100 flex flex-col overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
