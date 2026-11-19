"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ProductItem, searchProducts, listCatalogProducts } from "@/lib/api";

interface ProductRecommendationsProps {
  faceShape: string;
  denseQueryText?: string;
  categories?: string[];
}

const CATEGORIES = [
  "All",
  "Contour & Sculpt",
  "Blush",
  "Highlighter",
  "Brow & Eye",
  "Skincare",
];

export default function ProductRecommendations({
  faceShape,
  denseQueryText = "",
  categories = [],
}: ProductRecommendationsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [engineInfo, setEngineInfo] = useState<string>("Sentence-BERT + FAISS");
  const [savedRoutines, setSavedRoutines] = useState<Set<string>>(new Set());
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Default query derived from face shape if denseQueryText is not provided
  const activeQuery = useMemo(() => {
    if (denseQueryText && denseQueryText.trim().length > 0) {
      return denseQueryText;
    }
    return `${faceShape} face shape contouring sculpting blush highlighter cosmetic products`;
  }, [denseQueryText, faceShape]);

  useEffect(() => {
    let isCancelled = false;

    async function fetchRecommendations() {
      setLoading(true);
      setError(null);
      try {
        const catFilter = selectedCategory === "All" ? undefined : selectedCategory;
        const res = await searchProducts(activeQuery, faceShape, catFilter, undefined, 8);
        if (!isCancelled) {
          setProducts(res.products || []);
          if (res.engine) setEngineInfo(res.engine);
          setLoading(false);
        }
      } catch (err: any) {
        console.warn("FastAPI semantic search error, falling back to static catalog:", err);
        // Fallback: try direct catalog listing
        try {
          const catFilter = selectedCategory === "All" ? undefined : selectedCategory;
          const fallback = await listCatalogProducts(catFilter, faceShape);
          if (!isCancelled) {
            setProducts(fallback.products || []);
            setEngineInfo("Local Catalog Fallback");
            setLoading(false);
          }
        } catch (catErr: any) {
          if (!isCancelled) {
            setError("Could not connect to FastAPI recommendation server (http://localhost:8000). Please ensure `uvicorn main:app` is running.");
            setLoading(false);
          }
        }
      }
    }

    fetchRecommendations();

    return () => {
      isCancelled = true;
    };
  }, [faceShape, activeQuery, selectedCategory]);

  const toggleSaveRoutine = (productId: string) => {
    setSavedRoutines((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Engine Status */}
      <div className="rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-950/40 via-purple-900/30 to-fuchsia-950/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Dense Vector Retrieval</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-mono">
                  {engineInfo}
                </span>
              </p>
              <p className="text-xs text-neutral-400">
                Ranked for <strong className="text-violet-300 capitalize">{faceShape}</strong> facial structure & symmetry
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-neutral-400">
              Saved to Routine: <strong className="text-emerald-400">{savedRoutines.size}</strong> items
            </span>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/30 ring-1 ring-violet-400"
                  : "bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-700"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-300 flex items-start gap-2">
          <span className="text-base">⚠️</span>
          <div>
            <p className="font-semibold">Backend Server Offline</p>
            <p className="text-amber-300/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
              <div className="h-44 bg-neutral-800 rounded-lg"></div>
              <div className="h-4 bg-neutral-800 rounded w-2/3"></div>
              <div className="h-3 bg-neutral-800 rounded w-1/2"></div>
              <div className="h-10 bg-neutral-800 rounded"></div>
            </div>
          ))}
        </div>
      )}

      {/* Products Grid */}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => {
            const isSaved = savedRoutines.has(p.id);
            const matchPct = p.match_percentage || 85;

            return (
              <div
                key={p.id}
                className="group relative flex flex-col justify-between rounded-xl border border-neutral-800 bg-neutral-900/70 p-4 transition-all duration-200 hover:border-violet-500/40 hover:bg-neutral-900 hover:shadow-lg hover:shadow-violet-950/30"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                      {p.brand}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                      <span>✓</span> {matchPct}% Match
                    </span>
                  </div>

                  {/* Image container */}
                  <div className="relative h-44 w-full overflow-hidden rounded-lg bg-neutral-950 mb-3 group-hover:opacity-95 transition-opacity">
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute bottom-2 left-2 flex gap-1">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm text-neutral-200">
                        {p.formulation}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm text-violet-300">
                        {p.finish}
                      </span>
                    </div>
                  </div>

                  {/* Product Title */}
                  <h4 className="text-sm font-semibold text-neutral-100 line-clamp-1 group-hover:text-violet-300 transition-colors">
                    {p.name}
                  </h4>

                  {/* Rating & Reviews */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex text-amber-400 text-xs">
                      {"★".repeat(Math.round(p.rating))}
                      {"☆".repeat(5 - Math.round(p.rating))}
                    </div>
                    <span className="text-[11px] font-medium text-neutral-300">{p.rating}</span>
                    <span className="text-[11px] text-neutral-500">({p.review_count.toLocaleString()})</span>
                  </div>

                  {/* Anthropometric Recommendation Reason */}
                  {p.recommendation_reason && (
                    <div className="mt-2.5 rounded-lg border border-violet-500/20 bg-violet-950/30 p-2 text-[11px] text-violet-200/90 leading-relaxed">
                      <p className="font-medium text-violet-300 mb-0.5">💡 Facial Fit:</p>
                      {p.recommendation_reason}
                    </div>
                  )}
                </div>

                {/* Bottom Row: Price & Actions */}
                <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                  <span className="text-sm font-bold text-white">
                    ${p.price.toFixed(2)}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedProduct(p)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium transition cursor-pointer"
                      title="View Details"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => toggleSaveRoutine(p.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                        isSaved
                          ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                          : "bg-violet-600 hover:bg-violet-500 text-white shadow-sm shadow-violet-600/30"
                      }`}
                    >
                      {isSaved ? "Saved ✓" : "+ Routine"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && products.length === 0 && !error && (
        <div className="text-center py-12 rounded-xl border border-neutral-800 bg-neutral-900/40 p-6">
          <p className="text-sm font-medium text-neutral-300">No products found for this category filter.</p>
          <button
            onClick={() => setSelectedCategory("All")}
            className="mt-3 text-xs px-4 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-500 transition cursor-pointer"
          >
            Show All Categories
          </button>
        </div>
      )}

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative max-w-lg w-full rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl space-y-4">
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white text-lg p-1"
            >
              ✕
            </button>

            <div className="flex gap-4">
              <img
                src={selectedProduct.image_url}
                alt={selectedProduct.name}
                className="h-28 w-28 rounded-xl object-cover bg-neutral-950"
              />
              <div>
                <span className="text-xs uppercase text-violet-400 font-bold">{selectedProduct.brand}</span>
                <h3 className="text-base font-bold text-white">{selectedProduct.name}</h3>
                <p className="text-sm font-semibold text-emerald-400 mt-1">${selectedProduct.price.toFixed(2)}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400">
                  <span>★ {selectedProduct.rating}</span>
                  <span>•</span>
                  <span>{selectedProduct.category}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              {selectedProduct.description}
            </p>

            <div>
              <p className="text-xs font-semibold text-white mb-1.5">Key Anthropometric Benefits:</p>
              <ul className="space-y-1">
                {selectedProduct.key_benefits.map((b, idx) => (
                  <li key={idx} className="text-xs text-neutral-400 flex items-start gap-1.5">
                    <span className="text-violet-400">✦</span> {b}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
              <span className="text-xs text-neutral-400">
                Formula: <strong className="text-neutral-200">{selectedProduct.formulation}</strong> | Finish: <strong className="text-neutral-200">{selectedProduct.finish}</strong>
              </span>
              <button
                onClick={() => {
                  toggleSaveRoutine(selectedProduct.id);
                  setSelectedProduct(null);
                }}
                className="text-xs px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition cursor-pointer"
              >
                {savedRoutines.has(selectedProduct.id) ? "Remove from Routine" : "Add to Routine"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
