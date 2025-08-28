import logging
import re
import asyncio
import random
import json
from typing import Dict, Tuple, Optional, Any

import httpx

from proxy_pool import OxyLabsProxy
from browser_config import BrowserFingerprint, ProxyLocation as BFProxyLocation

logger = logging.getLogger(__name__)

TRADINGVIEW_SEARCH_URL = "https://symbol-search.tradingview.com/symbol_search/"


class TradingViewProxyError(Exception):
    pass


def _parse_state_from_location(location: str) -> str:
    # location example: "us-ca-losangeles"
    try:
        parts = location.split("-")
        return parts[1] if len(parts) >= 2 else "ca"
    except Exception:
        return "ca"


def _infer_client_hints_from_ua(ua: str) -> Tuple[str, str, str]:
    """Infer sec-ch-ua-platform, sec-ch-ua, sec-ch-ua-mobile from UA."""
    platform = '"Windows"' if "Windows" in ua else ('"macOS"' if "Macintosh" in ua else '"Linux"')
    m = re.search(r"Chrome/(\d+)", ua)
    major = m.group(1) if m else "120"
    sec_ch_ua = f'"Chromium";v="{major}", "Google Chrome";v="{major}", "Not:A-Brand";v="99"'
    mobile = "?0"
    return platform, sec_ch_ua, mobile


def _strip_tv_fields(item: Dict[str, Any]) -> Dict[str, Any]:
    """Remove unwanted provider/source fields and transform spot crypto to crypto type."""
    if not isinstance(item, dict):
        return item
    remove_keys = {"provider_id", "source_logoid", "source2", "source_id"}
    cleaned = {k: v for k, v in item.items() if k not in remove_keys}
    
    # Transform spot crypto to crypto type
    if cleaned.get("type") == "spot":
        ts = cleaned.get("typespecs") or cleaned.get("typeSpecs") or []
        ts_lower = [s.lower() for s in ts if isinstance(s, str)]
        if "crypto" in ts_lower:
            cleaned["type"] = "crypto"
    
    return cleaned


async def tradingview_symbol_search(proxy: OxyLabsProxy, params: Dict[str, str], attempts: int = 3) -> Tuple[bytes, str]:
    """Perform a detection-resistant request to TradingView symbol search.

    Returns (content_bytes, content_type).
    """
    last_error: Optional[str] = None

    # ensure default param
    params = dict(params)
    params.setdefault("lang", "en")
    params.setdefault("limit", "50")

    for _ in range(attempts):
        try:
            conf = proxy.get_random_proxy()
            location = conf.get("location", "")
            state = _parse_state_from_location(location)

            # region-consistent fingerprint
            fp = BrowserFingerprint.generate(BFProxyLocation(state=state))
            ua = fp["user_agent"]
            platform, sec_ch_ua, sec_ch_mobile = _infer_client_hints_from_ua(ua)
            accept_language = fp["headers"].get("accept-language", "en-US,en;q=0.9")
            tz = fp["headers"].get("sec-ch-ua-timezone")
            mver = re.search(r"Chrome/(\d+)", ua)
            ua_major = mver.group(1) if mver else "unknown"
            logger.info(f"[TV] Using proxy location={location} state={state} UA_Chrome={ua_major} AL={accept_language} TZ={tz}")

            headers = {
                "User-Agent": ua,
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": accept_language,
                "Accept-Encoding": "gzip, deflate, br",
                "Origin": "https://www.tradingview.com",
                "Referer": "https://www.tradingview.com/",
                "Connection": "keep-alive",
                "Pragma": "no-cache",
                "Cache-Control": "no-cache",
                # Client Hints
                "sec-ch-ua": sec_ch_ua,
                "sec-ch-ua-mobile": sec_ch_mobile,
                "sec-ch-ua-platform": platform,
                # Fetch metadata
                "Sec-Fetch-Site": "same-site",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Dest": "empty",
            }
            if "cookie" in fp["headers"]:
                headers["Cookie"] = fp["headers"]["cookie"]
            if "sec-ch-ua-timezone" in fp["headers"]:
                headers["sec-ch-ua-timezone"] = fp["headers"]["sec-ch-ua-timezone"]

            transport = httpx.AsyncHTTPTransport(proxy=conf["url"], verify=True)
            async with httpx.AsyncClient(transport=transport, timeout=15.0) as client:
                resp = await client.get(TRADINGVIEW_SEARCH_URL, params=params, headers=headers)
                if 200 <= resp.status_code < 300:
                    # Attempt to parse and filter
                    content_type = resp.headers.get("content-type", "application/json")
                    try:
                        data: Any = resp.json()
                        original_count = None

                        def keep(item: Dict[str, Any]) -> bool:
                            t = str(item.get("type", "")).lower()
                            ts = item.get("typespecs") or item.get("typeSpecs") or []
                            ts_lower = [s.lower() for s in ts if isinstance(s, str)]
                            has_crypto = "crypto" in ts_lower
                            
                            if t in {"index", "forex", "stock"}:
                                return not has_crypto
                            if t == "spot":
                                return has_crypto
                            return False

                        if isinstance(data, list):
                            original_count = len(data)
                            filtered = [x for x in data if isinstance(x, dict) and keep(x)]
                            # Dedupe by symbol
                            seen = set()
                            deduped = []
                            for item in filtered:
                                sym = item.get("symbol")
                                if sym and sym not in seen:
                                    seen.add(sym)
                                    deduped.append(item)
                            logger.info(f"[TV] Filter kept {len(filtered)}/{original_count} -> dedup {len(deduped)} symbols (list)")
                            deduped_clean = [_strip_tv_fields(it) for it in deduped]
                            return json.dumps(deduped_clean).encode("utf-8"), "application/json"
                        elif isinstance(data, dict) and "symbols" in data and isinstance(data["symbols"], list):
                            original_count = len(data["symbols"])
                            filtered = [x for x in data["symbols"] if isinstance(x, dict) and keep(x)]
                            # Dedupe by symbol
                            seen = set()
                            deduped = []
                            for item in filtered:
                                sym = item.get("symbol")
                                if sym and sym not in seen:
                                    seen.add(sym)
                                    deduped.append(item)
                            deduped_clean = [_strip_tv_fields(it) for it in deduped]
                            new_payload = {**data, "symbols": deduped_clean}
                            logger.info(f"[TV] Filter kept {len(filtered)}/{original_count} -> dedup {len(deduped)} symbols (dict.symbols)")
                            return json.dumps(new_payload).encode("utf-8"), "application/json"
                        else:
                            # Unknown structure; return as-is
                            logger.info("[TV] Response not list/dict[symbols]; returning raw")
                            return resp.content, content_type
                    except Exception:
                        # Non-JSON or parse error; return raw
                        logger.info("[TV] Non-JSON response; returning raw content")
                        return resp.content, content_type

                last_error = f"{resp.status_code} {resp.text[:200]}"
                logger.warning(f"TradingView search non-2xx: {last_error}")
                # small randomized jitter before retry
                jitter = random.uniform(0.25, 0.8)
                logger.info(f"[TV] Retry with jitter {int(jitter*1000)}ms")
                await asyncio.sleep(jitter)
                continue
        except Exception as e:
            last_error = str(e)
            logger.error(f"TradingView search attempt failed: {last_error}")
            jitter = random.uniform(0.25, 0.8)
            logger.info(f"[TV] Retry after exception with jitter {int(jitter*1000)}ms")
            await asyncio.sleep(jitter)
            continue

    raise TradingViewProxyError(f"TradingView search failed after retries: {last_error}")
