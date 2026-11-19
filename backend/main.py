"""
FaceSemantic & Minor Project FastAPI Backend
Exposes Part 2: Ratio-to-Keyword Mapping & NLP Query Expansion API.
"""

import os
import sys
from typing import List, Dict, Any, Optional

# Ensure the backend directory is in sys.path regardless of execution method or working directory
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from ontology import OntologyEngine, FacialInputProfile, TriggeredRule
    from query_expansion import QueryExpander, ExpandedQueryResult
except ImportError:
    from backend.ontology import OntologyEngine, FacialInputProfile, TriggeredRule
    from backend.query_expansion import QueryExpander, ExpandedQueryResult

app = FastAPI(
    title="FaceSemantic - Facial Geometry Driven Product Retrieval API",
    description="Maps facial proportions & face shapes into semantic queries for distributed product retrieval.",
    version="1.0.0",
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize engines
ontology_engine = OntologyEngine()
query_expander = QueryExpander()


class RatioMappingRequest(BaseModel):
    face_shape: str
    confidence: int
    length_to_width: float
    forehead_to_cheek: float
    jaw_to_cheek: float
    forehead_to_jaw: float
    chin_to_jaw: float
    jaw_angle_deg: float
    golden_ratio_score: Optional[int] = None
    upper_to_middle_third: Optional[float] = 1.0
    middle_to_lower_third: Optional[float] = 1.0
    dimensions: Optional[Dict[str, int]] = None
    secondary_shape: Optional[str] = None


class RatioMappingResponse(BaseModel):
    status: str
    primary_shape: str
    confidence: int
    secondary_shape: Optional[str] = None
    triggered_rules_count: int
    triggered_rules: List[TriggeredRule]
    retrieval_query: ExpandedQueryResult
    semantic_dense_query: str
    audit_trail: Dict[str, Any]


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "FaceSemantic Ontology & Mapping Service",
        "version": "1.0.0",
        "registered_rules": len(ontology_engine.get_all_rules()),
    }


@app.get("/api/ontology/rules")
def get_registered_rules():
    """
    Returns the complete transparent ontology knowledge graph rule registry.
    """
    return {
        "total_rules": len(ontology_engine.get_all_rules()),
        "rules": ontology_engine.get_all_rules(),
    }


@app.post("/api/map-ratio", response_model=RatioMappingResponse)
def map_facial_ratios_to_keywords(payload: RatioMappingRequest):
    """
    Part 2 Core Endpoint:
    Accepts measured facial proportions & shape, evaluates against the ontology,
    and applies NLP query expansion to produce search embeddings and tokens.
    """
    try:
        profile = FacialInputProfile(
            face_shape=payload.face_shape,
            confidence=payload.confidence,
            length_to_width=payload.length_to_width,
            forehead_to_cheek=payload.forehead_to_cheek,
            jaw_to_cheek=payload.jaw_to_cheek,
            forehead_to_jaw=payload.forehead_to_jaw,
            chin_to_jaw=payload.chin_to_jaw,
            jaw_angle_deg=payload.jaw_angle_deg,
            golden_ratio_score=payload.golden_ratio_score,
            upper_to_middle_third=payload.upper_to_middle_third,
            middle_to_lower_third=payload.middle_to_lower_third,
        )

        # 1. Evaluate against ontology
        triggered = ontology_engine.evaluate(profile)

        # 2. Extract unique base keywords
        base_keywords = []
        for r in triggered:
            for kw in r.keywords:
                if kw not in base_keywords:
                    base_keywords.append(kw)

        # 3. Apply NLP Query Expansion
        expanded = query_expander.expand(base_keywords, payload.face_shape)

        return RatioMappingResponse(
            status="success",
            primary_shape=payload.face_shape,
            confidence=payload.confidence,
            secondary_shape=payload.secondary_shape,
            triggered_rules_count=len(triggered),
            triggered_rules=triggered,
            retrieval_query=expanded,
            semantic_dense_query=expanded.dense_query_text,
            audit_trail={
                "measured_proportions": {
                    "length_to_width": payload.length_to_width,
                    "jaw_to_cheek": payload.jaw_to_cheek,
                    "forehead_to_jaw": payload.forehead_to_jaw,
                    "jaw_angle_deg": payload.jaw_angle_deg,
                },
                "total_ontology_rules_evaluated": len(ontology_engine.get_all_rules()),
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ontology mapping failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, app_dir=BACKEND_DIR)
