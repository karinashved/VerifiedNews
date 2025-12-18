import os
from typing import Optional, Literal, Dict, Any

import requests
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse


NEWSAPI_BASE = "https://newsapi.org/v2"


def _api_key() -> str:
    # Common env var names students use in projects
    return (
        os.getenv("NEWSAPI_KEY")
        or os.getenv("NEWS_API_KEY")
        or os.getenv("NEWS_API_TOKEN")
        or "" # add your key here 
    )


def _clamp_int(val: Optional[int], default: int, lo: int, hi: int) -> int:
    if val is None:
        return default
    try:
        v = int(val)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, v))


def _newsapi_get(path: str, params: Dict[str, Any]) -> JSONResponse:
    key = _api_key()
    if not key:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": "Server is missing NEWSAPI_KEY (set it as an environment variable).",
            },
        )

    params = {k: v for k, v in params.items() if v not in (None, "")}
    params["apiKey"] = key

    try:
        r = requests.get(f"{NEWSAPI_BASE}/{path}", params=params, timeout=15)
    except requests.RequestException as e:
        return JSONResponse(
            status_code=502,
            content={"status": "error", "message": f"Upstream request failed: {str(e)}"},
        )

    try:
        data = r.json()
    except ValueError:
        return JSONResponse(
            status_code=502,
            content={"status": "error", "message": "Upstream returned non-JSON response."},
        )

    # Preserve NewsAPI status codes (useful during debugging)
    return JSONResponse(status_code=r.status_code, content=data)


app = FastAPI(title="VeriNews Backend", version="2.0")

# If you serve the UI from the same backend (GET /), CORS is not needed.
# Keeping it enabled helps when opening index.html via file:// or serving from another port.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
def ui_index():
    return FileResponse("index.html")


@app.get("/styles.css", include_in_schema=False)
def ui_styles():
    return FileResponse("styles.css", media_type="text/css")


@app.get("/script.js", include_in_schema=False)
def ui_script():
    return FileResponse("script.js", media_type="application/javascript")


@app.get("/health", include_in_schema=False)
def health():
    return {"ok": True}


Endpoint = Literal["everything", "top-headlines"]


@app.get("/news/{endpoint}")
def news(
    endpoint: Endpoint,
    q: Optional[str] = Query(default=None, description="Keywords or phrase"),
    page_size: Optional[int] = Query(default=20, ge=1, le=100),
    page: Optional[int] = Query(default=1, ge=1, le=100),
    # everything
    language: Optional[str] = Query(default=None, min_length=2, max_length=2),
    from_: Optional[str] = Query(default=None, alias="from", description="YYYY-MM-DD"),
    to: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    sort_by: Optional[str] = Query(default="publishedAt", alias="sort_by"),
    # top-headlines
    country: Optional[str] = Query(default=None, min_length=2, max_length=2),
    category: Optional[str] = Query(default=None),
    sources: Optional[str] = Query(default=None, description="Comma-separated source ids"),
):
    """Proxy to NewsAPI with a stable, frontend-friendly query surface."""

    page_size_i = _clamp_int(page_size, default=20, lo=1, hi=100)
    page_i = _clamp_int(page, default=1, lo=1, hi=100)
    q_clean = (q or "").strip() or None

    if endpoint == "everything":
        if not q_clean:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Missing required parameter: q"},
            )

        sort_map = {"publishedAt", "relevancy", "popularity"}
        sort_val = sort_by if sort_by in sort_map else "publishedAt"

        params = {
            "q": q_clean,
            "language": language,
            "from": from_,
            "to": to,
            "sortBy": sort_val,
            "pageSize": page_size_i,
            "page": page_i,
        }
        return _newsapi_get("everything", params)

    # top-headlines
    if sources and (country or category):
        return JSONResponse(
            status_code=400,
            content={
                "status": "error",
                "message": "Cannot combine sources with country or category.",
            },
        )

    if not (q_clean or country or category or sources):
        return JSONResponse(
            status_code=400,
            content={
                "status": "error",
                "message": "For top-headlines, provide at least one of: q, country, category, sources.",
            },
        )

    params = {
        "q": q_clean,
        "country": country,
        "category": category,
        "sources": sources,
        "pageSize": page_size_i,
        "page": page_i,
    }
    return _newsapi_get("top-headlines", params)


if __name__ == "__main__":
    # Convenience for: python app.py
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
