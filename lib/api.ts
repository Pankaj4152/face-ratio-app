import { FaceShapeResult } from "./landmarks";

export interface TriggeredRule {
  rule_id: string;
  feature_region: string;
  trigger_condition: string;
  target_effect: string;
  keywords: string[];
  explanation: string;
}

export interface ExpandedQueryResult {
  original_keywords: string[];
  expanded_keywords: string[];
  dense_query_text: string;
  bm25_search_terms: string[];
  product_categories: string[];
  target_finishes: string[];
}

export interface RatioMappingResponse {
  status: string;
  primary_shape: string;
  confidence: number;
  secondary_shape?: string;
  triggered_rules_count: number;
  triggered_rules: TriggeredRule[];
  retrieval_query: ExpandedQueryResult;
  semantic_dense_query: string;
  audit_trail: Record<string, any>;
}

export async function fetchSemanticMapping(
  faceShape: FaceShapeResult,
  goldenRatioScore: number | null
): Promise<RatioMappingResponse> {
  const payload = {
    face_shape: faceShape.primaryShape,
    confidence: faceShape.confidence,
    length_to_width: faceShape.ratios.lengthToWidth,
    forehead_to_cheek: faceShape.ratios.foreheadToCheek,
    jaw_to_cheek: faceShape.ratios.jawToCheek,
    forehead_to_jaw: faceShape.ratios.foreheadToJaw,
    chin_to_jaw: faceShape.ratios.chinToJaw,
    jaw_angle_deg: faceShape.ratios.jawAngleDeg,
    golden_ratio_score: goldenRatioScore,
    dimensions: faceShape.dimensions,
    secondary_shape: faceShape.secondaryShape,
  };

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const response = await fetch(`${API_BASE}/api/map-ratio`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`FastAPI server error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
