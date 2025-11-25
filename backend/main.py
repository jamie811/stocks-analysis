# backend/main.py
from fastapi import FastAPI, Query, Header
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import pandas_ta as ta
import requests
import google.generativeai as genai

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

# [KIS] 토큰 발급
def get_kis_token(appkey, appsecret):
    url = "https://openapi.koreainvestment.com:9443/oauth2/tokenP"
    body = {"grant_type": "client_credentials", "appkey": appkey, "appsecret": appsecret}
    try:
        res = requests.post(url, json=body)
        return res.json().get("access_token")
    except: return None

# [KIS] 현재가 조회
def get_kis_price(ticker, token, appkey, appsecret):
    url = "https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price"
    headers = {"content-type": "application/json", "authorization": f"Bearer {token}", "appkey": appkey, "appsecret": appsecret, "tr_id": "FHKST01010100"}
    params = {"fid_cond_mrkt_div_code": "J", "fid_input_iscd": ticker.replace(".KS", "")}
    try:
        res = requests.get(url, headers=headers, params=params)
        data = res.json()
        if data['rt_cd'] == '0': return float(data['output']['stck_prpr'])
        return None
    except: return None

@app.get("/models")
def get_gemini_models(gemini_api_key: str = Header(None)):
    if not gemini_api_key:
        return {"error": "API Key가 필요합니다."}
    try:
        genai.configure(api_key=gemini_api_key)
        models = []
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                models.append(m.name)
        return {"models": models}
    except Exception as e:
        return {"error": str(e)}
    
@app.get("/analyze/{keyword}")
def analyze_stock(
    keyword: str,
    ma_interval: str = Query("1d"), 
    w_ma: float = Query(1.5), w_rsi: float = Query(1.0), w_macd: float = Query(1.0), w_stoch: float = Query(0.5), w_bb: float = Query(1.0),
    kis_appkey: str = Header(None), kis_secret: str = Header(None), gemini_api_key: str = Header(None), gemini_model: str = Header("models/gemini-2.0-flash")
):
    ticker = get_ticker_symbol(keyword)
    is_korean = ticker.endswith(".KS")
    
    req_intervals = list(set(["60m", "1d", "1wk", ma_interval]))
    data_store = {}

    try:
        # 1. 데이터 수집
        for interval in req_intervals:
            period = get_period_by_interval(interval)
            df = yf.download(ticker, interval=interval, period=period, auto_adjust=True, progress=False)
            if isinstance(df.columns, pd.MultiIndex): df.columns = df.columns.get_level_values(0)
            if not df.empty: data_store[interval] = df
        
        if "1d" not in data_store: return {"error": "데이터 부족"}

        # 2. 실시간 시세 (KIS)
        real_time_applied = False
        if is_korean and kis_appkey and kis_secret:
            token = get_kis_token(kis_appkey, kis_secret)
            if token:
                cp = get_kis_price(ticker, token, kis_appkey, kis_secret)
                if cp:
                    for k in data_store:
                        data_store[k].iloc[-1, data_store[k].columns.get_loc('Close')] = cp
                    real_time_applied = True

        main_df = data_store.get(ma_interval, data_store["1d"]).copy()
        last_price = main_df['Close'].iloc[-1]

        # ---------------------------------------------------------
        # [점수 산출]
        # ---------------------------------------------------------
        ws_sum = 0; tot_w = 0; reasons = []; indicators = {}
        def add_sc(s, w, r, k, v): nonlocal ws_sum, tot_w; ws_sum+=s*w; tot_w+=100*w; reasons.append(r) if r else None; indicators[k]=v

        # 1. MA (이평선) - 수정됨: 이름표를 "MA_Cross"로 통일
        try:
            data_len = len(main_df)
            if data_len >= 5: main_df.ta.sma(length=5, append=True)
            if data_len >= 20: main_df.ta.sma(length=20, append=True)
            if data_len >= 60: main_df.ta.sma(length=60, append=True)
            if data_len >= 120: main_df.ta.sma(length=120, append=True)
            
            curr = main_df.iloc[-1]
            prev = main_df.iloc[-2]
            
            ma5 = curr.get('SMA_5', 0)
            ma20 = curr.get('SMA_20', 0)
            ma60 = curr.get('SMA_60', 0)
            ma120 = curr.get('SMA_120', 0)
            
            p5 = prev.get('SMA_5', 0)
            p20 = prev.get('SMA_20', 0)
            p60 = prev.get('SMA_60', 0)
            
            align_score = 50
            cross_score = 0
            status_list = []
            
            if ma5>0 and ma20>0 and ma60>0 and ma120>0:
                if ma5 > ma20 > ma60 > ma120: align_score = 100; reasons.append("이평선 정배열 (강력 상승)")
                elif ma5 < ma20 < ma60 < ma120: align_score = 0; reasons.append("이평선 역배열 (하락 추세)")
            
            if ma5 > 0 and ma20 > 0:
                if ma5 > ma20: status_list.append("5>20:O")
                else: status_list.append("5>20:X")

                if p5 > 0 and p20 > 0:
                    if p5 <= p20 and ma5 > ma20: cross_score += 20; reasons.append("★ 단기 골든크로스 (5vs20)")
                    elif p5 >= p20 and ma5 < ma20: cross_score -= 20; reasons.append("☠️ 단기 데드크로스 (5vs20)")
                    
            if ma20 > 0 and ma60 > 0:
                if ma20 > ma60: status_list.append("20>60:O")
                else: status_list.append("20>60:X")

                if p20 > 0 and p60 > 0:
                    if p20 <= p60 and ma20 > ma60: cross_score += 30; reasons.append("★★ 중기 골든크로스 (20vs60)")
                    elif p20 >= p60 and ma20 < ma60: cross_score -= 30; reasons.append("☠️☠️ 중기 데드크로스 (20vs60)")

            final_ma = min(100, max(0, align_score + cross_score))
            
            status_msg = " | ".join(status_list) if status_list else "데이터 부족"
            
            add_sc(final_ma, w_ma, None, "MA_Cross", status_msg)
        except Exception as e:
            add_sc(50, w_ma, None, "MA_Cross", "계산 중")

        # 2. RSI
        try:
            rsi = main_df.ta.rsi(length=14, append=False).iloc[-1]
            rsi_score = 100 - rsi
            msg = "RSI 과매도" if rsi <= 30 else "RSI 과매수" if rsi >= 70 else None
            add_sc(rsi_score, w_rsi, msg, "RSI", f"{rsi:.2f}")
        except: indicators["RSI"] = "-"

        # 3. Stoch
        try:
            stoch = main_df.ta.stoch(k=14, d=3, append=False)
            k = stoch.iloc[-1, 0]
            stoch_score = 100 - k
            msg = "스토캐스틱 바닥" if k <= 20 else "스토캐스틱 과열" if k >= 80 else None
            add_sc(stoch_score, w_stoch, msg, "Stoch", f"{k:.2f}")
        except: indicators["Stoch"] = "-"

        # 4. MACD
        try:
            macd = main_df.ta.macd(fast=12, slow=26, signal=9, append=False)
            curr_m = macd.iloc[-1, 0]; prev_m = macd.iloc[-2, 0]
            is_rising = curr_m > prev_m; is_above_zero = curr_m > 0
            
            macd_score = 50
            if is_above_zero and is_rising: macd_score = 100; msg="MACD 상승가속"
            elif not is_above_zero and is_rising: macd_score = 75; msg="MACD 반등시도"
            elif is_above_zero and not is_rising: macd_score = 40; msg="MACD 조정"
            else: macd_score = 0; msg="MACD 하락가속"
            
            add_sc(macd_score, w_macd, msg, "MACD", f"{curr_m:.2f}")
        except: indicators["MACD"] = "-"

        # 5. BB
        try:
            bb = main_df.ta.bbands(length=20, std=2.0, append=False)
            l = bb.iloc[-1, 0]; u = bb.iloc[-1, 2]
            pb = (last_price - l) / (u - l) if (u - l) != 0 else 0.5
            bb_score = (1 - pb) * 100
            bb_score = max(0, min(100, bb_score))
            msg = "볼린저 하단" if pb < 0.1 else "볼린저 상단" if pb > 0.9 else None
            add_sc(bb_score, w_bb, msg, "BB", f"위치 {int(pb*100)}%")
        except: indicators["BB"] = "-"

        # 6. OBV (안전장치 추가)
        try:
            obv_val = main_df.ta.obv(append=False).iloc[-1]
            indicators['OBV'] = f"{obv_val:,.0f}"
        except:
            indicators['OBV'] = "-"

        final_score = int((ws_sum/tot_w)*100) if tot_w > 0 else 50

        # ---------------------------------------------------------
        # 기타 (ATR, VIX, Trend, AI)
        # ---------------------------------------------------------
        # ATR
        atr_1d = data_store["1d"].ta.atr(length=14, append=False).iloc[-1] if len(data_store["1d"]) > 14 else last_price*0.02
        atr_60m = data_store["60m"].ta.atr(length=14, append=False).iloc[-1] if "60m" in data_store else atr_1d*0.25
        atr_1wk = data_store["1wk"].ta.atr(length=14, append=False).iloc[-1] if "1wk" in data_store else atr_1d*2.5
        
        def fmt(n): return f"{int(n):,}" if is_korean else f"{n:.2f}"
        strategies = {
            "atr": fmt(atr_1d),
            "scalp": {"tp": fmt(last_price + atr_60m), "sl": fmt(last_price - atr_60m)},
            "swing": {"tp": fmt(last_price + atr_1d*2), "sl": fmt(last_price - atr_1d*2)},
            "long": {"tp": fmt(last_price + atr_1wk*3), "sl": fmt(last_price - atr_1wk*3)}
        }
        
        # VIX
        try:
            vix_df = yf.download("^VIX", period="5d", progress=False, auto_adjust=True)
            if isinstance(vix_df.columns, pd.MultiIndex): vix_df.columns = vix_df.columns.get_level_values(0)
            vix_val = float(vix_df['Close'].iloc[-1])
            vix_msg = "공포" if vix_val >= 20 else "평온"
        except: vix_val=0; vix_msg="-"

        # Trend Status
        trend_status = {"msg": "-", "color": "gray", "weekly": "-", "daily": "-"}
        if "1wk" in data_store:
            df_w = data_store["1wk"]
            ma20_d = main_df['SMA_20'].iloc[-1] if 'SMA_20' in main_df else last_price
            ma20_w = df_w.ta.sma(length=20, append=False).iloc[-1] if len(df_w)>20 else last_price
            is_d_up = last_price > ma20_d; is_w_up = last_price > ma20_w
            if is_w_up and is_d_up: trend_status={"msg":"🚀 대세 상승", "color":"red", "weekly":"상승", "daily":"상승"}
            elif is_w_up and not is_d_up: trend_status={"msg":"🌊 눌림목", "color":"blue", "weekly":"상승", "daily":"하락"}
            elif not is_w_up and is_d_up: trend_status={"msg":"⚠️ 반등", "color":"yellow", "weekly":"하락", "daily":"상승"}
            else: trend_status={"msg":"📉 하락", "color":"gray", "weekly":"하락", "daily":"하락"}

        # 회전율
        try:
            vol = main_df['Volume'].iloc[-1]
            info = yf.Ticker(ticker).info
            shares = info.get('sharesOutstanding', 1)
            tr = (vol/shares)*100
            t_msg = "활발" if tr > 1 else "조용"
        except: tr=0; t_msg="-"; vol=0; shares=0

        # AI Advice
        ai_comment = None
        if gemini_api_key:
            try:
                genai.configure(api_key=gemini_api_key)
                prompt = f"""
                전문가로서 분석해. 3문장. 매수/매도 추천.
                종목: {ticker}, 점수: {final_score}
                추세: {trend_status['msg']}
                이유: {', '.join(reasons)}
                전략: 스윙TP {strategies['swing']['tp']}
                """
                model_name = gemini_model if gemini_model else "models/gemini-2.0-flash"
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                ai_comment = response.text.strip()
            except Exception as e: ai_comment = str(e)

        return {
            "ticker": ticker, "price": fmt(last_price), "currency": "KRW" if is_korean else "USD",
            "score": final_score, "reasons": reasons, "indicators": indicators, "strategies": strategies,
            "turnover": {"rate": f"{tr:.2f}", "msg": t_msg, "volume": f"{vol:,.0f}", "shares": f"{shares:,.0f}"},
            "real_time": real_time_applied, "vix": {"score": f"{vix_val:.2f}", "msg": vix_msg},
            "trend_status": trend_status, "ai_message": ai_comment
        }

    except Exception as e:
        print(f"Error: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8010, reload=True)