import Link from 'next/link';
import {
  FileText,
  Sparkles,
  Volume2,
  Zap,
  ShieldCheck,
  BookOpen,
  GraduationCap,
  Microscope,
  Briefcase,
  Headphones,
  ArrowRight,
  Gauge,
  Database,
  Cpu
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Header Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/25 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950/40 rounded-[10px] flex items-center justify-center">
                <FileText className="w-5 h-5 text-indigo-300" />
              </div>
            </div>
            <span className="font-bold text-xl tracking-tight text-white">
              PDF Reader <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
            >
              <span>Launch App</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-28 px-6 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-indigo-600/20 to-purple-600/20 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>AI-Powered PDF Chat & Natural Voice Assistant</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-100 tracking-tight leading-tight">
            Read, Understand & <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-200 bg-clip-text text-transparent">Listen to PDFs</span> Naturally
          </h1>

          <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Convert static PDFs into an interactive AI assistant. Upload documents up to 50MB, view side-by-side with RAG Q&A, and listen using real-time Text-to-Speech with live speed adjustments.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 flex items-center gap-2"
            >
              <span>Open PDF Assistant</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Target Audience Cards */}
      <section className="py-16 bg-slate-900/50 border-y border-slate-800 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-100">Tailored for Knowledge Workers</h2>
            <p className="text-xs text-slate-400 mt-2">Accelerate document review across study, research, and technical workflows.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-200">Students</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Faster learning, hands-free study sessions, and quick concept breakdowns from long study materials.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
                <Microscope className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-200">Researchers</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Instant fact retrieval, multi-page paper analysis, and precise page citations from dense academic journals.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-200">Professionals</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Rapid document review for contracts, financial reports, and technical manuals under tight deadlines.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
                <Headphones className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-200">Audio Listeners</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Convert reading into an immersive voice experience with continuous speed control and voice pickers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Specification Matrix */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-100">PDF Upload & Split Viewer</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Upload documents up to 50MB. Read side-by-side with an interactive canvas, zoom, page jump, and keyword search.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center mb-4">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-100">Vector Search & Ollama RAG</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Documents are chunked and indexed into vector embeddings. AI responds strictly based on uploaded PDF text with exact page citations.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-4">
              <Gauge className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-100">Dynamic TTS Speed Control</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Adjust speech playback speed dynamically from 0.5x to 2.5x mid-sentence without stopping or resetting position.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 py-8 px-6 text-center text-xs text-slate-500">
        <p>© 2026 PDF Reader AI. Built according to Product Requirements Document (PRD) v1.0.</p>
      </footer>
    </div>
  );
}
