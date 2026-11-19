import FaceRatioAnalyzer from "@/components/FaceRatioAnalyzer";

export default function Home() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-10 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brass/10 border border-brass/25 text-brass text-xs font-medium">
              <span>Facial Geometry (468 Mesh)</span>
              <span>•</span>
              <span>φ ≈ 1.618</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-400 text-xs font-medium">
              <span>SBERT + FAISS Vector Retrieval</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-medium">
              <span>Skin Tone & Regimen Assessment</span>
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl leading-tight mb-3 font-semibold text-ink">
            Facial Geometry, Skin Health & Semantic Recommendation System
          </h1>
          <p className="text-ink/75 text-sm sm:text-base leading-relaxed">
            Real-time anthropometric analysis combining in-browser MediaPipe 468-point facial mesh geometry, Golden Ratio (<span className="font-serif italic">φ</span>) symmetry scoring, computer-vision skin tone & T-zone shine assessment, and dense vector semantic product retrieval.
          </p>
        </header>

        <FaceRatioAnalyzer />

        <footer className="mt-16 pt-8 border-t border-line text-xs text-ink/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>
            AI-Based Facial Analysis & Semantic Product Retrieval System • MediaPipe FaceMesh & Next.js
          </p>
          <p className="italic text-ink/40">
            Facial ratios and shapes are used as styling references rather than measures of attractiveness.
          </p>
        </footer>
      </div>
    </main>
  );
}
