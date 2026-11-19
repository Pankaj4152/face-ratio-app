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
import {
  fetchSemanticMapping,
  RatioMappingResponse,
} from "@/lib/api";
import ProductRecommendations from "@/components/ProductRecommendations";
import SkinAssessmentModule from "@/components/SkinAssessmentModule";
import { analyzeSkinFromCanvas, SkinAnalysisResult } from "@/lib/skinAnalysis";

type Status = "loading" | "ready" | "error";
export type ActiveTab = "shape" | "skin" | "products" | "makeup" | "goldenRatio" | "semantic";

interface FaceRatioAnalyzerProps {
  externalTab?: ActiveTab;
  onTabChange?: (tab: ActiveTab) => void;
  externalUploadTrigger?: number;
}

export default function FaceRatioAnalyzer({
  externalTab,
  onTabChange,
  externalUploadTrigger,
}: FaceRatioAnalyzerProps = {}) {
  const [status, setStatus] = useState<Status>("loading");
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [results, setResults] = useState<RatioResult[] | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [faceShape, setFaceShape] = useState<FaceShapeResult | null>(null);
  const [skinAnalysis, setSkinAnalysis] = useState<SkinAnalysisResult | null>(null);
  const [noFace, setNoFace] = useState(false);
  const [internalTab, setInternalTab] = useState<ActiveTab>("shape");

  const activeTab = externalTab || internalTab;
  const setActiveTab = (tab: ActiveTab) => {
    setInternalTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  // Part 2: FastAPI Semantic Backend State
  const [backendResult, setBackendResult] = useState<RatioMappingResponse | null>(null);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Canvas visual toggles
  const [showWireframe, setShowWireframe] = useState(true);
  const [showThirdsLines, setShowThirdsLines] = useState(true);
  const [showKeyPoints, setShowKeyPoints] = useState(true);
  const [showFullMesh, setShowFullMesh] = useState(false);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentImageRef = useRef<HTMLImageElement | null>(null);
  const currentLandmarksRef = useRef<Landmark[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle external upload triggers
  useEffect(() => {
    if (externalUploadTrigger && externalUploadTrigger > 0) {
      fileInputRef.current?.click();
    }
  }, [externalUploadTrigger]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        let landmarker: FaceLandmarker;
        try {
          landmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "CPU",
            },
            runningMode: "IMAGE",
            numFaces: 1,
          });
        } catch (initErr) {
          console.warn("Model initialization retry with CPU...", initErr);
          landmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "CPU",
            },
            runningMode: "IMAGE",
            numFaces: 1,
          });
        }

        if (!cancelled) {
          landmarkerRef.current = landmarker;
          setStatus("ready");
        }
      } catch (err) {
        console.error("Failed to load FaceLandmarker:", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const drawVisuals = useCallback(
    (landmarks: Landmark[], width: number, height: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = currentImageRef.current;
      if (img) {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      }

      // 1. Draw Full 468 Mesh
      if (showFullMesh) {
        ctx.fillStyle = "rgba(255, 56, 92, 0.4)";
        for (let i = 0; i < landmarks.length; i++) {
          const pt = landmarks[i];
          ctx.beginPath();
          ctx.arc(pt.x * width, pt.y * height, 1, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // 2. Draw Anthropometric Contour Wireframe
      if (showWireframe) {
        ctx.strokeStyle = "#ff385c"; // Airbnb Rausch
        ctx.lineWidth = 2.5;
        ctx.lineJoin = "round";
        ctx.beginPath();
        for (let i = 0; i < FACE_SHAPE_CONTOUR_INDICES.length; i++) {
          const idx = FACE_SHAPE_CONTOUR_INDICES[i];
          const pt = landmarks[idx];
          if (!pt) continue;
          const x = pt.x * width;
          const y = pt.y * height;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 56, 92, 0.06)";
        ctx.fill();
      }

      // 3. Draw Facial Thirds Horizontal Dividers
      if (showThirdsLines) {
        const trichion = landmarks[POINTS.foreheadTop] || landmarks[10];
        const glabella = landmarks[POINTS.glabella] || landmarks[168];
        const subnasale = landmarks[POINTS.noseBase] || landmarks[2];
        const menton = landmarks[POINTS.chin] || landmarks[152];

        const lines = [
          { y: trichion.y * height, label: "Trichion (Hairline)" },
          { y: glabella.y * height, label: "Glabella (Eyebrow)" },
          { y: subnasale.y * height, label: "Subnasale (Nose base)" },
          { y: menton.y * height, label: "Menton (Chin tip)" },
        ];

        ctx.strokeStyle = "rgba(34, 34, 34, 0.75)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        lines.forEach((l) => {
          ctx.beginPath();
          ctx.moveTo(width * 0.05, l.y);
          ctx.lineTo(width * 0.95, l.y);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.font = "bold 10px Circular, sans-serif";
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          const textWidth = ctx.measureText(l.label).width;
          ctx.fillRect(width * 0.05, l.y - 12, textWidth + 8, 14);

          ctx.fillStyle = "#222222";
          ctx.fillText(l.label, width * 0.05 + 4, l.y - 2);
          ctx.setLineDash([4, 4]);
        });
        ctx.setLineDash([]);
      }

      // 4. Draw Feature Anchor Points
      if (showKeyPoints) {
        const keyIndices = [
          POINTS.foreheadTop,
          POINTS.glabella,
          POINTS.noseBase,
          POINTS.chin,
          POINTS.cheekLeft,
          POINTS.cheekRight,
          POINTS.jawLeft,
          POINTS.jawRight,
          POINTS.eyeLeftOuter,
          POINTS.eyeRightOuter,
          POINTS.mouthLeft,
          POINTS.mouthRight,
        ];

        keyIndices.forEach((idx) => {
          const pt = landmarks[idx];
          if (!pt) return;
          const x = pt.x * width;
          const y = pt.y * height;

          ctx.beginPath();
          ctx.arc(x, y, 4, 0, 2 * Math.PI);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#ff385c";
          ctx.stroke();
        });
      }
    },
    [showWireframe, showThirdsLines, showKeyPoints, showFullMesh]
  );

  // Call FastAPI Semantic Backend
  const queryFastAPI = useCallback(
    async (shape: FaceShapeResult, goldenRatioScore: number | null) => {
      setBackendLoading(true);
      setBackendError(null);
      try {
        const response = await fetchSemanticMapping(shape, goldenRatioScore);
        setBackendResult(response);
      } catch (err: any) {
        console.warn("FastAPI ontology mapping unavailable:", err.message);
        setBackendError(err.message || "FastAPI connection failed");
      } finally {
        setBackendLoading(false);
      }
    },
    []
  );

  const runDetection = useCallback(
    async (img: HTMLImageElement) => {
      const landmarker = landmarkerRef.current;
      const canvas = canvasRef.current;
      if (!landmarker || !canvas) return;

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      canvas.width = w;
      canvas.height = h;

      try {
        if (typeof img.decode === "function") {
          await img.decode();
        }
      } catch (e) {
        // Fallback gracefully
      }

      let result: any = null;
      try {
        result = landmarker.detect(img);
      } catch (detectErr) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          result = landmarker.detect(canvas);
        }
      }

      if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
        setNoFace(true);
        setResults(null);
        setScore(null);
        setFaceShape(null);
        setSkinAnalysis(null);
        setBackendResult(null);
        currentLandmarksRef.current = null;
        return;
      }

      setNoFace(false);
      const landmarks = result.faceLandmarks[0];
      currentLandmarksRef.current = landmarks;

      // 1. Classical Golden Ratio Scores
      const { rows, overallScore } = scoreRatios(landmarks, w, h);
      setResults(rows);
      setScore(overallScore);

      // 2. Part 1 Anthropometric Face Shape Classification
      const classifiedShape = classifyFaceShape(landmarks, w, h);
      setFaceShape(classifiedShape);

      // 3. Part 4 Computer Vision Skin Tone & Condition Analysis
      const rawCtx = canvas.getContext("2d", { willReadFrequently: true });
      if (rawCtx) {
        rawCtx.drawImage(img, 0, 0, w, h);
        const skinMetrics = analyzeSkinFromCanvas(canvas, landmarks);
        setSkinAnalysis(skinMetrics);
      }

      // 4. Render Canvas Overlays
      drawVisuals(landmarks, w, h);

      // 5. Trigger Part 2 FastAPI Semantic Mapping
      queryFastAPI(classifiedShape, overallScore);
    },
    [drawVisuals, queryFastAPI]
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

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setImgSrc(url);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      currentImageRef.current = img;
      runDetection(img);
    };
  };

  const loadSample = (sampleUrl: string) => {
    setImgSrc(sampleUrl);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = sampleUrl;
    img.onload = () => {
      currentImageRef.current = img;
      runDetection(img);
    };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* LEFT: Photo Canvas Plate (5 Cols) */}
      <div className="lg:col-span-5 space-y-4">
        <div className="relative aspect-[3/4] w-full rounded-[14px] overflow-hidden bg-surfaceSoft border border-hairline shadow-airbnb flex items-center justify-center">
          {imgSrc ? (
            <canvas ref={canvasRef} className="w-full h-full object-contain" />
          ) : (
            <div className="text-center p-8 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-rausch/10 text-rausch flex items-center justify-center text-2xl font-bold">
                📷
              </div>
              <p className="text-sm font-semibold text-ink">
                No Portrait Selected
              </p>
              <p className="text-xs text-muted max-w-xs mx-auto">
                Upload a front-facing portrait to analyze facial thirds, bone contours, skin undertones, and semantic products.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={status !== "ready"}
                className="mt-2 text-xs px-5 py-2.5 rounded-airbnbSm bg-rausch hover:bg-rausch-active text-white font-medium transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                Upload Front Portrait
              </button>
            </div>
          )}
        </div>

        {/* Canvas Visual Toggles */}
        {imgSrc && (
          <div className="rounded-[14px] border border-hairline bg-white p-3.5 shadow-sm space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
              Wireframe Overlays
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-hairline bg-surfaceSoft cursor-pointer hover:bg-white transition text-ink font-medium">
                <input
                  type="checkbox"
                  checked={showWireframe}
                  onChange={(e) => setShowWireframe(e.target.checked)}
                  className="rounded text-rausch focus:ring-rausch"
                />
                <span>Contour Wireframe</span>
              </label>

              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-hairline bg-surfaceSoft cursor-pointer hover:bg-white transition text-ink font-medium">
                <input
                  type="checkbox"
                  checked={showThirdsLines}
                  onChange={(e) => setShowThirdsLines(e.target.checked)}
                  className="rounded text-rausch focus:ring-rausch"
                />
                <span>Facial Thirds</span>
              </label>

              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-hairline bg-surfaceSoft cursor-pointer hover:bg-white transition text-ink font-medium">
                <input
                  type="checkbox"
                  checked={showKeyPoints}
                  onChange={(e) => setShowKeyPoints(e.target.checked)}
                  className="rounded text-rausch focus:ring-rausch"
                />
                <span>Feature Points</span>
              </label>

              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-hairline bg-surfaceSoft cursor-pointer hover:bg-white transition text-ink font-medium">
                <input
                  type="checkbox"
                  checked={showFullMesh}
                  onChange={(e) => setShowFullMesh(e.target.checked)}
                  className="rounded text-rausch focus:ring-rausch"
                />
                <span>Mesh (468)</span>
              </label>
            </div>
          </div>
        )}

        {/* Sample Portraits Strip */}
        <div className="rounded-[14px] border border-hairline bg-white p-3.5 shadow-sm space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
            Or Test With Sample Portraits:
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Portrait 1", url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80" },
              { label: "Portrait 2", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80" },
              { label: "Portrait 3", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80" },
            ].map((s) => (
              <button
                key={s.label}
                onClick={() => loadSample(s.url)}
                disabled={status !== "ready"}
                className="text-xs px-3.5 py-1.5 rounded-full bg-surfaceSoft hover:bg-hairlineSoft border border-hairline text-ink font-medium transition cursor-pointer disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: Results & Tabbed Modules (7 Cols) */}
      <div className="lg:col-span-7 bg-white border border-hairline rounded-[14px] p-6 shadow-airbnb space-y-6">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-hairline">
          <div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span className="text-sm font-medium bg-rausch hover:bg-rausch-active text-white px-5 py-2.5 rounded-airbnbSm shadow-sm transition-colors cursor-pointer">
                {imgSrc ? "Change Photo" : "Upload Portrait"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                disabled={status !== "ready"}
                className="hidden"
              />
            </label>
            <p className="text-xs text-muted mt-1.5">
              {status === "loading" && "Loading MediaPipe ML Vision engine…"}
              {status === "ready" && "Ready for portrait analysis"}
              {status === "error" && "Engine initialization error"}
            </p>
          </div>

          {faceShape && (
            <div className="text-right">
              <span className="text-[11px] text-muted uppercase tracking-wider font-bold block">
                Classified Shape
              </span>
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-2xl font-bold text-ink">
                  {faceShape.primaryShape}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rausch/10 text-rausch font-bold border border-rausch/20">
                  {faceShape.confidence}% fit
                </span>
              </div>
            </div>
          )}
        </div>

        {noFace && (
          <div className="p-4 rounded-airbnbSm bg-surfaceSoft text-ink text-sm border border-hairline">
            <strong className="text-rausch">No face detected.</strong> Please upload a clearer front-facing portrait with direct lighting and visible forehead and chin.
          </div>
        )}

        {faceShape && results && (
          <div>
            {/* Airbnb Tab Switcher */}
            <div className="flex border-b border-hairline mb-6 gap-3 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setActiveTab("shape")}
                className={`text-xs font-semibold px-3 py-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === "shape"
                    ? "border-rausch text-rausch font-bold"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                Face Shape Details
              </button>

              <button
                onClick={() => setActiveTab("skin")}
                className={`text-xs font-semibold px-3 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "skin"
                    ? "border-rausch text-rausch font-bold"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <span>Skin Health & Routine</span>
                {skinAnalysis && (
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-black/20"
                    style={{ backgroundColor: skinAnalysis.hexColor }}
                    title={`Tone: ${skinAnalysis.skinTone}`}
                  />
                )}
              </button>

              <button
                onClick={() => setActiveTab("products")}
                className={`text-xs font-semibold px-3 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "products"
                    ? "border-rausch text-rausch font-bold"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <span>Recommended Products</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rausch/10 text-rausch font-bold border border-rausch/20">
                  SBERT+FAISS
                </span>
              </button>

              <button
                onClick={() => setActiveTab("makeup")}
                className={`text-xs font-semibold px-3 py-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === "makeup"
                    ? "border-rausch text-rausch font-bold"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                Styling & Placement
              </button>

              <button
                onClick={() => setActiveTab("goldenRatio")}
                className={`text-xs font-semibold px-3 py-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === "goldenRatio"
                    ? "border-rausch text-rausch font-bold"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                Golden Ratio (φ)
              </button>

              <button
                onClick={() => setActiveTab("semantic")}
                className={`text-xs font-semibold px-3 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "semantic"
                    ? "border-rausch text-rausch font-bold"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <span>Ontology & NLP Query</span>
                {backendResult && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rausch animate-pulse" />
                )}
              </button>
            </div>

            {/* TAB 1: FACE SHAPE DETAILS */}
            {activeTab === "shape" && (
              <div className="space-y-6">
                <div className="bg-surfaceSoft p-5 rounded-[14px] border border-hairline">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-ink">
                      {faceShape.primaryShape} Face Profile
                    </h3>
                    {faceShape.secondaryShape && (
                      <span className="text-xs text-muted bg-white px-3 py-1 rounded-full border border-hairline">
                        Secondary: {faceShape.secondaryShape} (
                        {faceShape.shapeScores[faceShape.secondaryShape]}%)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-body leading-relaxed">
                    {faceShape.description}
                  </p>
                </div>

                {/* Anthropometric Measurements Grid */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
                    Anthropometric Ratios
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-surfaceSoft rounded-[14px] border border-hairline">
                      <span className="text-muted block text-xs">Total Length / Bizygomatic</span>
                      <span className="font-bold text-base tabular-nums text-ink mt-0.5 block">
                        {faceShape.ratios.lengthToWidth}
                      </span>
                      <span className="text-[10px] text-muted block mt-0.5">
                        Norm: 1.35 – 1.45
                      </span>
                    </div>

                    <div className="p-3.5 bg-surfaceSoft rounded-[14px] border border-hairline">
                      <span className="text-muted block text-xs">Forehead / Cheekbone</span>
                      <span className="font-bold text-base tabular-nums text-ink mt-0.5 block">
                        {faceShape.ratios.foreheadToCheek}
                      </span>
                      <span className="text-[10px] text-muted block mt-0.5">
                        Upper third taper
                      </span>
                    </div>

                    <div className="p-3.5 bg-surfaceSoft rounded-[14px] border border-hairline">
                      <span className="text-muted block text-xs">Jaw Width / Cheekbone</span>
                      <span className="font-bold text-base tabular-nums text-ink mt-0.5 block">
                        {faceShape.ratios.jawToCheek}
                      </span>
                      <span className="text-[10px] text-muted block mt-0.5">
                        Mandibular index
                      </span>
                    </div>

                    <div className="p-3.5 bg-surfaceSoft rounded-[14px] border border-hairline">
                      <span className="text-muted block text-xs">Jawline Apex Angle</span>
                      <span className="font-bold text-base tabular-nums text-ink mt-0.5 block">
                        {faceShape.ratios.jawAngleDeg}°
                      </span>
                      <span className="text-[10px] text-muted block mt-0.5">
                        Chin apex angularity
                      </span>
                    </div>
                  </div>
                </div>

                {/* Candidate Probability Distribution */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
                    Shape Fit Distribution (%)
                  </h4>
                  <div className="space-y-2.5">
                    {Object.entries(faceShape.shapeScores)
                      .sort(([, a], [, b]) => b - a)
                      .map(([shape, conf]) => (
                        <div key={shape} className="flex items-center gap-3 text-xs">
                          <span className="w-20 font-medium text-ink truncate">
                            {shape}
                          </span>
                          <div className="flex-1 bg-surfaceSoft h-2 rounded-full overflow-hidden border border-hairline">
                            <div
                              className={`h-full rounded-full ${
                                shape === faceShape.primaryShape
                                  ? "bg-rausch"
                                  : "bg-muted/40"
                              }`}
                              style={{ width: `${conf}%` }}
                            />
                          </div>
                          <span className="w-8 text-right font-mono text-[11px] text-muted">
                            {conf}%
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SKIN ASSESSMENT & ROUTINE */}
            {activeTab === "skin" && (
              <SkinAssessmentModule
                analysis={skinAnalysis}
                faceShape={faceShape.primaryShape}
              />
            )}

            {/* TAB 3: SEMANTIC PRODUCT RECOMMENDATIONS */}
            {activeTab === "products" && (
              <ProductRecommendations
                faceShape={faceShape.primaryShape}
                denseQueryText={
                  backendResult?.semantic_dense_query ||
                  backendResult?.retrieval_query?.dense_query_text
                }
                categories={
                  backendResult?.retrieval_query?.product_categories || []
                }
              />
            )}

            {/* TAB 4: STYLING & MAKEUP GUIDE */}
            {activeTab === "makeup" && (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="p-4 bg-surfaceSoft rounded-[14px] border border-hairline">
                    <span className="font-bold text-ink block mb-1">
                      Contouring & Shading Strategy
                    </span>
                    <p className="text-xs text-body leading-relaxed">
                      {faceShape.recommendation.contouring}
                    </p>
                  </div>

                  <div className="p-4 bg-surfaceSoft rounded-[14px] border border-hairline">
                    <span className="font-bold text-ink block mb-1">
                      Blush Direction & Placement
                    </span>
                    <p className="text-xs text-body leading-relaxed">
                      {faceShape.recommendation.blush}
                    </p>
                  </div>

                  <div className="p-4 bg-surfaceSoft rounded-[14px] border border-hairline">
                    <span className="font-bold text-ink block mb-1">
                      Highlighter Strategy
                    </span>
                    <p className="text-xs text-body leading-relaxed">
                      {faceShape.recommendation.highlighter}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: GOLDEN RATIO MEASUREMENTS (Airbnb 64px Rating Display) */}
            {activeTab === "goldenRatio" && (
              <div className="space-y-6">
                {/* Signature Airbnb 64px Rating Display Card */}
                <div className="text-center py-6 border-b border-hairline">
                  <div className="flex items-center justify-center gap-4">
                    <span className="text-muted text-2xl select-none">🌿</span>
                    <span className="text-6xl font-bold tracking-tight text-ink">
                      {score}
                    </span>
                    <span className="text-muted text-2xl transform scale-x-[-1] select-none">🌿</span>
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted mt-2">
                    Golden Ratio Symmetry Score (φ ≈ 1.618)
                  </p>
                  <p className="text-xs text-mutedSoft mt-0.5">
                    Evaluated across classical horizontal & vertical anthropometric intervals
                  </p>
                </div>

                <div className="space-y-3">
                  {results.map((r) => (
                    <div
                      key={r.label}
                      className="flex justify-between items-center text-xs border-b border-hairlineSoft pb-2.5"
                    >
                      <div>
                        <span className="text-ink font-semibold block">
                          {r.label}
                        </span>
                        <span className="text-[11px] text-muted">
                          Target: {r.target.toFixed(3)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-bold tabular-nums text-sm ${
                            r.isClose ? "text-rausch" : "text-ink"
                          }`}
                        >
                          {r.value.toFixed(3)}
                        </span>
                        <span className="text-[10px] text-muted block">
                          {r.isClose ? "✓ Golden Proportion" : "Deviates"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: ONTOLOGY & NLP QUERY */}
            {activeTab === "semantic" && (
              <div className="space-y-5">
                {backendResult ? (
                  <div className="space-y-4">
                    <div className="rounded-[14px] border border-hairline bg-surfaceSoft p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-ink">
                          Ontology Rule Evaluation
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-rausch/10 text-rausch font-bold">
                          {backendResult.triggered_rules_count} Rules Triggered
                        </span>
                      </div>
                      <p className="text-xs text-body leading-relaxed">
                        Deterministic mapping evaluated across 19 rules in knowledge graph.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-bold text-ink block">
                        Generated SBERT Dense Query String:
                      </span>
                      <div className="p-3 bg-surfaceSoft rounded-airbnbSm border border-hairline text-xs font-mono text-body break-all leading-relaxed">
                        {backendResult.semantic_dense_query}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-[14px] bg-surfaceSoft border border-hairline text-xs text-muted">
                    FastAPI ontology service running on port 8000.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
