import FaceRatioAnalyzer from "@/components/FaceRatioAnalyzer";

export default function Home() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brass/10 border border-brass/25 text-brass text-xs font-medium mb-3">
            <span>Part 1: In-Browser Facial Geometry & Shape Classification</span>
            <span>•</span>
            <span>φ ≈ 1.618</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl leading-tight mb-3 font-semibold text-ink">
            Facial Proportion Analysis & Shape Classification
          </h1>
          <p className="text-ink/75 text-sm sm:text-base leading-relaxed">
            Upload a front-facing portrait. MediaPipe FaceMesh detects 468 landmark points in real-time, measures facial thirds, calculates Golden Ratio proportions, classifies your anthropometric face shape, and suggests personalized makeup techniques.
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
