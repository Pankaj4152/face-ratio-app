"use client";

import React, { useState, useMemo } from "react";
import { SkinAnalysisResult } from "@/lib/skinAnalysis";
import {
  SkinType,
  SkinConcern,
  generateSkincareRoutine,
} from "@/lib/skincareRoutine";

interface SkinAssessmentModuleProps {
  analysis: SkinAnalysisResult | null;
  faceShape?: string;
}

const ALL_CONCERNS: SkinConcern[] = [
  "Acne & Blemishes",
  "Dark Spots & Hyperpigmentation",
  "Redness & Sensitivity",
  "Dullness & Uneven Texture",
  "Fine Lines & Anti-Aging",
  "Dehydration & Flakiness",
];

const SKIN_TYPES: SkinType[] = ["Oily", "Combination", "Normal", "Dry", "Sensitive"];

export default function SkinAssessmentModule({
  analysis,
  faceShape,
}: SkinAssessmentModuleProps) {
  // Derive initial skin type from computer vision metrics if available
  const initialSkinType: SkinType = useMemo(() => {
    if (!analysis) return "Combination";
    if (analysis.rednessCondition === "Noticeable (Sensitive / Rosacea)") return "Sensitive";
    if (analysis.tZoneCondition === "High Shine (Oily)") return "Oily";
    if (analysis.tZoneCondition === "Matte" && analysis.hydrationEstimate === "Dehydrated / Dry") return "Dry";
    if (analysis.tZoneShineScore > 58) return "Combination";
    return "Normal";
  }, [analysis]);

  // Derive initial concerns from computer vision
  const initialConcerns = useMemo<SkinConcern[]>(() => {
    const list: SkinConcern[] = [];
    if (!analysis) return ["Dullness & Uneven Texture"];
    if (analysis.tZoneCondition === "High Shine (Oily)") list.push("Acne & Blemishes");
    if (analysis.rednessCondition.includes("Noticeable") || analysis.rednessCondition.includes("Moderate")) {
      list.push("Redness & Sensitivity");
    }
    if (analysis.hydrationEstimate === "Dehydrated / Dry") list.push("Dehydration & Flakiness");
    if (list.length === 0) list.push("Dullness & Uneven Texture");
    return list;
  }, [analysis]);

  const [selectedSkinType, setSelectedSkinType] = useState<SkinType>(initialSkinType);
  const [selectedConcerns, setSelectedConcerns] = useState<SkinConcern[]>(initialConcerns);
  const [activeTab, setActiveTab] = useState<"AM" | "PM" | "weekly">("AM");

  // Generate personalized regimen
  const routine = useMemo(() => {
    return generateSkincareRoutine(selectedSkinType, selectedConcerns);
  }, [selectedSkinType, selectedConcerns]);

  const toggleConcern = (concern: SkinConcern) => {
    setSelectedConcerns((prev) => {
      if (prev.includes(concern)) {
        return prev.filter((c) => c !== concern);
      } else {
        return [...prev, concern];
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Computer Vision Skin Diagnostic Cards */}
      {analysis ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Tone & Hex Card */}
          <div className="rounded-xl border border-line bg-paper p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink/60">
                Skin Tone & Melanin
              </span>
              <div
                className="w-5 h-5 rounded-full border border-black/20 shadow-inner"
                style={{ backgroundColor: analysis.hexColor }}
                title={`Sampled Hex: ${analysis.hexColor}`}
              />
            </div>
            <div>
              <p className="text-base font-bold text-ink">
                {analysis.skinTone} Tone
              </p>
              <p className="text-xs text-ink/60 font-mono">
                Fitzpatrick {analysis.fitzpatrickScale} • {analysis.hexColor.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Undertone Card */}
          <div className="rounded-xl border border-line bg-paper p-3.5 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink/60 block">
              Colorimetric Undertone
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-base font-bold text-ink">
                  {analysis.undertone}
                </p>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-brass/10 text-brass border border-brass/30">
                  {analysis.undertoneConfidence}% conf
                </span>
              </div>
              <p className="text-xs text-ink/60 mt-0.5">
                {analysis.undertone === "Warm"
                  ? "Flattered by golden, peach, & bronze shades"
                  : analysis.undertone === "Cool"
                  ? "Flattered by berry, rose, & silver shades"
                  : "Balanced with both warm & cool pigments"}
              </p>
            </div>
          </div>

          {/* T-Zone Shine / Sebum Index */}
          <div className="rounded-xl border border-line bg-paper p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink/60">
                T-Zone Shine Index
              </span>
              <span className="text-xs font-mono font-bold text-ink">
                {analysis.tZoneShineScore}%
              </span>
            </div>
            <div>
              <div className="h-1.5 w-full bg-ink/10 rounded-full overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full ${
                    analysis.tZoneShineScore > 68
                      ? "bg-amber-500"
                      : analysis.tZoneShineScore < 38
                      ? "bg-blue-400"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${analysis.tZoneShineScore}%` }}
                />
              </div>
              <p className="text-xs font-medium text-ink/75">
                {analysis.tZoneCondition}
              </p>
            </div>
          </div>

          {/* Erythema / Redness Score */}
          <div className="rounded-xl border border-line bg-paper p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink/60">
                Cheek Erythema (Redness)
              </span>
              <span className="text-xs font-mono font-bold text-ink">
                {analysis.erythemaScore}%
              </span>
            </div>
            <div>
              <div className="h-1.5 w-full bg-ink/10 rounded-full overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full ${
                    analysis.erythemaScore > 60
                      ? "bg-rose-500"
                      : analysis.erythemaScore > 40
                      ? "bg-amber-400"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${analysis.erythemaScore}%` }}
                />
              </div>
              <p className="text-xs font-medium text-ink/75">
                {analysis.rednessCondition}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-paper p-4 text-xs text-ink/60">
          Upload or capture a front-facing portrait to enable real-time computer vision skin tone, undertone, and shine analysis.
        </div>
      )}

      {/* 2. Interactive Clinical Skin Questionnaire */}
      <div className="rounded-xl border border-line bg-panel p-5 space-y-5">
        <div>
          <h3 className="font-serif text-base font-bold text-ink">
            Clinical Diagnostic Questionnaire
          </h3>
          <p className="text-xs text-ink/60 mt-0.5">
            Refine your physiological profile to generate customized active ingredient recommendations.
          </p>
        </div>

        {/* Skin Type Selector */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink/60 block mb-2">
            1. Identified Skin Type
          </label>
          <div className="flex flex-wrap gap-2">
            {SKIN_TYPES.map((type) => {
              const isSelected = selectedSkinType === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedSkinType(type)}
                  className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    isSelected
                      ? "bg-brass text-paper font-semibold shadow-sm"
                      : "bg-paper text-ink/70 border border-line hover:text-ink hover:border-ink/30"
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Concerns Multi-Select */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink/60 block mb-2">
            2. Primary Skin Concerns (Select all that apply)
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_CONCERNS.map((concern) => {
              const isChecked = selectedConcerns.includes(concern);
              return (
                <button
                  key={concern}
                  onClick={() => toggleConcern(concern)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    isChecked
                      ? "bg-ink text-paper font-medium shadow-sm"
                      : "bg-paper text-ink/70 border border-line hover:text-ink hover:border-ink/40"
                  }`}
                >
                  <span>{isChecked ? "✓" : "+"}</span>
                  <span>{concern}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Hero Active Ingredients Callout */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
        <div className="flex items-start gap-3">
          <span className="text-lg">🧪</span>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-1">
              Recommended Dermatological Actives for Your Profile:
            </h4>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {routine.heroIngredients.map((ing, i) => (
                <span
                  key={i}
                  className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-500/30 text-emerald-200"
                >
                  {ing}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Morning & Evening Routine Steps */}
      <div className="rounded-xl border border-line bg-panel p-5 space-y-4">
        {/* Routine Tab Switcher */}
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("AM")}
              className={`text-xs px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "AM"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-ink/60 hover:text-ink"
              }`}
            >
              <span>☀️</span> Morning Regimen (AM)
            </button>
            <button
              onClick={() => setActiveTab("PM")}
              className={`text-xs px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "PM"
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                  : "text-ink/60 hover:text-ink"
              }`}
            >
              <span>🌙</span> Evening Regimen (PM)
            </button>
            <button
              onClick={() => setActiveTab("weekly")}
              className={`text-xs px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "weekly"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                  : "text-ink/60 hover:text-ink"
              }`}
            >
              <span>✨</span> Weekly Treatments
            </button>
          </div>

          <span className="text-[11px] text-ink/50 font-mono hidden sm:inline-block">
            {activeTab === "AM" ? "4 Protective Steps" : activeTab === "PM" ? "4 Restorative Steps" : "2 Booster Cycles"}
          </span>
        </div>

        {/* Steps List */}
        {activeTab !== "weekly" ? (
          <div className="space-y-3">
            {(activeTab === "AM" ? routine.amRoutine : routine.pmRoutine).map((step) => (
              <div
                key={step.stepNumber}
                className="rounded-lg border border-line bg-paper p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink/10 text-[11px] font-bold text-ink">
                      {step.stepNumber}
                    </span>
                    <span className="text-xs uppercase tracking-wider font-semibold text-brass">
                      {step.category}
                    </span>
                    <span className="text-xs font-bold text-ink">
                      {step.stepName}
                    </span>
                  </div>
                  <p className="text-xs text-ink/75 pl-7">
                    {step.purpose}
                  </p>
                  <p className="text-[11px] text-ink/50 pl-7 italic">
                    💡 <strong>Application:</strong> {step.usageTip}
                  </p>
                </div>

                <div className="pl-7 sm:pl-0 flex flex-wrap gap-1">
                  {step.keyIngredients.map((k, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-panel border border-line text-ink/60"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {routine.weeklyTreatments.map((treatment, i) => (
              <div
                key={i}
                className="rounded-lg border border-line bg-paper p-3.5 flex items-start gap-3"
              >
                <span className="text-base">✦</span>
                <p className="text-xs text-ink/80 leading-relaxed font-medium">
                  {treatment}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Safety Notes Callout */}
        <div className="pt-3 border-t border-line">
          <p className="text-[11px] font-semibold text-ink/60 uppercase tracking-wider mb-1.5">
            Dermatological Usage Precautions:
          </p>
          <ul className="space-y-1">
            {routine.safetyNotes.map((note, idx) => (
              <li key={idx} className="text-[11px] text-ink/60 flex items-start gap-1.5">
                <span className="text-amber-500">⚠</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
