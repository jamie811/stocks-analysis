import React, { useState, useEffect } from 'react';
import axios from 'axios';

// --------------------------------------------------------------------------
// 아이콘 컴포넌트
// --------------------------------------------------------------------------
const StarIcon = ({ filled, onClick }) => (
  <svg onClick={onClick} xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 cursor-pointer transition ${filled ? "text-yellow-400 fill-yellow-400" : "text-gray-400 hover:text-yellow-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);
const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const TrashIcon = ({ onClick }) => (
  <svg onClick={(e) => { e.stopPropagation(); onClick(); }} xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-600 hover:text-red-400 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

function App() {
  const [ticker, setTicker] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // UI 토글 상태 (설정, 즐겨찾기, 기록)
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(true);      // [MODIFIED] 검색 기록 토글
  const [showFavorites, setShowFavorites] = useState(true);  // [NEW] 즐겨찾기 토글 별도 추가

  // 데이터 상태
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);

  const API_BASE_URL = window.location.hostname === "localhost" 
    ? "http://127.0.0.1:8010" 
    : "https://my-stock-api.onrender.com"; 

  const defaultSettings = {
    maInterval: "1wk", maShort: 50, maLong: 200,
    macdInterval: "1wk", macdFast: 12, macdSlow: 26, macdSignal: 9,
    rsiInterval: "1d", rsiPeriod: 14,
    stochInterval: "1d", stochK: 14,
    bbInterval: "1d", bbLength: 20,
    wMa: 1.5, wMacd: 1.0, wRsi: 1.0, wStoch: 0.5, wBb: 1.0,
    kisAppKey: "", kisSecret: "", geminiApiKey: "",
    geminiModel: "models/gemini-2.0-flash"
  };

  // --------------------------------------------------------------------------
  // [Lazy Initialization] 로컬 스토리지에서 설정 바로 읽어오기 (새로고침 유지용)
  // --------------------------------------------------------------------------
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('myStockSettings');
      if (saved) {
        return { ...defaultSettings, ...JSON.parse(saved) };
      }
    } catch (e) {}
    return defaultSettings;
  });

  // 모델 가져오기
  const fetchModels = async (apiKey) => {
    if (!apiKey) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/models`, {
        headers: { "gemini-api-key": apiKey }
      });
      if (res.data.models) {
        setAvailableModels(res.data.models);
      }
    } catch (e) { console.error(e); }
  };

  // 초기 로드 (history, favorites, models)
  useEffect(() => {
    const savedHistory = localStorage.getItem('myStockHistory');
    const savedFavorites = localStorage.getItem('myStockFavorites');

    if (savedHistory) try { setHistory(JSON.parse(savedHistory)); } catch (e) {}
    if (savedFavorites) try { setFavorites(JSON.parse(savedFavorites)); } catch (e) {}

    // 저장된 키가 있으면 모델 로드
    if (settings.geminiApiKey) {
      fetchModels(settings.geminiApiKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 상태 변경 시 저장
  useEffect(() => localStorage.setItem('myStockSettings', JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem('myStockHistory', JSON.stringify(history)), [history]);
  useEffect(() => localStorage.setItem('myStockFavorites', JSON.stringify(favorites)), [favorites]);

  const addToHistory = (symbol) => {
    setHistory(prev => {
      const newHistory = [symbol, ...prev.filter(t => t !== symbol)].slice(0, 5); 
      return newHistory;
    });
  };

  const toggleFavorite = (symbol) => {
    setFavorites(prev => {
      if (prev.includes(symbol)) return prev.filter(t => t !== symbol);
      return [symbol, ...prev];
    });
  };

  const handleAnalyze = async (targetTicker = null) => {
    const searchTicker = targetTicker || ticker;
    if (!searchTicker) return;
    if (targetTicker) setTicker(targetTicker);

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
      
      const response = await axios.get(`${API_BASE_URL}/analyze/${searchTicker}?${queryParams}`, {
        headers: { 
          "kis-appkey": settings.kisAppKey, 
          "kis-secret": settings.kisSecret, 
          "gemini-api-key": settings.geminiApiKey,
          "gemini-model": settings.geminiModel
        }
      });
      
      if (response.data.error) {
        setError(response.data.error);
      } else {
        setResult(response.data);
        addToHistory(response.data.ticker); 
      }
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
      {[{v:"60m",l:"60분"},{v:"1d",l:"일봉"},{v:"1wk",l:"주봉"},{v:"1mo",l:"월봉"}].map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
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
        Stock Analysis & Advisor
      </h1>
      <p className="text-gray-400 mb-8 text-sm text-center">Top-Down Analysis System</p>

      {/* 입력창 */}
      <div className="flex w-full max-w-md gap-2 mb-2">
        <input type="text" placeholder="티커 (예: 005930, TSLA)" className="flex-1 p-4 rounded-xl bg-gray-800 border border-gray-700 focus:border-yellow-500 text-lg uppercase font-bold tracking-wider"
          value={ticker} onChange={(e) => setTicker(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()} />
        <button onClick={() => handleAnalyze()} disabled={loading} className="bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-500 text-black font-bold py-4 px-6 rounded-xl transition disabled:opacity-50 shadow-lg">
          {loading ? "..." : "분석"}
        </button>
      </div>

      {/* [MODIFIED] 토글 버튼 영역 분리 */}
      <div className="flex gap-4 mb-4">
        {(favorites.length > 0) && (
          <button 
            onClick={() => setShowFavorites(!showFavorites)} 
            className="text-gray-500 text-xs hover:text-white transition flex items-center gap-1"
          >
            {showFavorites ? "▼ 즐겨찾기" : "▶ 즐겨찾기"}
          </button>
        )}
        {(history.length > 0) && (
          <button 
            onClick={() => setShowHistory(!showHistory)} 
            className="text-gray-500 text-xs hover:text-white transition flex items-center gap-1"
          >
            {showHistory ? "▼ 검색기록" : "▶ 검색기록"}
          </button>
        )}
      </div>

      {/* [NEW] 즐겨찾기 영역 (독립적 표시) */}
      {showFavorites && favorites.length > 0 && (
        <div className="w-full max-w-md mb-4 animate-fade-in-down">
            <div className="flex flex-wrap gap-2 justify-center">
              {favorites.map(fav => (
                  <button key={fav} onClick={() => handleAnalyze(fav)} className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/30 px-2 py-1 rounded-full text-xs text-yellow-200 hover:bg-yellow-500/20 transition">
                    <span className="text-[10px]">★</span> {fav}
                  </button>
              ))}
            </div>
        </div>
      )}

      {/* [MODIFIED] 검색 기록 영역 (독립적 표시) */}
      {showHistory && history.length > 0 && (
        <div className="w-full max-w-md mb-6 animate-fade-in-down">
            <div className="flex flex-wrap gap-2 justify-center items-center">
              <ClockIcon />
              {history.map(item => (
                  <div key={item} className="flex items-center gap-1 bg-gray-800 border border-gray-600 px-2 py-1 rounded-full text-xs text-gray-400 hover:border-gray-400 transition group">
                    <span onClick={() => handleAnalyze(item)} className="cursor-pointer hover:text-white">{item}</span>
                    <TrashIcon onClick={() => setHistory(prev => prev.filter(h => h !== item))} />
                  </div>
              ))}
            </div>
        </div>
      )}

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
                    <div className="flex gap-1 mb-2">
                        <input type="password" placeholder="API Key" className="flex-1 bg-gray-700 rounded p-2 text-xs border border-gray-600 text-white" 
                            value={settings.geminiApiKey} 
                            onChange={e=>setSettings({...settings, geminiApiKey:e.target.value})} 
                        />
                        <button onClick={() => fetchModels(settings.geminiApiKey)} className="bg-gray-600 hover:bg-gray-500 text-white px-2 rounded text-xs">Load</button>
                    </div>
                    {availableModels.length > 0 ? (
                        <select 
                            value={settings.geminiModel} 
                            onChange={(e) => setSettings({...settings, geminiModel: e.target.value})}
                            className="w-full bg-gray-700 rounded p-2 text-xs border border-gray-600 text-white outline-none cursor-pointer"
                        >
                            {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    ) : (
                        <div className="text-[10px] text-gray-400">키 입력 후 Load를 눌러 모델을 선택하세요.</div>
                    )}
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
                        <div className="flex justify-between items-center bg-gray-700/30 p-2 rounded"><span className="text-yellow-300 text-xs font-bold">MA/MACD</span><div className="flex"><TimeSelect value={settings.maInterval} onChange={e=>{setSettings({...settings, maInterval:e.target.value})}}/><TimeSelect value={settings.macdInterval} onChange={e=>{setSettings({...settings, macdInterval:e.target.value})}}/></div></div>
                        <div className="flex justify-between items-center bg-gray-700/30 p-2 rounded"><span className="text-blue-300 text-xs font-bold">RSI/BB</span><div className="flex"><TimeSelect value={settings.rsiInterval} onChange={e=>{setSettings({...settings, rsiInterval:e.target.value})}}/><TimeSelect value={settings.bbInterval} onChange={e=>{setSettings({...settings, bbInterval:e.target.value})}}/></div></div>
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
            {result.ai_message && (
               <div className="bg-gradient-to-r from-indigo-900/80 to-purple-900/80 p-5 rounded-xl border border-indigo-500/30 shadow-lg flex gap-4 items-start">
                   <div className="text-3xl bg-indigo-500/20 p-2 rounded-full">🤖</div>
                   <div>
                       <h4 className="text-indigo-300 font-bold text-xs uppercase mb-2">AI Analyst's Advice ({result.ai_message.length > 0 ? settings.geminiModel.split('/')[1] : 'Error'})</h4>
                       <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">{result.ai_message}</p>
                   </div>
               </div>
            )}
            
            <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
               <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 p-3 border-b border-gray-700 flex justify-between items-center">
                  <h2 className="font-bold text-sm text-blue-200 flex items-center gap-2">🌍 MARKET & TREND <span className="text-[10px] opacity-70"></span></h2>
                  <div className="flex items-center gap-3">
                      {result.vix && <span className={`text-xs font-bold px-2 py-0.5 rounded ${parseFloat(result.vix.score)>=20?'bg-red-500/20 text-red-300':'bg-green-500/20 text-green-300'}`}>VIX {result.vix.score}</span>}
                      <div onClick={() => toggleFavorite(result.ticker)} className="cursor-pointer hover:scale-110 transition">
                          <StarIcon filled={favorites.includes(result.ticker)} />
                      </div>
                  </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center border-b border-gray-700">
                  <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                          <h3 className="text-2xl font-extrabold">{result.ticker}</h3>
                          {result.real_time && <span className="bg-red-600 text-white text-[10px] px-1.5 rounded animate-pulse">LIVE</span>}
                      </div>
                      <p className="text-3xl font-bold text-white mb-2">{result.price} <span className="text-sm text-gray-500">{result.currency}</span></p>
                      <div className="inline-flex items-center gap-2 bg-gray-700/50 px-3 py-1 rounded-lg border border-gray-600 mt-1">
                        <span className="text-xs text-gray-400">관심도</span>
                        <span className="text-sm font-bold text-white">{result.turnover.rate}%</span>
                        <span className="text-xs text-yellow-400">({result.turnover.msg})</span>
                      </div>
                  </div>
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

            <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-green-900/50 to-teal-900/50 p-3 border-b border-gray-700">
                  <h2 className="font-bold text-sm text-green-200 flex items-center gap-2">⚡ TRADING TIMING <span className="text-[10px] opacity-70"></span></h2>
              </div>
              <div className="p-6">
                  <div className="flex flex-col items-center mb-8">
                      <div className={`text-6xl font-black ${getScoreColor(result.score)} drop-shadow-2xl`}>{result.score}</div>
                      <p className={`text-lg font-bold mt-2 ${getScoreColor(result.score)}`}>
                          {result.score >= 70 ? "매수 시그널 🚀" : result.score <= 30 ? "매도/관망 시그널 📉" : "중립 / 홀딩 ⚖️"}
                      </p>
                  </div>
                  <h3 className="text-gray-400 font-bold text-xs uppercase mb-3 flex justify-between"><span>🎯 ATR</span></h3>
                  <div className="grid grid-cols-3 gap-2 md:gap-4 text-center mb-6">
                      <div className="bg-gray-700/30 p-3 rounded-lg border border-gray-600 hover:bg-gray-700/50 transition">
                          <h4 className="text-yellow-400 text-xs font-bold mb-2">⚡ 단타</h4>
                          <div className="text-[10px] space-y-1 font-mono"><p className="text-gray-300">TP <span className="text-red-400">{result.strategies.scalp.tp}</span></p><p className="text-gray-300">SL <span className="text-blue-400">{result.strategies.scalp.sl}</span></p></div>
                      </div>
                      <div className="bg-gray-700/50 p-3 rounded-lg border border-blue-500 shadow-lg transform scale-105">
                          <h4 className="text-green-400 text-xs font-bold mb-2">🌊 스윙</h4>
                          <div className="text-[10px] space-y-1 font-mono"><p className="text-gray-300">TP <span className="text-red-400 font-bold">{result.strategies.swing.tp}</span></p><p className="text-gray-300">SL <span className="text-blue-400 font-bold">{result.strategies.swing.sl}</span></p></div>
                      </div>
                      <div className="bg-gray-700/30 p-3 rounded-lg border border-gray-600 hover:bg-gray-700/50 transition">
                          <h4 className="text-purple-400 text-xs font-bold mb-2">💎 장투</h4>
                          <div className="text-[10px] space-y-1 font-mono"><p className="text-gray-300">TP <span className="text-red-400">{result.strategies.long.tp}</span></p><p className="text-gray-300">SL <span className="text-blue-400">{result.strategies.long.sl}</span></p></div>
                      </div>
                  </div>
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