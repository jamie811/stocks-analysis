import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [ticker, setTicker] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // ★ 본인 Render 주소 확인 필수
  const API_BASE_URL = window.location.hostname === "localhost" 
    ? "http://127.0.0.1:8010" 
    : "https://my-stock-api.onrender.com"; 

  // 초기 설정
  const defaultSettings = {
    maInterval: "1wk", maShort: 50, maLong: 200,
    macdInterval: "1wk", macdFast: 12, macdSlow: 26, macdSignal: 9,
    rsiInterval: "1d", rsiPeriod: 14,
    stochInterval: "1d", stochK: 14,
    bbInterval: "1d", bbLength: 20,
    wMa: 1.5, wMacd: 1.0, wRsi: 1.0, wStoch: 0.5, wBb: 1.0,
    kisAppKey: "", kisSecret: "", geminiApiKey: ""
  };

  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    const saved = localStorage.getItem('myStockSettings');
    if (saved) { try { setSettings(prev => ({ ...prev, ...JSON.parse(saved) })); } catch (e) {} }
  }, []);

  useEffect(() => {
    localStorage.setItem('myStockSettings', JSON.stringify(settings));
  }, [settings]);

  const timeframes = [ { value: "60m", label: "60분" }, { value: "1d", label: "일봉" }, { value: "1wk", label: "주봉" }, { value: "1mo", label: "월봉" } ];

  const handleAnalyze = async () => {
    if (!ticker) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const params = {
        ma_interval: settings.maInterval, ma_short: settings.maShort, ma_long: settings.maLong,
        rsi_interval: settings.rsiInterval, rsi_period: settings.rsiPeriod,
        macd_interval: settings.macdInterval, macd_fast: settings.macdFast, macd_slow: settings.macdSlow, macd_signal: settings.macdSignal,
        stoch_interval: settings.stochInterval, stoch_k: settings.stochK,
        bb_interval: settings.bbInterval, bb_length: settings.bbLength,
        w_ma: settings.wMa, w_macd: settings.wMacd, w_rsi: settings.wRsi, w_stoch: settings.wStoch, w_bb: settings.wBb,
      };
      const queryParams = new URLSearchParams(params).toString();
      
      const response = await axios.get(`${API_BASE_URL}/analyze/${ticker}?${queryParams}`, {
        headers: {
            "kis-appkey": settings.kisAppKey,
            "kis-secret": settings.kisSecret,
            "gemini-api-key": settings.geminiApiKey
        }
      });
      
      if (response.data.error) setError(response.data.error);
      else setResult(response.data);
    } catch (err) { setError("서버 통신 오류 (잠시 후 다시 시도)"); } 
    finally { setLoading(false); }
  };

  const getScoreColor = (score) => {
    if (score >= 70) return "text-red-500";
    if (score <= 30) return "text-blue-500";
    return "text-yellow-400";
  };

  const TimeSelect = ({ value, onChange }) => (
    <select value={value} onChange={onChange} className="bg-gray-700 text-xs rounded p-1 ml-2 border border-gray-600 outline-none cursor-pointer">
      {timeframes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
    </select>
  );

  const WeightSlider = ({ label, value, onChange, color="text-gray-400" }) => (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className={color}>{label}</span><span className="font-bold text-yellow-400">x{value}</span>
      </div>
      <input type="range" min="0" max="3" step="0.5" value={value} onChange={onChange} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10 px-4 font-sans">
      <h1 className="text-4xl md:text-6xl font-extrabold py-6 mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-500 drop-shadow-lg">
        AI Trading Analyst
      </h1>
      <p className="text-gray-400 mb-8 text-sm text-center">Top-Down Analysis System</p>

      {/* 입력창 */}
      <div className="flex w-full max-w-md gap-2 mb-6">
        <input type="text" placeholder="티커 (예: 005930, TSLA)" className="flex-1 p-4 rounded-xl bg-gray-800 border border-gray-700 focus:border-yellow-500 text-lg uppercase font-bold tracking-wider"
          value={ticker} onChange={(e) => setTicker(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()} />
        <button onClick={handleAnalyze} disabled={loading} className="bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-500 text-black font-bold py-4 px-6 rounded-xl transition disabled:opacity-50 shadow-lg">
          {loading ? "..." : "분석"}
        </button>
      </div>

      <button onClick={() => setShowSettings(!showSettings)} className="text-gray-400 text-xs underline mb-6 hover:text-white transition">
        {showSettings ? "▲ 설정" : "▼ 설정"}
      </button>

      {/* 설정창 */}
      {showSettings && (
        <div className="w-full max-w-2xl bg-gray-800 p-6 rounded-xl mb-6 border border-gray-700 shadow-2xl">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                 <div>
                    <h3 className="font-bold text-white border-b border-gray-600 pb-2 mb-3 text-sm flex items-center gap-2">🤖 Gemini API</h3>
                    <input type="password" placeholder="API Key" className="w-full bg-gray-700 rounded p-2 text-xs border border-gray-600 text-white" value={settings.geminiApiKey} onChange={e=>setSettings({...settings, geminiApiKey:e.target.value})} />
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline mt-1 block text-right">👉 키 발급 (무료)</a>
                 </div>
                 <div>
                    <h3 className="font-bold text-white border-b border-gray-600 pb-2 mb-3 text-sm flex items-center gap-2">🇰🇷 한투 API</h3>
                    <input type="password" placeholder="App Key" className="w-full bg-gray-700 rounded p-2 text-xs mb-2 border border-gray-600" value={settings.kisAppKey} onChange={e=>setSettings({...settings, kisAppKey:e.target.value})} />
                    <input type="password" placeholder="Secret Key" className="w-full bg-gray-700 rounded p-2 text-xs border border-gray-600" value={settings.kisSecret} onChange={e=>setSettings({...settings, kisSecret:e.target.value})} />
                 </div>
                 <div>
                    <h3 className="font-bold text-white border-b border-gray-600 pb-2 mb-3 text-sm">⏱️ 타임프레임</h3>
                    <div className="grid grid-cols-1 gap-2">
                        <div className="flex justify-between items-center bg-gray-700/30 p-2 rounded"><span className="text-yellow-300 text-xs font-bold">MA / MACD</span><div className="flex"><TimeSelect value={settings.maInterval} onChange={e=>{setSettings({...settings, maInterval:e.target.value})}}/><TimeSelect value={settings.macdInterval} onChange={e=>{setSettings({...settings, macdInterval:e.target.value})}}/></div></div>
                        <div className="flex justify-between items-center bg-gray-700/30 p-2 rounded"><span className="text-blue-300 text-xs font-bold">RSI / Bolliger Band</span><div className="flex"><TimeSelect value={settings.rsiInterval} onChange={e=>{setSettings({...settings, rsiInterval:e.target.value})}}/><TimeSelect value={settings.bbInterval} onChange={e=>{setSettings({...settings, bbInterval:e.target.value})}}/></div></div>
                    </div>
                 </div>
              </div>
              <div>
                <h3 className="font-bold text-white border-b border-gray-600 pb-2 mb-3 text-sm">⚖️ 지표 가중치</h3>
                <WeightSlider label="이동평균(MA)" value={settings.wMa} color="text-yellow-300 font-bold" onChange={e => setSettings({...settings, wMa: parseFloat(e.target.value)})} />
                <WeightSlider label="MACD" value={settings.wMacd} color="text-yellow-300 font-bold" onChange={e => setSettings({...settings, wMacd: parseFloat(e.target.value)})} />
                <WeightSlider label="RSI" value={settings.wRsi} color="text-blue-300 font-bold" onChange={e => setSettings({...settings, wRsi: parseFloat(e.target.value)})} />
                <WeightSlider label="Bollinger" value={settings.wBb} color="text-blue-300 font-bold" onChange={e => setSettings({...settings, wBb: parseFloat(e.target.value)})} />
                <WeightSlider label="Stochastic" value={settings.wStoch} onChange={e => setSettings({...settings, wStoch: parseFloat(e.target.value)})} />
              </div>
           </div>
        </div>
      )}

      {error && <div className="bg-red-500/20 text-red-200 px-6 py-3 rounded-xl mb-6 border border-red-500/50">🚨 {error}</div>}

      {result && (
        <div className="w-full max-w-2xl space-y-6 animate-fade-in-up">
            
            {/* [AI Advice] 최상단 배치 */}
            {result.ai_message && (
               <div className="bg-gradient-to-r from-indigo-900/80 to-purple-900/80 p-5 rounded-xl border border-indigo-500/30 shadow-lg flex gap-4 items-start">
                   <div className="text-3xl bg-indigo-500/20 p-2 rounded-full">🤖</div>
                   <div>
                       <h4 className="text-indigo-300 font-bold text-xs uppercase mb-2">AI Analyst's Advice</h4>
                       <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">{result.ai_message}</p>
                   </div>
               </div>
            )}

          {/* ==========================================================
              1. 🌍 MARKET & TREND (추세 확인 파트)
              지표: VIX, 회전율, 이동평균선(MA), MACD, OBV
              ========================================================== */}
          <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 p-3 border-b border-gray-700 flex justify-between items-center">
                <h2 className="font-bold text-sm text-blue-200 flex items-center gap-2">🌍 MARKET & TREND <span className="text-[10px] opacity-70"></span></h2>
                {result.vix && <span className={`text-xs font-bold px-2 py-0.5 rounded ${parseFloat(result.vix.score)>=20?'bg-red-500/20 text-red-300':'bg-green-500/20 text-green-300'}`}>VIX {result.vix.score}</span>}
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center border-b border-gray-700">
                {/* 종목 정보 & 수급 */}
                <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <h3 className="text-2xl font-extrabold">{result.ticker}</h3>
                        {result.real_time && <span className="bg-red-600 text-white text-[10px] px-1.5 rounded animate-pulse">LIVE</span>}
                    </div>
                    <p className="text-3xl font-bold text-white mb-2">{result.price} <span className="text-sm text-gray-500">{result.currency}</span></p>
                    
                    <div className="inline-flex items-center gap-2 bg-gray-700/50 px-3 py-1.5 rounded-lg border border-gray-600 mt-2">
                        <span className="text-xs text-gray-400">시장관심도</span>
                        <span className="text-sm font-bold text-white">{result.turnover.rate}%</span>
                        <span className="text-xs text-yellow-400">({result.turnover.msg})</span>
                    </div>
                </div>

                {/* 추세 배지 (Trend Status) */}
                {result.trend_status && (
                    <div className={`rounded-xl p-3 border flex flex-col justify-center items-center text-center ${
                        result.trend_status.color === 'red' ? 'bg-red-500/10 border-red-500/50' :
                        result.trend_status.color === 'blue' ? 'bg-blue-500/10 border-blue-500/50' :
                        result.trend_status.color === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-gray-700/30 border-gray-600'
                    }`}>
                        <span className="text-2xl mb-1">
                            {result.trend_status.color === 'red' ? '🔥' : result.trend_status.color === 'blue' ? '💎' : result.trend_status.color === 'yellow' ? '🚧' : '☁️'}
                        </span>
                        <span className="font-bold text-sm text-white">{result.trend_status.msg}</span>
                        <div className="flex gap-2 text-[10px] text-gray-400 mt-1">
                            <span>주봉: {result.trend_status.weekly}</span>|<span>일봉: {result.trend_status.daily}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* 추세 지표 상세 (MA, MACD, OBV) */}
            <div className="p-4 bg-gray-900/30 grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-800/50 p-2 rounded border border-gray-700">
                    <span className="text-[10px] text-yellow-400 block mb-1">이평선 (MA)</span>
                    <span className="text-xs font-mono text-white">{result.indicators.MA_Cross}</span>
                </div>
                <div className="bg-gray-800/50 p-2 rounded border border-gray-700">
                    <span className="text-[10px] text-yellow-400 block mb-1">MACD</span>
                    <span className="text-xs font-mono text-white">{result.indicators.MACD}</span>
                </div>
                <div className="bg-gray-800/50 p-2 rounded border border-gray-700">
                    <span className="text-[10px] text-gray-400 block mb-1">OBV (거래량)</span>
                    <span className="text-xs font-mono text-white">{result.indicators.OBV}</span>
                </div>
            </div>
          </div>

          {/* ==========================================================
              2. ⚡ TRADING TIMING (매매 타이밍 파트)
              지표: 종합점수, RSI, 스토캐스틱, 볼린저밴드, 지지/저항, ATR전략
              ========================================================== */}
          <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-green-900/50 to-teal-900/50 p-3 border-b border-gray-700">
                <h2 className="font-bold text-sm text-green-200 flex items-center gap-2">⚡ TRADING TIMING <span className="text-[10px] opacity-70"></span></h2>
            </div>

            <div className="p-6">
                {/* 점수판 */}
                <div className="flex flex-col items-center mb-8">
                    <div className={`text-6xl font-black ${getScoreColor(result.score)} drop-shadow-2xl`}>{result.score}</div>
                    <p className={`text-lg font-bold mt-2 ${getScoreColor(result.score)}`}>
                        {result.score >= 70 ? "매수 시그널 🚀" : result.score <= 30 ? "매도/관망 시그널 📉" : "중립 / 홀딩 ⚖️"}
                    </p>
                </div>

                {/* 지지/저항 (볼린저 기준) */}
                {result.sr && (
                    <div className="mb-8 px-2">
                        <div className="flex justify-between text-xs mb-2 font-mono">
                            <span className="text-blue-400">▼ {result.sr.support}</span>
                            <span className="text-xs text-gray-400">현재 위치 ({result.sr.position}%)</span>
                            <span className="text-red-400">{result.sr.resistance} ▲</span>
                        </div>
                        <div className="w-full h-3 bg-gray-700 rounded-full relative overflow-hidden">
                            <div className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-500 via-yellow-400 to-red-500" style={{ width: `${Math.max(0, Math.min(100, result.sr.position))}%` }}></div>
                            <div className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_white]" style={{ left: `${Math.max(0, Math.min(100, result.sr.position))}%` }}></div>
                        </div>
                    </div>
                )}

                {/* ATR 전략 */}
                <h3 className="text-gray-400 font-bold text-xs uppercase mb-3 flex justify-between"><span>🎯 ATR 목표가 ({result.strategies.atr})</span></h3>
                <div className="grid grid-cols-3 gap-2 md:gap-4 text-center mb-6">
                    <div className="bg-gray-700/30 p-3 rounded-lg border border-gray-600 hover:bg-gray-700/50 transition">
                        <h4 className="text-yellow-400 text-xs font-bold mb-2">⚡ 단타</h4>
                        <div className="text-[10px] space-y-1 font-mono"><p className="text-gray-300">TP <span className="text-red-400">{result.strategies.scalp.tp}</span></p><p className="text-gray-300">SL <span className="text-blue-400">{result.strategies.scalp.sl}</span></p></div>
                    </div>
                    <div className="bg-gray-700/50 p-3 rounded-lg border border-blue-500 shadow-lg transform scale-105">
                        <h4 className="text-green-400 text-xs font-bold mb-2">🌊 스윙 (추천)</h4>
                        <div className="text-[10px] space-y-1 font-mono"><p className="text-gray-300">TP <span className="text-red-400 font-bold">{result.strategies.swing.tp}</span></p><p className="text-gray-300">SL <span className="text-blue-400 font-bold">{result.strategies.swing.sl}</span></p></div>
                    </div>
                    <div className="bg-gray-700/30 p-3 rounded-lg border border-gray-600 hover:bg-gray-700/50 transition">
                        <h4 className="text-purple-400 text-xs font-bold mb-2">💎 장투</h4>
                        <div className="text-[10px] space-y-1 font-mono"><p className="text-gray-300">TP <span className="text-red-400">{result.strategies.long.tp}</span></p><p className="text-gray-300">SL <span className="text-blue-400">{result.strategies.long.sl}</span></p></div>
                    </div>
                </div>

                {/* 타이밍 지표 상세 (RSI, BB, Stoch) */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-700/30 p-2 rounded border border-gray-600">
                        <span className="text-[10px] text-blue-300 block mb-1">RSI</span>
                        <span className="text-xs font-mono text-white">{result.indicators.RSI}</span>
                    </div>
                    <div className="bg-gray-700/30 p-2 rounded border border-gray-600">
                        <span className="text-[10px] text-blue-300 block mb-1">Bollinger</span>
                        <span className="text-xs font-mono text-white">{result.indicators.BB}</span>
                    </div>
                    <div className="bg-gray-700/30 p-2 rounded border border-gray-600">
                        <span className="text-[10px] text-blue-300 block mb-1">Stochastic</span>
                        <span className="text-xs font-mono text-white">{result.indicators.Stoch}</span>
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;