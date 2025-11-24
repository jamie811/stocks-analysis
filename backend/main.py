# backend/main.py
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import pandas_ta as ta

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_ticker_symbol(keyword):
    keyword = keyword.upper()
    if keyword.isdigit(): return f"{keyword}.KS"
    return keyword

def get_period_by_interval(interval):
    if interval in ["1m", "2m", "5m"]: return "5d"
    if interval in ["15m", "30m", "60m", "90m", "1h"]: return "1mo"
    return "2y"

@app.get("/analyze/{keyword}")
def analyze_stock(
    keyword: str,
    ma_interval: str = Query("1wk"), ma_short: int = Query(50), ma_long: int = Query(200),
    rsi_interval: str = Query("1d"), rsi_period: int = Query(14),
    macd_interval: str = Query("1wk"), macd_fast: int = Query(12), macd_slow: int = Query(26), macd_signal: int = Query(9),
    stoch_interval: str = Query("1d"), stoch_k: int = Query(14),
    bb_interval: str = Query("1d"), bb_length: int = Query(20), bb_std: float = Query(2.0)
):
    ticker = get_ticker_symbol(keyword)
    needed_intervals = list(set([ma_interval, rsi_interval, macd_interval, stoch_interval, bb_interval, "1d"]))
    data_store = {}

    try:
        # 1. 데이터 수집
        for interval in needed_intervals:
            period = get_period_by_interval(interval)
            df = yf.download(ticker, interval=interval, period=period, auto_adjust=True, progress=False)
            if isinstance(df.columns, pd.MultiIndex): df.columns = df.columns.get_level_values(0)
            if not df.empty and len(df) > 20: data_store[interval] = df
        
        if "1d" not in data_store and not data_store:
             return {"error": "데이터 부족/종목 오류"}
         
        try :
            stock_info = yf.Ticker(ticker).info
            shares_outstanding = stock_info.get('sharesOutstanding', None)
            
            current_volume = df['Volume'].iloc[-1]
            
            turnover_rate = 0
            turnover_msg = "정보 없음"

            if shares_outstanding:
                # 회전율 = (거래량 / 상장주식수) * 100
                turnover_rate = (current_volume / shares_outstanding) * 100
                
                if turnover_rate >= 10: turnover_msg = "🔥 폭발적 관심 (10%↑)"
                elif turnover_rate >= 5: turnover_msg = "👀 매우 활발 (5%↑)"
                elif turnover_rate >= 1: turnover_msg = "🙂 보통/활발 (1%↑)"
                else: turnover_msg = "💤 소외/조용 (1%↓)"
            else:
                shares_outstanding = 0 # 데이터 없을 경우 방어
        except Exception :
            shares_outstanding = 0
            turnover_rate = 0
            turnover_msg = "데이터 미제공"
        
        # 기본 데이터 (일봉 기준)
        base_df = data_store.get("1d", list(data_store.values())[0])
        last_price = base_df['Close'].iloc[-1]
        
        # --- [핵심 추가] ATR 기반 익절/손절 계산 ---
        # ATR은 보통 일봉(1d) 기준으로 변동폭을 잡는 것이 정석입니다.
        atr_df = base_df.ta.atr(length=14, append=False)
        atr_value = atr_df.iloc[-1] if atr_df is not None else 0
        
        # 포맷팅 함수 (한국장은 정수, 미국장은 소수점)
        def fmt_price(price):
            return f"{int(price):,}" if ticker.endswith(".KS") else f"{price:.2f}"

        strategies = {
            "atr": fmt_price(atr_value),
            "scalp": { # 단타 (1 * ATR)
                "tp": fmt_price(last_price + (1 * atr_value)),
                "sl": fmt_price(last_price - (1 * atr_value))
            },
            "swing": { # 스윙 (2 * ATR)
                "tp": fmt_price(last_price + (2 * atr_value)),
                "sl": fmt_price(last_price - (2 * atr_value))
            },
            "long": { # 장투 (3 * ATR)
                "tp": fmt_price(last_price + (3 * atr_value)),
                "sl": fmt_price(last_price - (3 * atr_value))
            }
        }
        # ----------------------------------------

        score = 50
        reasons = []
        indicators = {}

        # [MA Cross]
        if ma_interval in data_store:
            df = data_store[ma_interval].copy()
            if len(df) > ma_long:
                sma_s = df.ta.sma(length=ma_short, append=False)
                sma_l = df.ta.sma(length=ma_long, append=False)
                if sma_s is not None and sma_l is not None:
                    curr_s = sma_s.iloc[-1]; curr_l = sma_l.iloc[-1]
                    prev_s = sma_s.iloc[-2]; prev_l = sma_l.iloc[-2]
                    indicators['MA_Cross'] = f"{ma_short}vs{ma_long} ({ma_interval})"
                    if prev_s <= prev_l and curr_s > curr_l:
                        score += 30; reasons.append(f"★ 골든크로스 ({ma_short}/{ma_long})"); indicators['MA_Cross'] = "Golden Cross"
                    elif curr_s > curr_l: score += 10; reasons.append("이평선 정배열"); indicators['MA_Cross'] = "정배열"
                    elif prev_s >= prev_l and curr_s < curr_l:
                        score -= 30; reasons.append(f"☠️ 데드크로스 ({ma_short}/{ma_long})"); indicators['MA_Cross'] = "Death Cross"
                    elif curr_s < curr_l: score -= 10; reasons.append("이평선 역배열"); indicators['MA_Cross'] = "역배열"

        # [RSI]
        if rsi_interval in data_store:
            rsi_df = data_store[rsi_interval].ta.rsi(length=rsi_period, append=False)
            if rsi_df is not None:
                val = rsi_df.iloc[-1]
                indicators['RSI'] = f"{val:.2f} ({rsi_interval})"
                if val < 30: score += 20; reasons.append("RSI 과매도")
                elif val > 70: score -= 20; reasons.append("RSI 과매수")

        # [MACD]
        if macd_interval in data_store:
            macd_df = data_store[macd_interval].ta.macd(fast=macd_fast, slow=macd_slow, signal=macd_signal, append=False)
            if macd_df is not None:
                macd_val = macd_df.iloc[-1, 0]; sig_val = macd_df.iloc[-1, 2]
                indicators['MACD'] = f"{macd_val:.2f} ({macd_interval})"
                if macd_val > sig_val: score += 15; reasons.append("MACD 상승 추세")
                else: score -= 15; reasons.append("MACD 하락 추세")

        # [Stoch]
        if stoch_interval in data_store:
            stoch_df = data_store[stoch_interval].ta.stoch(k=stoch_k, d=3, append=False)
            if stoch_df is not None:
                k_val = stoch_df.iloc[-1, 0]
                indicators['Stoch_K'] = f"{k_val:.2f} ({stoch_interval})"
                if k_val < 20: score += 10; reasons.append("스토캐스틱 바닥")
                elif k_val > 80: score -= 10; reasons.append("스토캐스틱 천장")

        # [BB]
        if bb_interval in data_store:
            bb_df = data_store[bb_interval].ta.bbands(length=bb_length, std=bb_std, append=False)
            if bb_df is not None:
                df = data_store[bb_interval]
                indicators['BB'] = f"중간 ({bb_interval})"
                if df['Close'].iloc[-1] < bb_df.iloc[-1, 0]: score+=10; reasons.append("볼린저 하단"); indicators['BB'] = "하단"
                elif df['Close'].iloc[-1] > bb_df.iloc[-1, 2]: score-=10; reasons.append("볼린저 상단"); indicators['BB'] = "상단"

        # [OBV]
        if "1d" in data_store:
            obv_df = data_store["1d"].ta.obv(append=False)
            if obv_df is not None:
                indicators['OBV'] = f"{obv_df.iloc[-1]:.0f}"
                if obv_df.iloc[-1] > obv_df.iloc[-2]: score += 5

        score = max(0, min(100, score))

        return {
            "ticker": ticker,
            "price": fmt_price(last_price),
            "currency": "KRW" if ticker.endswith(".KS") else "USD",
            "score": score,
            "reasons": reasons,
            "indicators": indicators,
            "strategies": strategies,  # [추가] 전략 데이터 반환
            "turnover": {
                "rate": f"{turnover_rate:.2f}",  # 예: "3.52"
                "msg": turnover_msg,             # 예: "보통/활발"
                "volume": f"{current_volume:,.0f}", # 현재 거래량
                "shares": f"{shares_outstanding:,.0f}" # 전체 주식수
            }
        }
    except Exception as e:
        print(f"Error: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)