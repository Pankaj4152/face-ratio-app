"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import {
  POINTS,
  RatioResult,
  scoreRatios,
  FaceShapeResult,
  classifyFaceShape,
  FACE_SHAPE_CONTOUR_INDICES,
  Landmark,
} from "@/lib/landmarks";

type Status = "loading" | "ready" | "error";
type ActiveTab = "shape" | "goldenRatio" | "makeup" | "semantic";

export default function FaceRatioAnalyzer() {
  const [status, setStatus] = useState<Status>("loading");
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [results, setResults] = useState<RatioResult[] | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [faceShape, setFaceShape] = useState<FaceShapeResult | null>(null);
  const [noFace, setNoFace] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("shape");

  // Canvas visual toggles
  const [showWireframe, setShowWireframe] = useState(true);
  const [showThirdsLines, setShowThirdsLines] = useState(true);
  const [showKeyPoints, setShowKeyPoints] = useState(true);
  const [showFullMesh, setShowFullMesh] = useState(false);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentImageRef = useRef<HTMLImageElement | null>(null);
  const currentLandmarksRef = useRef<Landmark[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "IMAGE",
          numFaces: 1,
        });
        if (!cancelled) {
          landmarkerRef.current = landmarker;
          setStatus("ready");
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
    };
  }, []);

  const drawVisuals = useCallback(
    (landmarks: Landmark[], w: number, h: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      // 1. Faint full mesh (optional)
      if (showFullMesh) {
        ctx.fillStyle = "rgba(156, 122, 61, 0.22)";
        const r = Math.max(1, w / 450);
        for (const p of landmarks) {
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Face Shape Contour Wireframe
      if (showWireframe) {
        ctx.beginPath();
        const indices = FACE_SHAPE_CONTOUR_INDICES;
        const first = landmarks[indices[0]];
        ctx.moveTo(first.x * w, first.y * h);
        for (let i = 1; i < indices.length; i++) {
          const pt = landmarks[indices[i]];
          ctx.lineTo(pt.x * w, pt.y * h);
        }
        ctx.closePath();
        ctx.strokeStyle = "rgba(184, 134, 11, 0.75)"; // Brass golden line
        ctx.lineWidth = Math.max(2, w / 260);
        ctx.stroke();
        ctx.fillStyle = "rgba(184, 134, 11, 0.08)";
        ctx.fill();

        // Horizontal measurement axis: Forehead, Cheekbone, Jawline
        const drawHLine = (p1Idx: number, p2Idx: number, color: string) => {
          const p1 = landmarks[p1Idx];
          const p2 = landmarks[p2Idx];
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.moveTo(p1.x * w, p1.y * h);
          ctx.lineTo(p2.x * w, p2.y * h);
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(1.5, w / 350);
          ctx.stroke();
          ctx.setLineDash([]);
        };

        // Forehead width line (103 - 332)
        drawHLine(103, 332, "rgba(70, 130, 180, 0.75)");
        // Cheekbone width line (234 - 454)
        drawHLine(234, 454, "rgba(184, 134, 11, 0.85)");
        // Jaw width line (172 - 397)
        drawHLine(172, 397, "rgba(205, 92, 92, 0.75)");
      }

      // 3. Facial Thirds reference lines
      if (showThirdsLines) {
        const thirdsPoints = [
          { idx: POINTS.foreheadTop, label: "Trichion (Hairline)" },
          { idx: POINTS.glabella, label: "Glabella (Brow)" },
          { idx: POINTS.noseBase, label: "Subnasale (Nose base)" },
          { idx: POINTS.chin, label: "Menton (Chin tip)" },
        ];

        ctx.font = `${Math.max(11, Math.round(w / 45))}px serif`;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.strokeStyle = "rgba(38, 66, 94, 0.6)";
        ctx.lineWidth = Math.max(1.2, w / 400);

        for (const tp of thirdsPoints) {
          const p = landmarks[tp.idx];
          const y = p.y * h;
          ctx.beginPath();
          ctx.setLineDash([3, 5]);
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
          ctx.setLineDash([]);

          // Shadowed text label
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillText(tp.label, 12, y - 5);
          ctx.fillStyle = "#EAE6DF";
          ctx.fillText(tp.label, 11, y - 6);
        }
      }

      // 4. Highlighted anchor landmarks
      if (showKeyPoints) {
        const used = Array.from(new Set(Object.values(POINTS)));
        const rBig = Math.max(3, w / 160);
        for (const idx of used) {
          const p = landmarks[idx];
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, rBig, 0, Math.PI * 2);
          ctx.fillStyle = "#26425E";
          ctx.fill();
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = Math.max(1, w / 400);
          ctx.stroke();
        }
      }
    },
    [showWireframe, showThirdsLines, showKeyPoints, showFullMesh]
  );

  const runDetection = useCallback(
    (img: HTMLImageElement) => {
      const landmarker = landmarkerRef.current;
      const canvas = canvasRef.current;
      if (!landmarker || !canvas) return;

      currentImageRef.current = img;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const result = landmarker.detect(img);
      if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
        setNoFace(true);
        setResults(null);
        setScore(null);
        setFaceShape(null);
        currentLandmarksRef.current = null;
        return;
      }

      setNoFace(false);
      const landmarks = result.faceLandmarks[0];
      currentLandmarksRef.current = landmarks;

      // 1. Classical Golden Ratio Scores
      const { rows, overallScore } = scoreRatios(
        landmarks,
        canvas.width,
        canvas.height
      );
      setResults(rows);
      setScore(overallScore);

      // 2. Part 1 Anthropometric Face Shape Classification
      const classifiedShape = classifyFaceShape(
        landmarks,
        canvas.width,
        canvas.height
      );
      setFaceShape(classifiedShape);

      // 3. Render Canvas Overlays
      drawVisuals(landmarks, canvas.width, canvas.height);
    },
    [drawVisuals]
  );

  // Redraw overlays when canvas toggles change
  useEffect(() => {
    if (
      currentLandmarksRef.current &&
      currentImageRef.current &&
      canvasRef.current
    ) {
      drawVisuals(
        currentLandmarksRef.current,
        currentImageRef.current.naturalWidth,
        currentImageRef.current.naturalHeight
      );
    }
  }, [drawVisuals]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setImgSrc(url);

    const img = new Image();
    img.onload = () => runDetection(img);
    img.src = url;
  }

  return (
    <div className="grid lg:grid-cols-[55%_45%] gap-8 items-start">
      {/* LEFT: Image & Canvas with Interactive Visual Toggles */}
      <div className="space-y-4">
        <div className="relative bg-panel border border-line rounded-lg overflow-hidden shadow-sm">
          {imgSrc ? (
            <div className="relative w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt="Uploaded face preview"
                className="w-full block object-contain max-h-[620px] bg-black/5"
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            </div>
          ) : (
            <div className="aspect-[4/3] flex flex-col items-center justify-center text-ink/40 text-sm p-8 text-center border-2 border-dashed border-line/70 m-4 rounded-lg">
              <svg
                className="w-12 h-12 mb-3 text-ink/30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-medium text-ink/60 mb-1">
                Upload a front-facing portrait photo
              </span>
              <span className="text-xs text-ink/40 max-w-xs">
                Photos are analyzed entirely in your browser using MediaPipe FaceMesh. No images are sent to any external server.
              </span>
            </div>
          )}
        </div>

        {/* Visual Controls / Overlay Toggles */}
        {imgSrc && (
          <div className="bg-panel border border-line rounded-lg p-3 px-4 text-xs flex flex-wrap items-center gap-4 text-ink/80">
            <span className="font-semibold text-ink/60 uppercase tracking-wider text-[10px]">
              Overlays:
            </span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showWireframe}
                onChange={(e) => setShowWireframe(e.target.checked)}
                className="rounded text-brass focus:ring-brass"
              />
              <span>Face Contour</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showThirdsLines}
                onChange={(e) => setShowThirdsLines(e.target.checked)}
                className="rounded text-brass focus:ring-brass"
              />
              <span>Facial Thirds</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showKeyPoints}
                onChange={(e) => setShowKeyPoints(e.target.checked)}
                className="rounded text-brass focus:ring-brass"
              />
              <span>Feature Points</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showFullMesh}
                onChange={(e) => setShowFullMesh(e.target.checked)}
                className="rounded text-brass focus:ring-brass"
              />
              <span>Full Mesh (468)</span>
            </label>
          </div>
        )}
      </div>

      {/* RIGHT: Analysis Results & Tabs */}
      <div className="bg-panel border border-line rounded-lg p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span className="text-sm font-medium bg-ink text-paper px-4 py-2 rounded shadow hover:bg-ink/90 transition-colors">
                {imgSrc ? "Change Photo" : "Upload Face Photo"}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFile}
                disabled={status !== "ready"}
                className="hidden"
              />
            </label>
            <p className="text-xs text-ink/50 mt-1.5">
              {status === "loading" && "Initializing MediaPipe ML model…"}
              {status === "ready" && "Client ML engine ready"}
              {status === "error" &&
                "Model failed to load — check your connection"}
            </p>
          </div>

          {faceShape && (
            <div className="text-right">
              <span className="text-xs text-ink/50 uppercase tracking-widest font-semibold block">
                Primary Shape
              </span>
              <span className="font-serif text-2xl font-bold text-brass">
                {faceShape.primaryShape}
              </span>
              <span className="text-xs text-ink/60 ml-1.5">
                ({faceShape.confidence}% fit)
              </span>
            </div>
          )}
        </div>

        {noFace && (
          <div className="p-4 rounded bg-red-50 text-red-800 text-sm border border-red-200">
            <strong>No face detected.</strong> Please upload a clearer front-facing photo with direct lighting and visible forehead and chin.
          </div>
        )}

        {faceShape && results && (
          <div>
            {/* Navigation Tabs */}
            <div className="flex border-b border-line mb-5 gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveTab("shape")}
                className={`text-xs font-semibold px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === "shape"
                    ? "border-brass text-brass"
                    : "border-transparent text-ink/60 hover:text-ink"
                }`}
              >
                Face Shape Details
              </button>
              <button
                onClick={() => setActiveTab("makeup")}
                className={`text-xs font-semibold px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === "makeup"
                    ? "border-brass text-brass"
                    : "border-transparent text-ink/60 hover:text-ink"
                }`}
              >
                Styling & Makeup Guide
              </button>
              <button
                onClick={() => setActiveTab("goldenRatio")}
                className={`text-xs font-semibold px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === "goldenRatio"
                    ? "border-brass text-brass"
                    : "border-transparent text-ink/60 hover:text-ink"
                }`}
              >
                Golden Ratio (φ)
              </button>
              <button
                onClick={() => setActiveTab("semantic")}
                className={`text-xs font-semibold px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === "semantic"
                    ? "border-brass text-brass"
                    : "border-transparent text-ink/60 hover:text-ink"
                }`}
              >
                Semantic Retrieval Query
              </button>
            </div>

            {/* TAB 1: FACE SHAPE CLASSIFICATION */}
            {activeTab === "shape" && (
              <div className="space-y-5">
                <div className="bg-paper p-4 rounded-md border border-line">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-serif text-lg font-bold text-ink">
                      {faceShape.primaryShape} Face Profile
                    </h3>
                    {faceShape.secondaryShape && (
                      <span className="text-xs text-ink/60 bg-panel px-2 py-1 rounded border border-line">
                        Secondary: {faceShape.secondaryShape} (
                        {faceShape.shapeScores[faceShape.secondaryShape]}%)
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink/75 leading-relaxed">
                    {faceShape.description}
                  </p>
                </div>

                {/* Anthropometric Ratios Grid */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink/60 mb-3">
                    Anthropometric Ratios & Angles
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-paper rounded border border-line/80">
                      <span className="text-ink/60 block">Face Length / Cheek Width</span>
                      <span className="font-semibold text-sm tabular-nums text-ink">
                        {faceShape.ratios.lengthToWidth}
                      </span>
                      <span className="text-[10px] text-ink/40 block mt-0.5">
                        Target φ ≈ 1.618
                      </span>
                    </div>

                    <div className="p-3 bg-paper rounded border border-line/80">
                      <span className="text-ink/60 block">Forehead / Cheekbone</span>
                      <span className="font-semibold text-sm tabular-nums text-ink">
                        {faceShape.ratios.foreheadToCheek}
                      </span>
                      <span className="text-[10px] text-ink/40 block mt-0.5">
                        Temple margin comparison
                      </span>
                    </div>

                    <div className="p-3 bg-paper rounded border border-line/80">
                      <span className="text-ink/60 block">Jaw Width / Cheekbone</span>
                      <span className="font-semibold text-sm tabular-nums text-ink">
                        {faceShape.ratios.jawToCheek}
                      </span>
                      <span className="text-[10px] text-ink/40 block mt-0.5">
                        Mandibular taper index
                      </span>
                    </div>

                    <div className="p-3 bg-paper rounded border border-line/80">
                      <span className="text-ink/60 block">Jawline Apex Angle</span>
                      <span className="font-semibold text-sm tabular-nums text-ink">
                        {faceShape.ratios.jawAngleDeg}°
                      </span>
                      <span className="text-[10px] text-ink/40 block mt-0.5">
                        Chin apex angularity
                      </span>
                    </div>
                  </div>
                </div>

                {/* Geometric Observations */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink/60 mb-2">
                    Key Geometric Observations
                  </h4>
                  <ul className="space-y-1.5 text-xs text-ink/70">
                    {faceShape.characteristics.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-brass font-bold">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Candidate Probability Distribution */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink/60 mb-2.5">
                    Shape Fit Distribution (%)
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(faceShape.shapeScores)
                      .sort(([, a], [, b]) => b - a)
                      .map(([shape, conf]) => (
                        <div key={shape} className="flex items-center gap-3 text-xs">
                          <span className="w-20 font-medium text-ink/70 truncate">
                            {shape}
                          </span>
                          <div className="flex-1 bg-paper h-2 rounded-full overflow-hidden border border-line/60">
                            <div
                              className={`h-full rounded-full ${
                                shape === faceShape.primaryShape
                                  ? "bg-brass"
                                  : "bg-ink/30"
                              }`}
                              style={{ width: `${conf}%` }}
                            />
                          </div>
                          <span className="w-8 text-right font-mono text-[11px] text-ink/60">
                            {conf}%
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MAKEUP & STYLING GUIDE (Doc 1 Requirement) */}
            {activeTab === "makeup" && (
              <div className="space-y-4">
                <div className="bg-paper p-4 rounded-md border border-line">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-brass block mb-1">
                    Styling Strategy
                  </span>
                  <p className="text-sm font-medium text-ink">
                    {faceShape.recommendation.summary}
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-paper rounded border border-line">
                    <span className="font-semibold text-ink block mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-700"></span>
                      Contour Placement Technique
                    </span>
                    <p className="text-ink/75 leading-relaxed">
                      {faceShape.recommendation.contouring}
                    </p>
                  </div>

                  <div className="p-3 bg-paper rounded border border-line">
                    <span className="font-semibold text-ink block mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      Blush Direction & Placement
                    </span>
                    <p className="text-ink/75 leading-relaxed">
                      {faceShape.recommendation.blush}
                    </p>
                  </div>

                  <div className="p-3 bg-paper rounded border border-line">
                    <span className="font-semibold text-ink block mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                      Highlighter Strategy
                    </span>
                    <p className="text-ink/75 leading-relaxed">
                      {faceShape.recommendation.highlighter}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink/60 mb-2">
                    Recommended Product Categories (Doc 1 Specification)
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {faceShape.recommendation.suitableProducts.map((p, i) => (
                      <span
                        key={i}
                        className="text-xs bg-paper border border-line px-2.5 py-1 rounded text-ink/80 font-medium"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: GOLDEN RATIO MEASUREMENTS */}
            {activeTab === "goldenRatio" && (
              <div className="space-y-4">
                <div className="flex items-baseline justify-between border-b border-line pb-4">
                  <span className="font-serif text-4xl text-brass">{score}</span>
                  <span className="text-xs text-ink/50 max-w-[150px] text-right">
                    out of 100 — average closeness to φ across facial features
                  </span>
                </div>
                <div className="space-y-3">
                  {results.map((r) => (
                    <div
                      key={r.label}
                      className="flex justify-between items-center text-xs border-b border-line/60 pb-2.5"
                    >
                      <div>
                        <span className="text-ink font-medium block">
                          {r.label}
                        </span>
                        <span className="text-[10px] text-ink/40">
                          Target: {r.target.toFixed(3)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-semibold tabular-nums text-sm ${
                            r.isClose ? "text-brass" : "text-ink"
                          }`}
                        >
                          {r.value.toFixed(3)}
                        </span>
                        <span className="text-[10px] block text-ink/50">
                          {r.isClose ? "Close to φ" : "Deviation noted"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: SEMANTIC SEARCH VOCABULARY (Doc 2 Part 2 Preview) */}
            {activeTab === "semantic" && (
              <div className="space-y-4">
                <div className="bg-paper p-4 rounded-md border border-line text-xs">
                  <h4 className="font-bold text-ink mb-1 text-sm">
                    Ratio-to-Keyword Semantic Mapping (Part 2)
                  </h4>
                  <p className="text-ink/70 leading-relaxed">
                    According to the <strong>FaceSemantic</strong> architecture, facial geometry is mapped into transparent semantic keywords used as query embeddings in Apache Spark & SBERT for product retrieval.
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink/60 block mb-2">
                    Generated Retrieval Keywords:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {faceShape.semanticKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="bg-brass/10 border border-brass/30 text-brass text-xs font-mono px-3 py-1 rounded"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-paper rounded border border-line text-xs text-ink/60 font-mono">
                  <span className="text-[10px] text-ink/40 block mb-1 uppercase">
                    Constructed Dense Query String:
                  </span>
                  &ldquo;{faceShape.primaryShape.toLowerCase()} face shape makeup, {faceShape.semanticKeywords.join(", ")}&rdquo;
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
