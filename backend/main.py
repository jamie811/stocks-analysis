# backend/main.py
from fastapi import FastAPI, Query, Header
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import pandas_ta as ta
import requests
import google.generativeai as genai
import time
import zipfile
import io
import os

NAME_TO_CODE = {}
CODE_TO_NAME = {}
SEARCH_MAP = {}

def load_kis_master_data():
    global NAME_TO_CODE, CODE_TO_NAME, SEARCH_MAP
    print("⏳ KIS 종목 마스터 파일 다운로드 중... (서버 시작 시 1회)")
    
    urls = {
        "kospi": "https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip",
        "kosdaq": "https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip"
    }

    try:
        count = 0
        for market, url in urls.items():
            res = requests.get(url)
            if res.status_code != 200:
                print(f"❌ {market} 다운로드 실패")
                continue
                
            with zipfile.ZipFile(io.BytesIO(res.content)) as zf:
                file_name = zf.namelist()[0] 
                with zf.open(file_name) as f:
                    content = f.read()
                    lines = content.split(b'\n')
                    
                    for line in lines:
                        if len(line) < 30: continue
                        
                        try:
                            # 단축코드 (9자리) -> ASCII 디코딩
                            code_bytes = line[0:9]
                            code = code_bytes.decode('ascii').strip()
                            
                            # 한글명 (21번째부터 40바이트 길이) -> CP949 디코딩
                            # 61번째 바이트까지만 잘라야 뒤에 붙은 쓰레기값이 안 들어옵니다.
                            name_bytes = line[21:61] 
                            name = name_bytes.decode('cp949').strip()
                            
                            # 단축코드에서 'A'로 시작하는 경우 등을 처리 (보통 1번째부터)
                            short_code = code[1:7] if len(code) >= 7 else code
                        
                            if name and short_code:
                                NAME_TO_CODE[name] = short_code
                                CODE_TO_NAME[short_code] = name
                                
                                search_key = name.upper().replace(" ", "")
                                SEARCH_MAP[search_key] = short_code
                                
                                count += 1
                                
                        except Exception as parse_err:
                            # 인코딩 에러 등이 나면 해당 라인은 건너뜀
                            continue

        print(f"✅ KIS 종목 마스터 로드 완료! (총 {len(NAME_TO_CODE)}개 종목)")
        
    except Exception as e:
        print(f"🚨 마스터 파일 로드 실패: {e}")

load_kis_master_data()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_ticker_symbol(keyword):
    keyword_clean = keyword.strip().upper().replace(" ", "")
    
    if keyword_clean in SEARCH_MAP:
        return f"{SEARCH_MAP[keyword_clean]}.KS"
    
    if keyword in NAME_TO_CODE:
        return f"{NAME_TO_CODE[keyword]}.KS"
    
    if keyword.isdigit() and len(keyword) == 6:
        return f"{keyword}.KS"
        
    return keyword.upper()

def get_period_by_interval(interval):
    if interval in ["1m", "2m", "5m"]: return "5d"
    if interval in ["15m", "30m", "60m", "90m", "1h"]: return "1mo"
    return "2y"


# [KIS] 토큰 발급
def get_kis_token(appkey, appsecret, header_token=None):
    if header_token and len(header_token) > 10:
        return header_token, False
        
    url = "https://openapi.koreainvestment.com:9443/oauth2/tokenP"
    body = {"grant_type": "client_credentials", "appkey": appkey, "appsecret": appsecret}
    try:
        res = requests.post(url, json=body)
        data = res.json()
        new_token = data.get("access_token")
        if new_token:
            return new_token, True

    except Exception as e:
        print(f"Token Error: {e}")
        return None, False
    
def get_kis_investors(ticker, token, appkey, appsecret):
    url = "https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-investor"
    # TR_ID: FHKST01010900 (현물 투자자별 매매동향)
    headers = {"content-type": "application/json", "authorization": f"Bearer {token}", "appkey": appkey, "appsecret": appsecret, "tr_id": "FHKST01010900"}
    params = {"fid_cond_mrkt_div_code": "J", "fid_input_iscd": ticker.replace(".KS", "")}
    
    try:
        res = requests.get(url, headers=headers, params=params)
        data = res.json()
        if data['rt_cd'] == '0' and data['output']:
            todays = data['output'][0]
            return {
                "individual": int(todays.get('prsn_ntby_qty', 0)),
                "foreigner": int(todays.get('frgn_ntby_qty', 0)),
                "institution": int(todays.get('orgn_ntby_qty', 0)),
                "date": todays.get('stck_bsop_date', '')
            }
        return None
    except Exception as e:
        print(f"KIS Investor Error: {e}")
        return None

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
    kis_appkey: str = Header(None), kis_secret: str = Header(None), gemini_api_key: str = Header(None), gemini_model: str = Header("models/gemini-2.0-flash"),
    kis_access_token: str = Header(None),
):
    ticker = get_ticker_symbol(keyword)
    import re
    
    is_korean = ticker.endswith(".KS")
    if re.search("[가-힣]", ticker):
        return {"error": f"'{keyword}'에 대한 종목 코드를 찾을 수 없습니다. 정확한 회사명이나 코드를 입력해주세요."}
    
    stock_name = ticker
    if is_korean:
        short_code = ticker.replace(".KS", "")
        if short_code in CODE_TO_NAME:
            stock_name = CODE_TO_NAME[short_code]
        elif keyword in NAME_TO_CODE:
            stock_name = keyword
    
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
        investor_trend = None
        new_issued_token = None
        token_expire_time = None
        
        if ticker.endswith(".KS") and kis_appkey and kis_secret:
            token, is_new = get_kis_token(kis_appkey, kis_secret, kis_access_token)
            
            if token:
                if is_new:
                    new_issued_token = token
                    token_expire_time = int(time.time()) + (23 * 60 * 60)
                    
                cp = get_kis_price(ticker, token, kis_appkey, kis_secret)
                if cp:
                    for k in data_store:
                        data_store[k].iloc[-1, data_store[k].columns.get_loc('Close')] = cp
                    real_time_applied = True
                investor_trend = get_kis_investors(ticker, token, kis_appkey, kis_secret)

        main_df = data_store.get(ma_interval, data_store["1d"]).copy()
        last_price = main_df['Close'].iloc[-1]
        analyst_data = {"recommendation": "-", "target_mean": "-", "target_low": "-", "target_high": "-", "upside": "-"}
        try:
            info = yf.Ticker(ticker).info
            rec_key = info.get('recommendationKey', 'none')
            t_mean = info.get('targetMeanPrice', None)
            
            rec_map = {"buy": "매수", "strong_buy": "강력매수", "hold": "중립", "sell": "매도", "underperform": "비중축소", "none": "-"}
            analyst_data['recommendation'] = rec_map.get(rec_key, rec_key.upper())
            
            if t_mean:
                analyst_data['target_mean'] = f"{t_mean:,.0f}" if is_korean else f"{t_mean:.2f}"
                analyst_data['target_low'] = f"{info.get('targetLowPrice', 0):,.0f}" if is_korean else f"{info.get('targetLowPrice', 0):.2f}"
                analyst_data['target_high'] = f"{info.get('targetHighPrice', 0):,.0f}" if is_korean else f"{info.get('targetHighPrice', 0):.2f}"
                
                upside = ((t_mean - last_price) / last_price) * 100
                analyst_data['upside'] = f"{upside:.2f}%"
        except: pass

        # ---------------------------------------------------------
        # [점수 산출]
        # ---------------------------------------------------------
        ws_sum = 0; tot_w = 0; reasons = []; indicators = {}
        def add_sc(s, w, r, k, v): nonlocal ws_sum, tot_w; ws_sum+=s*w; tot_w+=100*w; reasons.append(r) if r else None; indicators[k]=v

        # 1. MA (이평선) - 수정됨: 이름표를 "MA_Cross"로 통일
        try:
            if len(main_df) >= 20: main_df.ta.sma(length=20, append=True)
            if len(main_df) >= 60: main_df.ta.sma(length=60, append=True)
            
            ma20 = main_df['SMA_20'].iloc[-1]
            ma60 = main_df['SMA_60'].iloc[-1]
            
            # 이격도 계산 (현재가 / 20일선 * 100)
            disparity = (last_price / ma20) * 100
            
            ma_score = 50
            ma_msg = None
            
            # [전략] 20일선 근처(98~102%)에 붙어있거나, 살짝 아래(95~98%)일 때 매수 기회
            if 95 <= disparity <= 103:
                ma_score = 90
                ma_msg = "이평선 지지/눌림목"
                # 만약 골든크로스(5>20) 초기라면 가산점
                if len(main_df) >= 5:
                    main_df.ta.sma(length=5, append=True)
                    ma5 = main_df['SMA_5'].iloc[-1]
                    p5 = main_df['SMA_5'].iloc[-2]; p20 = main_df['SMA_20'].iloc[-2]
                    if p5 < p20 and ma5 > ma20:
                        ma_score = 100
                        ma_msg = "이평선 골든크로스"
                        reasons.append("★ 골든크로스 발생")

            # 너무 높음 (110% 이상) -> 과열 (감점)
            elif disparity >= 110:
                ma_score = 20
                ma_msg = "단기 과열 (이격 과대)"
            
            # 너무 낮음 (90% 이하) -> 역배열 심화 (주의)
            elif disparity <= 90:
                ma_score = 40
                ma_msg = "역배열 하락세"

            add_sc(ma_score, w_ma, ma_msg, "MA_Pos", f"이격도 {int(disparity)}%")
        except: add_sc(50, w_ma, None, "MA_Pos", "계산중")

        # 2. RSI
        try:
            rsi = main_df.ta.rsi(length=14, append=False).iloc[-1]
            rsi_score = 100 - rsi
            msg = "RSI 과매도" if rsi <= 30 else "RSI 과매수" if rsi >= 70 else None
            add_sc(rsi_score, w_rsi, msg, "RSI", f"{rsi:.2f}")
        except: indicators["RSI"] = "-"

        # 3. Stoch
        try:
            # K=14, D=3, Slow D=3
            stoch = main_df.ta.stoch(k=14, d=3, append=False)
            curr_k = stoch.iloc[-1, 0]  # 현재 %K
            curr_d = stoch.iloc[-1, 1]  # 현재 %D
            prev_k = stoch.iloc[-2, 0]  # 전일 %K
            prev_d = stoch.iloc[-2, 1]  # 전일 %D
            
            stoch_score = 100 - curr_k
            stoch_msg = None

            if curr_k <= 20 and prev_k < prev_d and curr_k > curr_d:
                stoch_score = 100  # 강력 매수
                stoch_msg = "Stoch 과매도 골든크로스"
                reasons.append(stoch_msg)
            
            elif curr_k >= 80 and prev_k > prev_d and curr_k < curr_d:
                stoch_score = 0  # 강력 매도
                stoch_msg = "Stoch 과매수 데드크로스"
                reasons.append(stoch_msg)

            curr_price = main_df['Close'].iloc[-1]
            prev_price = main_df['Close'].iloc[-2]
            
            if curr_price < prev_price and curr_k > prev_k:
                stoch_score += 20
                div_msg = "상승 다이버전스 감지"
                reasons.append(div_msg)
                stoch_msg = f"{stoch_msg}, {div_msg}" if stoch_msg else div_msg

            final_stoch_score = max(0, min(100, stoch_score))
            
            add_sc(final_stoch_score, w_stoch, None, "Stoch", f"K{curr_k:.1f}/D{curr_d:.1f}")

        except Exception as e: 
            indicators["Stoch"] = "-"
            print(f"Stoch Error: {e}")

        # 4. MACD
        try:
            macd = main_df.ta.macd(fast=12, slow=26, signal=9)
            curr_m = macd.iloc[-1, 0]; curr_s = macd.iloc[-1, 2] # MACD, Signal
            prev_m = macd.iloc[-2, 0]; prev_s = macd.iloc[-2, 2]
            
            m_score = 50
            m_msg = None
            
            # [전략] 0선 아래(바닥권)에서 골든크로스 발생 시 최고점
            if curr_m < 0 and curr_s < 0:
                if prev_m < prev_s and curr_m > curr_s: # 골든크로스
                    m_score = 100
                    m_msg = "바닥권 추세 전환 (MACD Golden)"
                    reasons.append("★ MACD 바닥권 반등")
                elif curr_m > curr_s: # 상승 지속
                    m_score = 80
                    m_msg = "바닥권 상승 시도"
                else:
                    m_score = 20 # 하락 지속
            
            # 0선 위(상승장)에서는 점수를 조금 낮게 (이미 올랐으므로)
            elif curr_m > 0:
                if curr_m > curr_s: m_score = 60 # 상승 지속 (But 비쌈)
                else: m_score = 0 # 하락 반전 (매도)

            add_sc(m_score, w_macd, m_msg, "MACD", f"{curr_m:.2f}")
        except: indicators["MACD"]="-"

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
        
        try:
            # 1. 지지선 (Support): 최근 20일(영업일 기준 한달) 중 최저가
            # 의미: "이 가격 깨지면 바닥 뚫린 것" (손절 라인)
            recent_low = main_df['Low'].tail(20).min()
            
            # 2. 저항선 (Resistance): 20일 이동평균선
            # 의미: "하락 추세에서 반등 시 1차 목표치"
            # 만약 현재가가 20일선보다 위에 있다면? -> 최근 20일 최고가를 저항선으로 잡음
            ma20_val = main_df['SMA_20'].iloc[-1] if 'SMA_20' in main_df else main_df['Close'].mean()
            recent_high = main_df['High'].tail(20).max()
            
            if last_price < ma20_val:
                resistance_price = ma20_val # 아직 역배열이면 20일선이 저항
            else:
                resistance_price = recent_high # 정배열이면 전고점이 저항

            # 현재가 위치 비율 (지지선 ~ 저항선 사이 어디쯤인지)
            # 0%에 가까울수록 지지선(바닥) 근처, 100%에 가까울수록 저항선(천장) 근처
            position_score = (last_price - recent_low) / (resistance_price - recent_low) * 100
            
            sr_data = {
                "support": fmt(recent_low),
                "resistance": fmt(resistance_price),
                "position": int(position_score)
            }
        except:
            sr_data = {"support": "-", "resistance": "-", "position": 50}
        
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
                inv_str = "정보 없음"
                if investor_trend:
                    inv_str = f"개인 {investor_trend['individual']}, 외인 {investor_trend['foreigner']}, 기관 {investor_trend['institution']}"

                # 애널리스트 데이터 포맷팅
                analyst_str = "정보 없음"
                if analyst_data and analyst_data.get('upside') != "-":
                    analyst_str = f"투자의견 {analyst_data['recommendation']}, 상승여력 {analyst_data['upside']}"
                    
                prompt = f"""
                당신은 '저점 매수(Bottom Fishing)' 및 '기술적 반등'을 전문으로 분석하는 AI 애널리스트입니다.
                현재 주가가 바닥권인지, 아니면 추가 하락 위험이 있는지 분석하여 3문장으로 요약해 주세요.

                [분석 데이터]
                1. 종목: {stock_name} ({ticker})
                2. 저점 매수 점수: {final_score}점 (100점에 가까울수록 과매도 후 반등 가능성 높음)
                3. 감지된 시그널: {', '.join(reasons) if reasons else '특이사항 없음'}
                4. 수급 현황(일별): {inv_str}
                5. 월가/증권사 의견: {analyst_str}

                [분석 가이드]
                - 시그널(RSI 과매도, 스토캐스틱 골든크로스 등)이 있다면 이를 근거로 반등 가능성을 언급하세요.
                - 외인/기관의 수급이 들어오고 있다면 바닥 다지기 신호로 해석하세요.
                - 점수가 낮다면 '아직 하락 추세가 강해 바닥을 확인하지 못했다'는 취지로 경고하세요.
                - 말투는 전문적이고 간결하게 작성하세요.
                """
                model_name = gemini_model if gemini_model else "models/gemini-2.0-flash"
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                ai_comment = response.text.strip()
            except Exception as e: ai_comment = str(e)

        return {
            "ticker": ticker, "name": stock_name, "price": fmt(last_price), "currency": "KRW" if is_korean else "USD",
            "score": final_score, "reasons": reasons, "indicators": indicators, "strategies": strategies,
            "turnover": {"rate": f"{tr:.2f}", "msg": t_msg, "volume": f"{vol:,.0f}", "shares": f"{shares:,.0f}"},
            "real_time": real_time_applied, "vix": {"score": f"{vix_val:.2f}", "msg": vix_msg},
            "trend_status": trend_status, "ai_message": ai_comment,
            "analyst": analyst_data, "investors": investor_trend,
            "auth_info": { "token": new_issued_token, "expire": token_expire_time }, "sr": sr_data,
        }

    except Exception as e:
        print(f"Error: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8010, reload=True)