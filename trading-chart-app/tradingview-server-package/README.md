# TradingView Search Server

Minimal FastAPI server for intelligent symbol search.

## Setup

1. Install: `pip install -r requirements.txt`
2. Set API key: `export OPENROUTER_API_KEY="your_key"`
3. Run: `python tradingview_main.py`
4. Test: `curl "http://localhost:8000/tradingview-search?text=btc"`

## Files

- `tradingview_main.py` - Main FastAPI server
- `browser_config.py` - Anti-detection utilities
- `requirements.txt` - Dependencies
- `README.md` - This file

Server runs on port 8000.
