import React, { useState, useEffect } from 'react';
import axios from 'axios';

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
  
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [showFavorites, setShowFavorites] = useState(true);

  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);

  const API_BASE_URL = window.location.hostname === "localhost" 
    ? "http://127.0.0.1:8010" 
    : "https://stocks-analysis-1uow.onrender.com"; 

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

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('myStockSettings');
      if (saved) {
        return { ...defaultSettings, ...JSON.parse(saved) };
      }
    } catch (e) {}
    return defaultSettings;
  });

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

  useEffect(() => {
    const savedHistory = localStorage.getItem('myStockHistory');
    const savedFavorites = localStorage.getItem('myStockFavorites');

    if (savedHistory) try { setHistory(JSON.parse(savedHistory)); } catch (e) {}
    if (savedFavorites) try { setFavorites(JSON.parse(savedFavorites)); } catch (e) {}

    if (settings.geminiApiKey) {
      fetchModels(settings.geminiApiKey);
    }
  }, []);

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
      let storedToken = localStorage.getItem("kisAccessToken");
      const storedExpire = localStorage.getItem("kisTokenExpire");
      const now = Math.floor(Date.now() / 1000);
      if (storedToken && storedExpire && now >= parseInt(storedExpire)) {
         localStorage.removeItem("kisAccessToken");
         localStorage.removeItem("kisTokenExpire");
         storedToken = null;
      }
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
          "gemini-model": settings.geminiModel,
          "kis-access-token": storedToken,
        }
      });
      
      if (response.data.error) {
        setError(response.data.error);
      } else {
        setResult(response.data);

        const auth = response.data.auth_info;
        if (auth && auth.token) {
            localStorage.setItem("kisAccessToken", auth.token);
            localStorage.setItem("kisTokenExpire", auth.expire);
            console.log("🎟️ 새 토큰 발급 및 저장 완료!");
        }

        const isTickerType = /^[0-9]+$/.test(searchTicker) || /^[0-9]+\.KS$/.test(searchTicker);
        let historyName = response.data.ticker;
        if (isTickerType) {
            historyName = response.data.ticker.replace(".KS", "");
        } else {
            historyName = response.data.name || searchTicker;
        }

        addToHistory(historyName); 
      }
    } catch (err) { setError("서버 통신 오류 (잠시 후 다시 시도)"); } 
    finally { setLoading(false); }
  };

  const getScoreColor = (score) => {
    if (score >= 70) return "text-red-500";
    if (score <= 30) return "text-blue-500";
    return "text-yellow-400";
  };

  const getNetColor = (val) => val > 0 ? "text-red-400" : val < 0 ? "text-blue-400" : "text-gray-400";

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
      <p className="text-gray-400 text-sm text-center">본 서비스는 AI와 기술적 지표를 활용한 지표 분석 도구일 뿐이며, 투자의 결과에 대한 모든 책임은 사용자 본인에게 있습니다.</p>
      <p className="text-gray-400 mb-8 text-sm text-center">활용 지표의 점수화 기준은 다음 설명을 참고해주세요.</p>
      {/* 입력창 */}
      <div className="flex w-full max-w-md gap-2 mb-2">
        <input type="text" placeholder="티커 (예: 005930, TSLA)" className="flex-1 p-4 rounded-xl bg-gray-800 border border-gray-700 focus:border-yellow-500 text-lg uppercase font-bold tracking-wider"
          value={ticker} onChange={(e) => setTicker(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()} />
        <button onClick={() => handleAnalyze()} disabled={loading} className="bg-gradient-to-r from-blue-600 to-teal-500 text-black font-bold py-4 px-6 rounded-xl transition disabled:opacity-50 shadow-lg">
          {loading ? "..." : "분석"}
        </button>
      </div>

      {/* 토글 버튼 */}
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

      {/* 즐겨찾기 영역 */}
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

      {/* 검색 기록 영역 */}
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

            {/* MARKET & TREND */}
            <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
              {/* 1. Header */}
               <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 p-3 border-b border-gray-700 flex justify-between items-center">
                  <h2 className="font-bold text-sm text-blue-200 flex items-center gap-2">🌍 MARKET & TREND <span className="text-[10px] opacity-70"></span></h2>
                  <div className="flex items-center gap-3">
                      {result.vix && <span className={`text-xs font-bold px-2 py-0.5 rounded ${parseFloat(result.vix.score)>=20?'bg-red-500/20 text-red-300':'bg-green-500/20 text-green-300'}`}>VIX {result.vix.score}</span>}
                      <div onClick={() => toggleFavorite(result.ticker)} className="cursor-pointer hover:scale-110 transition">
                          <StarIcon filled={favorites.includes(result.ticker)} />
                      </div>
                  </div>
              </div>

              {/* 2. Top: Price & Trend Status */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center border-b border-gray-700">
                  <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <h3 className="text-3xl font-extrabold">{result.name}</h3>
                        <span className="text-xs text-gray-400 font-mono tracking-wider">{result.ticker}</span>
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

              {/* 3. Middle: Analyst & Investors (Integrated) */}
              {(result.analyst || result.investors) && (
                 <div className="px-6 py-4 border-t border-b border-gray-700 bg-gray-800/50">
                     {/* [핵심 수정] 전체를 5등분 (md:grid-cols-5) */}
                     <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                         
                         {/* Analyst Info: 5칸 중 2칸 차지 (md:col-span-2) */}
                         <div className="md:col-span-2 flex flex-col gap-2">
                             <h4 className="text-gray-400 text-[10px] font-bold uppercase">📊 Analyst Consensus</h4>
                             {/* 내부는 2등분 */}
                             <div className="grid grid-cols-2 gap-2 h-full">
                                 <div className="bg-gray-700/30 p-2 rounded border border-gray-600 flex flex-col items-center justify-center">
                                    <span className="text-[10px] text-gray-400 mb-1">투자의견</span>
                                    <span className="font-bold text-white text-sm">{result.analyst.recommendation}</span>
                                 </div>
                                 <div className="bg-gray-700/30 p-2 rounded border border-gray-600 flex flex-col items-center justify-center">
                                    <span className="text-[10px] text-gray-400 mb-1">목표주가</span>
                                    <div className="text-center leading-none">
                                        <span className="block font-bold text-white text-sm">{result.analyst.target_mean}</span>
                                        <span className={`text-[10px] ${parseFloat(result.analyst.upside)>0?'text-red-400':'text-blue-400'}`}>
                                            ({parseFloat(result.analyst.upside)>0?'+':''}{result.analyst.upside})
                                        </span>
                                    </div>
                                 </div>
                             </div>
                         </div>
                         
                         {/* Investor Info: 5칸 중 3칸 차지 (md:col-span-3) */}
                         {result.investors && (
                             <div className="md:col-span-3 flex flex-col gap-2">
                                <h4 className="text-gray-400 text-[10px] font-bold uppercase flex justify-between">
                                   <span>💰 Investors (Daily)</span>
                                   <span className="font-normal opacity-50">{result.investors.date}</span>
                                </h4>
                                {/* 내부는 3등분 */}
                                <div className="grid grid-cols-3 gap-2 h-full">
                                   <div className="bg-gray-700/30 p-2 rounded border border-gray-600 flex flex-col justify-center items-center">
                                      <span className="text-[10px] text-gray-400 mb-1">개인 🐜</span>
                                      <span className={`text-xs font-bold ${getNetColor(result.investors.individual)}`}>
                                         {result.investors.individual > 0 ? "+" : ""}{result.investors.individual.toLocaleString()}
                                      </span>
                                   </div>
                                   <div className="bg-gray-700/30 p-2 rounded border border-gray-600 flex flex-col justify-center items-center">
                                      <span className="text-[10px] text-gray-400 mb-1">외인 🗽</span>
                                      <span className={`text-xs font-bold ${getNetColor(result.investors.foreigner)}`}>
                                         {result.investors.foreigner > 0 ? "+" : ""}{result.investors.foreigner.toLocaleString()}
                                      </span>
                                   </div>
                                   <div className="bg-gray-700/30 p-2 rounded border border-gray-600 flex flex-col justify-center items-center">
                                      <span className="text-[10px] text-gray-400 mb-1">기관 🏢</span>
                                      <span className={`text-xs font-bold ${getNetColor(result.investors.institution)}`}>
                                         {result.investors.institution > 0 ? "+" : ""}{result.investors.institution.toLocaleString()}
                                      </span>
                                   </div>
                                </div>
                             </div>
                         )}
                     </div>
                 </div>
              )}

              {/* 4. Bottom: Technical Indicators */}
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

                  {result.sr && (
                    <div className="mb-8 px-2">
                        <div className="flex justify-between text-xs mb-2 font-mono">
                            <span className="text-blue-400">▼ 바닥(지지) {result.sr.support}</span>
                            <span className="text-xs text-gray-400">현재 위치 ({result.sr.position}%)</span>
                            <span className="text-red-400">천장(저항) {result.sr.resistance} ▲</span>
                        </div>
                        <div className="w-full h-3 bg-gray-700 rounded-full relative overflow-hidden">
                            {/* 배경 그라디언트 (파랑 -> 빨강) */}
                            <div 
                                className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-500 via-gray-500 to-red-500 opacity-50"
                                style={{ width: '100%' }}
                            ></div>
                            
                            {/* 현재가 위치 표시기 (하얀 막대) */}
                            <div 
                                className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_white] transition-all duration-1000" 
                                style={{ left: `${Math.max(0, Math.min(100, result.sr.position))}%` }}
                            ></div>
                        </div>
                        <p className="text-[10px] text-gray-500 text-center mt-1">
                            * 지지선: 20일 최저가 | 저항선: 20일 이평선(또는 전고점)
                        </p>
                    </div>
                )}

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



// import React, { useState, useEffect } from 'react';
// import axios from 'axios';

// // ... (StarIcon, ClockIcon, TrashIcon 아이콘 코드는 그대로 유지) ...
// const StarIcon = ({ filled, onClick }) => (
//   <svg onClick={onClick} xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 cursor-pointer transition ${filled ? "text-yellow-400 fill-yellow-400" : "text-gray-400 hover:text-yellow-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
//     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
//   </svg>
// );
// const ClockIcon = () => (
//   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
//   </svg>
// );
// const TrashIcon = ({ onClick }) => (
//   <svg onClick={(e) => { e.stopPropagation(); onClick(); }} xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-600 hover:text-red-400 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//   </svg>
// );

// function App() {
//   const [ticker, setTicker] = useState("");
//   const [result, setResult] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const [showSettings, setShowSettings] = useState(false);
//   const [showHistory, setShowHistory] = useState(true);
//   const [showFavorites, setShowFavorites] = useState(true);
//   const [history, setHistory] = useState([]);
//   const [favorites, setFavorites] = useState([]);
//   const [availableModels, setAvailableModels] = useState([]);

//   const API_BASE_URL = window.location.hostname === "localhost" 
//     ? "http://127.0.0.1:8010" 
//     : "https://my-stock-api.onrender.com";

//   // [MODIFIED] KIS 키 제거, Alpaca 키 추가
//   const defaultSettings = {
//     maInterval: "1d",
//     wMa: 1.5, wMacd: 1.0, wRsi: 1.0, wStoch: 0.5, wBb: 1.0,
//     geminiApiKey: "", geminiModel: "models/gemini-2.0-flash",
//     alpacaKey: "", alpacaSecret: "" // New
//   };

//   const [settings, setSettings] = useState(() => {
//     try {
//       const saved = localStorage.getItem('myStockSettings');
//       if (saved) return { ...defaultSettings, ...JSON.parse(saved) };
//     } catch (e) {}
//     return defaultSettings;
//   });

//   // ... (fetchModels, useEffect 등 기존 코드 유지) ...
//   const fetchModels = async (apiKey) => {
//     if (!apiKey) return;
//     try {
//       const res = await axios.get(`${API_BASE_URL}/models`, {
//         headers: { "gemini-api-key": apiKey }
//       });
//       if (res.data.models) setAvailableModels(res.data.models);
//     } catch (e) { console.error(e); }
//   };

//   useEffect(() => {
//     const savedHistory = localStorage.getItem('myStockHistory');
//     const savedFavorites = localStorage.getItem('myStockFavorites');
//     if (savedHistory) try { setHistory(JSON.parse(savedHistory)); } catch (e) {}
//     if (savedFavorites) try { setFavorites(JSON.parse(savedFavorites)); } catch (e) {}
//     if (settings.geminiApiKey) fetchModels(settings.geminiApiKey);
//   }, []);

//   useEffect(() => localStorage.setItem('myStockSettings', JSON.stringify(settings)), [settings]);
//   useEffect(() => localStorage.setItem('myStockHistory', JSON.stringify(history)), [history]);
//   useEffect(() => localStorage.setItem('myStockFavorites', JSON.stringify(favorites)), [favorites]);

//   const addToHistory = (symbol) => setHistory(prev => [symbol, ...prev.filter(t => t !== symbol)].slice(0, 5));
//   const toggleFavorite = (symbol) => setFavorites(prev => prev.includes(symbol) ? prev.filter(t => t !== symbol) : [symbol, ...prev]);

//   // 분석 실행
//   const handleAnalyze = async (targetTicker = null) => {
//     const searchTicker = targetTicker || ticker;
//     if (!searchTicker) return;
//     if (targetTicker) setTicker(targetTicker);

//     setLoading(true); setError(null); setResult(null);
//     try {
//       // 파라미터 최소화 (Backend에서 처리)
//       const params = {
//         ma_interval: settings.maInterval,
//         w_ma: settings.wMa, w_macd: settings.wMacd, w_rsi: settings.wRsi, w_stoch: settings.wStoch, w_bb: settings.wBb,
//       };
//       const queryParams = new URLSearchParams(params).toString();
      
//       const response = await axios.get(`${API_BASE_URL}/analyze/${searchTicker}?${queryParams}`, {
//         headers: { 
//           "gemini-api-key": settings.geminiApiKey,
//           "gemini-model": settings.geminiModel,
//           "alpaca-key": settings.alpacaKey,       // [New]
//           "alpaca-secret": settings.alpacaSecret  // [New]
//         }
//       });
      
//       if (response.data.error) setError(response.data.error);
//       else {
//         setResult(response.data);
//         addToHistory(response.data.ticker); 
//       }
//     } catch (err) { setError("통신 오류"); } 
//     finally { setLoading(false); }
//   };

//   const getScoreColor = (score) => score >= 70 ? "text-red-500" : score <= 30 ? "text-blue-500" : "text-yellow-400";
//   const getNetColor = (val) => val > 0 ? "text-red-400" : val < 0 ? "text-blue-400" : "text-gray-400";

//   // UI 컴포넌트 생략 (WeightSlider 등 기존 유지)
//   const WeightSlider = ({ label, value, onChange, color="text-gray-400" }) => (
//     <div className="mb-3">
//       <div className="flex justify-between text-xs mb-1">
//         <span className={color}>{label}</span><span className="font-bold text-yellow-400">x{value}</span>
//       </div>
//       <input type="range" min="0" max="3" step="0.5" value={value} onChange={onChange} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
//     </div>
//   );

//   return (
//     <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10 px-4 font-sans">
//       <h1 className="text-4xl md:text-6xl font-extrabold py-6 mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-500 drop-shadow-lg">
//         AI Trading Analyst
//       </h1>
      
//       {/* 입력 및 토글 UI (기존과 동일하므로 핵심 부분만 표시) */}
//       <div className="flex w-full max-w-md gap-2 mb-2">
//         <input type="text" placeholder="티커 (예: 005930, AAPL)" className="flex-1 p-4 rounded-xl bg-gray-800 border border-gray-700 text-lg uppercase font-bold"
//           value={ticker} onChange={(e) => setTicker(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()} />
//         <button onClick={() => handleAnalyze()} disabled={loading} className="bg-blue-600 text-black font-bold py-4 px-6 rounded-xl">
//           {loading ? "..." : "분석"}
//         </button>
//       </div>
      
//       {/* ... 토글 버튼들 (즐겨찾기, 기록) ... */}
//       <div className="flex gap-4 mb-4">
//         <button onClick={() => setShowFavorites(!showFavorites)} className="text-gray-500 text-xs">즐겨찾기</button>
//         <button onClick={() => setShowHistory(!showHistory)} className="text-gray-500 text-xs">검색기록</button>
//         <button onClick={() => setShowSettings(!showSettings)} className="text-gray-500 text-xs">설정</button>
//       </div>

//       {showFavorites && favorites.length>0 && <div className="mb-4 flex gap-2">{favorites.map(f=><span key={f} onClick={()=>handleAnalyze(f)} className="text-xs cursor-pointer bg-yellow-900/50 p-1 rounded text-yellow-200">★ {f}</span>)}</div>}
//       {showHistory && history.length>0 && <div className="mb-4 flex gap-2">{history.map(h=><span key={h} onClick={()=>handleAnalyze(h)} className="text-xs cursor-pointer bg-gray-800 p-1 rounded">🕒 {h}</span>)}</div>}

//       {/* [MODIFIED] 설정창: KIS 제거 -> Alpaca 추가 */}
//       {showSettings && (
//         <div className="w-full max-w-2xl bg-gray-800 p-6 rounded-xl mb-6 border border-gray-700">
//            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
//               <div className="space-y-4">
//                  <div>
//                     <h3 className="font-bold text-white mb-2 text-sm">🤖 Gemini API</h3>
//                     <input type="password" placeholder="Gemini Key" className="w-full bg-gray-700 rounded p-2 text-xs" value={settings.geminiApiKey} onChange={e=>setSettings({...settings, geminiApiKey:e.target.value})} />
//                  </div>
//                  <div>
//                     <h3 className="font-bold text-white mb-2 text-sm">🦙 Alpaca API (미국주식용)</h3>
//                     <input type="password" placeholder="API Key ID" className="w-full bg-gray-700 rounded p-2 text-xs mb-2" value={settings.alpacaKey} onChange={e=>setSettings({...settings, alpacaKey:e.target.value})} />
//                     <input type="password" placeholder="Secret Key" className="w-full bg-gray-700 rounded p-2 text-xs" value={settings.alpacaSecret} onChange={e=>setSettings({...settings, alpacaSecret:e.target.value})} />
//                     <a href="https://alpaca.markets/" target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 block mt-1 text-right">👉 무료 키 발급 (Paper Trading)</a>
//                  </div>
//               </div>
//               <div>
//                 <h3 className="font-bold text-white mb-2 text-sm">지표 가중치</h3>
//                 <WeightSlider label="MA" value={settings.wMa} onChange={e => setSettings({...settings, wMa: parseFloat(e.target.value)})} />
//                 <WeightSlider label="MACD" value={settings.wMacd} onChange={e => setSettings({...settings, wMacd: parseFloat(e.target.value)})} />
//                 <WeightSlider label="RSI" value={settings.wRsi} onChange={e => setSettings({...settings, wRsi: parseFloat(e.target.value)})} />
//               </div>
//            </div>
//         </div>
//       )}

//       {error && <div className="bg-red-500/20 text-red-200 px-6 py-3 rounded-xl mb-6">🚨 {error}</div>}

//       {result && (
//         <div className="w-full max-w-2xl space-y-6">
//             {/* AI Message */}
//             {result.ai_message && (
//                <div className="bg-indigo-900/50 p-4 rounded-xl border border-indigo-500/30 flex gap-4">
//                    <div className="text-2xl">🤖</div>
//                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{result.ai_message}</p>
//                </div>
//             )}
            
//             {/* Market Info */}
//             <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
//                 <div className="flex justify-between items-start mb-4">
//                     <div>
//                         <h2 className="text-3xl font-bold">{result.ticker}</h2>
//                         <p className="text-2xl font-bold text-gray-200">{result.price} <span className="text-sm text-gray-500">{result.currency}</span></p>
//                     </div>
//                     <div onClick={() => toggleFavorite(result.ticker)}><StarIcon filled={favorites.includes(result.ticker)} /></div>
//                 </div>

//                 {/* [MODIFIED] 수급 정보 (한국 주식만 표시) */}
//                 {result.investors && (
//                     <div className="bg-gray-700/30 rounded p-3 mb-4">
//                         <h4 className="text-[10px] text-gray-400 mb-2 uppercase flex justify-between"><span>Investors (KR Only)</span> <span>{result.investors.date}</span></h4>
//                         <div className="grid grid-cols-3 gap-2 text-center">
//                             <div><div className="text-[10px] text-gray-400">개인</div><div className={`text-sm font-bold ${getNetColor(result.investors.individual)}`}>{result.investors.individual.toLocaleString()}</div></div>
//                             <div><div className="text-[10px] text-gray-400">외국인</div><div className={`text-sm font-bold ${getNetColor(result.investors.foreigner)}`}>{result.investors.foreigner.toLocaleString()}</div></div>
//                             <div><div className="text-[10px] text-gray-400">기관</div><div className={`text-sm font-bold ${getNetColor(result.investors.institution)}`}>{result.investors.institution.toLocaleString()}</div></div>
//                         </div>
//                     </div>
//                 )}
                
//                 {/* Indicators */}
//                 <div className="grid grid-cols-3 gap-2 text-center text-xs">
//                     <div className="bg-gray-700/50 p-2 rounded">MA: {result.indicators.MA_Cross}</div>
//                     <div className="bg-gray-700/50 p-2 rounded">RSI: {result.indicators.RSI}</div>
//                     <div className="bg-gray-700/50 p-2 rounded">MACD: {result.indicators.MACD}</div>
//                 </div>
//             </div>

//             {/* Score & Strategies */}
//             <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 text-center">
//                  <div className={`text-6xl font-black ${getScoreColor(result.score)} mb-2`}>{result.score}</div>
//                  <div className="text-gray-400 text-xs mb-6">{result.score>=70?"매수 우위":result.score<=30?"매도 우위":"관망"}</div>
                 
//                  <div className="grid grid-cols-3 gap-2">
//                     <div className="bg-gray-700/30 p-2 rounded">
//                         <div className="text-yellow-400 font-bold text-xs mb-1">단타</div>
//                         <div className="text-[10px] text-gray-300">TP {result.strategies.scalp.tp}</div>
//                         <div className="text-[10px] text-gray-300">SL {result.strategies.scalp.sl}</div>
//                     </div>
//                     <div className="bg-gray-700/50 p-2 rounded border border-blue-500">
//                         <div className="text-green-400 font-bold text-xs mb-1">스윙</div>
//                         <div className="text-[10px] text-gray-300">TP {result.strategies.swing.tp}</div>
//                         <div className="text-[10px] text-gray-300">SL {result.strategies.swing.sl}</div>
//                     </div>
//                     <div className="bg-gray-700/30 p-2 rounded">
//                         <div className="text-purple-400 font-bold text-xs mb-1">장투</div>
//                         <div className="text-[10px] text-gray-300">TP {result.strategies.long.tp}</div>
//                         <div className="text-[10px] text-gray-300">SL {result.strategies.long.sl}</div>
//                     </div>
//                  </div>
//             </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default App;
