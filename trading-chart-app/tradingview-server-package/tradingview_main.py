from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response, JSONResponse
import logging
from typing import Optional
import json
import httpx

from proxy_pool import OxyLabsProxy
from tradingview_proxy import tradingview_symbol_search, TradingViewProxyError

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s.%(msecs)03d %(levelname)s [%(name)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Globals
tv_proxy: Optional[OxyLabsProxy] = None
# Hardcoded OpenRouter API key per user request (note: avoid in production)
OPENROUTER_API_KEY = "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"

@asynccontextmanager
async def lifespan(app: FastAPI):
    global tv_proxy
    logger.info("Starting TradingView Proxy Server")
    try:
        tv_proxy = OxyLabsProxy(
            username="mujtaba_zUooU",
            password="Wethelegend_2"
        )
        logger.info("Configured Oxylabs proxy for TradingView")
        yield
    finally:
        logger.info("TradingView Proxy Server shutdown complete")

app = FastAPI(title="TradingView Proxy Server", lifespan=lifespan)

@app.exception_handler(TradingViewProxyError)
async def tv_proxy_error_handler(request: Request, exc: TradingViewProxyError):
    return JSONResponse(status_code=502, content={"error": str(exc)})

@app.get("/tradingview-search")
async def tradingview_search(request: Request):
    params = dict(request.query_params)
    try:
        # Step 1: Get TradingView filtered & deduped results (unchanged logic upstream)
        content, content_type = await tradingview_symbol_search(tv_proxy, params=params, attempts=3)

        # Step 2: Parse TradingView JSON payload
        try:
            data = json.loads(content.decode("utf-8"))
        except Exception as pe:
            logger.error(f"Failed to parse TradingView JSON: {pe}")
            raise HTTPException(status_code=500, detail="Invalid TradingView JSON payload")

        # Extract list of items for LLM
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict) and isinstance(data.get("symbols"), list):
            items = data["symbols"]
        else:
            items = []

        # Step 3: Build OpenRouter request (structured outputs, strict schema)
        user_query = params.get("text") or params.get("query") or ""
        model_name = "google/gemini-2.0-flash-lite-001"
        print(f"[TRADINGVIEW] Query: '{user_query}'")

        schema = {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "Normalized canonical symbol in UPPERCASE. CRYPTO uses BASE-QUOTE with hyphen (e.g., BTC-USD), FOREX uses concatenated (e.g., EURUSD)."
                    },
                    "type": {
                        "type": "string",
                        "enum": ["stocks", "indices", "crypto", "forex"]
                    },
                    "score": {
                        "type": "number",
                        "description": "Relevance score; higher is better"
                    },
                },
                "required": ["symbol", "type", "score"],
                "additionalProperties": False
            }
        }

        system_instructions = (
            "You are a STRICT normalizer, deduplicator, and ranker of market symbols for API consumption. "
            "STRICTLY return only JSON that matches the provided schema (no prose, no code fences, no explanations). "
            "Each array item MUST contain: symbol, type, score; display is optional. "
            "TYPE MUST BE EXACTLY one of: stocks, indices, forex, crypto (lowercase). "
            "SYMBOL normalization rules: "
            "- !! STOCKS/INDICES: Use exact uppercase ticker (AAPL, SPY, SPX, DJI). "
            "- !!! FOREX: Concatenated pairs in uppercase (EURUSD, GBPUSD, USDJPY). "
            "- !!!!!!!!!!!!! CRYPTO: MANDATORY BASE-USD format with hyphen (BTC-USD, ETH-USD, SOL-USD). !!!!! !!!!NEVER use BTCUSD, SOLUSDT, or other variations.1!!!!!"
            "DEDUPLICATION: Return ONLY 1 crypto symbol per base asset. For 'solana' query return ONLY SOL-USD, not SOLANA/SOLUSD/SOLUSDT variants. "
            "!! MANDATORY: Always return at least 1 object in the response array, never return empty array !! "
            "SCORING: Use 0.0-1.0 range, higher = more relevant to query. "
            "Available symbol universe includes: "
            "RANKING: Rank primarily by intent match to the user's query, then by general popularity/commonness. Break ties by shorter canonical symbol. "
            "SCORE: Use a 0..1 float (3 decimals preferred). Sort the array by descending score. "
            "LIMIT: Return at most 25 items. "
            "\n\n"
            "CONSTRAINTS: Only include assets present in or directly implied by the provided Symbols JSON. Do NOT invent unrelated assets. "
            "IGNORE non-supported categories (e.g., commodities) if they appear; only output the allowed types. "
            "\n\n"
            "MAPPING EXAMPLES (NOT OUTPUT, FOR REFERENCE ONLY): "
            "Crypto: BTC-USD, ETH-USD, SOL-USD, DOGE-USD, TON-USD. "
            "Forex: EURUSD, GBPUSD, USDJPY, USDCAD, CADUSD, JPYUSD. "
            "Stocks: SPY, NVDA, PLTR, TSLA, AAPL, MSFT. "
            "Indices: SPX, DJI, NDX, DAX, UKX. "
            "ALL SYMBOLS THAT ARE OF TYPE CRYPTO MUST BE IN THE FORMAT XXX-XXX MUST HAVE THE DASH IN BETWEEN THE BASE AND QUOTE AS IN SOL-USD NOT SOLUSDT OR SOLUSD"
            "NEVER EVER RETURN ANYHTING LIKE SOL-USDT, SOLUSD, SOLANA, solan||||||| !!!SOL-USD IS THE ONLY CORRECT ONE!!"            "ALL SYMBOLS THAT ARE OF TYPE CRYPTO MUST BE IN THE FORMAT XXX-XXX MUST HAVE THE DASH IN BETWEEN THE BASE AND QUOTE AS IN SOL-USD NOT SOLUSDT OR SOLUSD"
            "NEVER EVER RETURN ANYHTING LIKE SOL-USDT, SOLUSD, SOLANA, solan||||||| !!!SOL-USD IS THE ONLY CORRECT ONE!!"            "ALL SYMBOLS THAT ARE OF TYPE CRYPTO MUST BE IN THE FORMAT XXX-XXX MUST HAVE THE DASH IN BETWEEN THE BASE AND QUOTE AS IN SOL-USD NOT SOLUSDT OR SOLUSD"
            "NEVER EVER RETURN ANYHTING LIKE SOL-USDT, SOLUSD, SOLANA, solan||||||| !!!SOL-USD IS THE ONLY CORRECT ONE!!"            "ALL SYMBOLS THAT ARE OF TYPE CRYPTO MUST BE IN THE FORMAT XXX-XXX MUST HAVE THE DASH IN BETWEEN THE BASE AND QUOTE AS IN SOL-USD NOT SOLUSDT OR SOLUSD"
            "NEVER EVER RETURN ANYHTING LIKE SOL-USDT, SOLUSD, SOLANA, solan||||||| !!!SOL-USD IS THE ONLY CORRECT ONE!!"            "ALL SYMBOLS THAT ARE OF TYPE CRYPTO MUST BE IN THE FORMAT XXX-XXX MUST HAVE THE DASH IN BETWEEN THE BASE AND QUOTE AS IN SOL-USD NOT SOLUSDT OR SOLUSD"
            "NEVER EVER RETURN ANYHTING LIKE SOL-USDT, SOLUSD, SOLANA, solan||||||| !!!SOL-USD IS THE ONLY CORRECT ONE!!"
        )

        user_content = (
            f"Query:{user_query}\n"
            f"Symbols JSON: {json.dumps(items, ensure_ascii=False)}"
        )

        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0,
            "max_tokens": 800,
            "provider": {
                "require_parameters": True
            },
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "ranked_symbols",
                    "strict": True,
                    "schema": schema
                }
            }
        }

        # Step 4: Call OpenRouter (async) and return structured array
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            or_resp = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
            if or_resp.status_code // 100 != 2:
                # Graceful fallback when a provider doesn't support json_schema structured outputs
                txt = or_resp.text[:500]
                try:
                    err = or_resp.json()
                except Exception:
                    err = {}
                if or_resp.status_code == 400 and ("json_schema" in txt or "structured" in txt or "schema" in txt):
                    logger.warning(f"[DEBUG] Falling back to prompt-only JSON for model={model_name} due to schema error: {txt[:160]}")
                    fallback_payload = dict(payload)
                    fallback_payload.pop("response_format", None)
                    or_resp = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=fallback_payload)

                if or_resp.status_code // 100 != 2:
                    logger.error(f"OpenRouter error {or_resp.status_code}: {or_resp.text[:200]}")
                    raise HTTPException(status_code=502, detail="LLM ranking service unavailable")
            or_data = or_resp.json()
            message = or_data["choices"][0]["message"]
            
            # Handle structured outputs (tool calls) vs direct content
            if message.get("tool_calls") and len(message["tool_calls"]) > 0:
                llm_json = message["tool_calls"][0]["function"]["arguments"]
            else:
                llm_json = message.get("content", "")
            
            if not llm_json:
                logger.error("[DEBUG] LLM returned empty response!")
                return Response(content='[]', media_type="application/json")
            
            # Normalize to a JSON array string per schema
            try:
                if isinstance(llm_json, (dict, list)):
                    parsed = llm_json
                else:
                    s = llm_json.strip()
                    parsed = json.loads(s)

                # Ensure array result as required by schema
                if not isinstance(parsed, list):
                    logger.warning("[DEBUG] LLM returned non-list payload; coercing to empty list per schema")
                    parsed = []

                out = json.dumps(parsed, ensure_ascii=False)
            except Exception as pe:
                logger.error(f"[DEBUG] Failed to parse LLM JSON: {pe}")
                return Response(content='[]', media_type="application/json")
            
            logger.info(f"[DEBUG] LLM response (trunc): {out[:200]}...")
            return Response(content=out, media_type="application/json")
    except TradingViewProxyError:
        raise
    except HTTPException as he:
        # Let explicit HTTPExceptions (e.g., 4xx/5xx from upstream) pass through unchanged
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("tradingview_main:app", host="0.0.0.0", port=8000, reload=True)
