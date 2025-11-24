// frontend/src/App.js
import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [ticker, setTicker] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // 기본 설정
  const [settings, setSettings] = useState({
    maInterval: "1wk", maShort: 50, maLong: 200,
    macdInterval: "1wk", macdFast: 12, macdSlow: 26, macdSignal: 9,
    rsiInterval: "1d", rsiPeriod: 14,
    stochInterval: "1d", stochK: 14,
    bbInterval: "1d", bbLength: 20
  });

  const timeframes = [
    { value: "60m", label: "60분" }, { value: "1d", label: "일봉" },
    { value: "1wk", label: "주봉" }, { value: "1mo", label: "월봉" },
  ];

  const handleAnalyze = async () => {
    if (!ticker) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const params = {
        ma_interval: settings.maInterval, ma_short: settings.maShort, ma_long: settings.maLong,
        rsi_interval: settings.rsiInterval, rsi_period: settings.rsiPeriod,
        macd_interval: settings.macdInterval, macd_fast: settings.macdFast, macd_slow: settings.macdSlow, macd_signal: settings.macdSignal,
        stoch_interval: settings.stochInterval, stoch_k: settings.stochK,
        bb_interval: settings.bbInterval, bb_length: settings.bbLength
      };
      const queryParams = new URLSearchParams(params).toString();
      const response = await axios.get(`http://127.0.0.1:8000/analyze/${ticker}?${queryParams}`);
      if (response.data.error) setError(response.data.error);
      else setResult(response.data);
    } catch (err) { setError("서버 통신 오류"); } 
    finally { setLoading(false); }
  };

  const getScoreColor = (score) => {
    if (score >= 70) return "text-red-500";
    if (score <= 30) return "text-blue-500";
    return "text-yellow-400";
  };

  const TimeSelect = ({ value, onChange }) => (
    <select value={value} onChange={onChange} className="bg-gray-700 text-xs rounded p-1 ml-2 border border-gray-600 outline-none">
      {timeframes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
    </select>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10 px-4 font-sans">
      <h1 className="text-3xl md:text-4xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-500">
        AI Trading Advisor
      </h1>
      <p className="text-gray-400 mb-8 text-sm">멀티 타임프레임, 지표 분석</p>

      {/* 입력창 */}
      <div className="flex w-full max-w-md gap-2 mb-6">
        <input type="text" placeholder="티커 (예: 005930, TSLA)" className="flex-1 p-4 rounded-xl bg-gray-800 border border-gray-700 focus:border-yellow-500 text-lg uppercase font-bold"
          value={ticker} onChange={(e) => setTicker(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()} />
        <button onClick={handleAnalyze} disabled={loading} className="bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-500 text-black font-bold py-4 px-6 rounded-xl transition disabled:opacity-50">
          {loading ? "..." : "분석"}
        </button>
      </div>

      <button onClick={() => setShowSettings(!showSettings)} className="text-gray-400 text-xs underline mb-6">
        {showSettings ? "▲ 설정 닫기" : "▼ 상세 설정 열기"}
      </button>

      {/* 설정창 (간소화) */}
      {showSettings && (
        <div className="w-full max-w-lg bg-gray-800 p-4 rounded-xl mb-6 border border-gray-700 grid grid-cols-2 gap-4 text-xs">
           <div className="p-2 bg-gray-700/50 rounded"><span className="text-yellow-300 font-bold block mb-1">MA (추세)</span><TimeSelect value={settings.maInterval} onChange={e=>setSettings({...settings, maInterval:e.target.value})}/></div>
           <div className="p-2 bg-gray-700/50 rounded"><span className="text-yellow-300 font-bold block mb-1">MACD</span><TimeSelect value={settings.macdInterval} onChange={e=>setSettings({...settings, macdInterval:e.target.value})}/></div>
           <div className="p-2 bg-gray-700/50 rounded"><span className="text-blue-300 font-bold block mb-1">RSI (타이밍)</span><TimeSelect value={settings.rsiInterval} onChange={e=>setSettings({...settings, rsiInterval:e.target.value})}/></div>
           <div className="p-2 bg-gray-700/50 rounded"><span className="text-blue-300 font-bold block mb-1">Bollinger</span><TimeSelect value={settings.bbInterval} onChange={e=>setSettings({...settings, bbInterval:e.target.value})}/></div>
        </div>
      )}

      {error && <div className="bg-red-500/20 text-red-200 px-6 py-3 rounded-xl mb-6">🚨 {error}</div>}

      {result && (
        <div className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700 animate-fade-in-up">
          
          {/* 1. 상단: 점수 및 가격 */}
          <div className="p-8 text-center border-b border-gray-700 bg-gradient-to-b from-gray-800 to-gray-900">
            <h2 className="text-3xl font-extrabold mb-1">{result.ticker}</h2>
            <p className="text-gray-400 text-lg mb-6"><span className="text-white font-bold text-2xl">{result.price}</span> {result.currency}</p>
            <div className={`text-6xl font-black ${getScoreColor(result.score)}`}>{result.score}</div>
            <p className={`text-lg font-bold mt-2 ${getScoreColor(result.score)}`}>
              {result.score >= 70 ? "매수 우위" : result.score <= 30 ? "매도 우위" : "중립"}
            </p>
          </div>

          {/* 2. 중단: 매매 전략 (NEW) */}
          <div className="p-6 bg-gray-800 border-b border-gray-700">
            <h3 className="text-gray-400 font-bold text-xs uppercase mb-4 tracking-wider flex justify-between">
              <span>🎯 추천 진입/청산 전략 (현 가격 기준)</span>
              <span className="text-gray-600">ATR: {result.strategies.atr}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 단타 */}
              <div className="bg-gray-700/40 p-4 rounded-xl border border-gray-600 text-center">
                <h4 className="text-yellow-400 font-bold text-sm mb-3">⚡ 단타 (Scalping)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">익절</span> <span className="text-red-400 font-bold">{result.strategies.scalp.tp}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">손절</span> <span className="text-blue-400 font-bold">{result.strategies.scalp.sl}</span></div>
                </div>
              </div>
              {/* 스윙 */}
              <div className="bg-gray-700/40 p-4 rounded-xl border border-gray-600 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-blue-600 text-[10px] px-2 py-0.5 rounded-bl">추천</div>
                <h4 className="text-green-400 font-bold text-sm mb-3">🌊 스윙 (Swing)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">익절</span> <span className="text-red-400 font-bold">{result.strategies.swing.tp}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">손절</span> <span className="text-blue-400 font-bold">{result.strategies.swing.sl}</span></div>
                </div>
              </div>
              {/* 장투 */}
              <div className="bg-gray-700/40 p-4 rounded-xl border border-gray-600 text-center">
                <h4 className="text-purple-400 font-bold text-sm mb-3">💎 장투 (Long)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">익절</span> <span className="text-red-400 font-bold">{result.strategies.long.tp}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">손절</span> <span className="text-blue-400 font-bold">{result.strategies.long.sl}</span></div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-3 text-center">* ATR(평균진폭) 변동성을 기반으로 산출된 이론적 구간입니다.</p>
          </div>

          {/* 3. 하단: 분석 근거 */}
          <div className="p-6 bg-gray-900/50">
            <div className="mb-6 bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-left w-full">
                <h4 className="text-gray-400 font-bold text-xs uppercase mb-1">시장 관심도 (회전율)</h4>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-white">{result.turnover.rate}%</span>
                  <span className={`text-sm font-bold mb-1 ${
                      parseFloat(result.turnover.rate) >= 5 ? "text-red-400 animate-pulse" : 
                      parseFloat(result.turnover.rate) >= 1 ? "text-green-400" : "text-gray-500"
                    }`}>
                    {result.turnover.msg}
                  </span>
                  </div>
              </div>
              <div className="text-right w-full text-xs text-gray-500 space-y-1">
                <div className="flex justify-between md:justify-end md:gap-4">
                  <span>거래량</span> <span className="text-gray-300 font-mono">{result.turnover.volume}주</span>
                </div>
                <div className="flex justify-between md:justify-end md:gap-4">
                  <span>전체주식</span> <span className="text-gray-300 font-mono">{result.turnover.shares}주</span>
                </div>
              </div>
            </div>
            <h3 className="text-gray-500 font-bold text-xs uppercase mb-3">AI Analysis Report</h3>
            <ul className="space-y-2 mb-4">
                {result.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-300">
                     <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${r.includes('골든') || r.includes('매수') ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                     {r}
                  </li>
                ))}
             </ul>
             <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 border-t border-gray-700 pt-3">
                <div className="flex justify-between"><span>MA Cross</span> <span className="text-white">{result.indicators.MA_Cross}</span></div>
                <div className="flex justify-between"><span>RSI</span> <span className="text-white">{result.indicators.RSI}</span></div>
                <div className="flex justify-between"><span>MACD</span> <span className="text-white">{result.indicators.MACD}</span></div>
                <div className="flex justify-between"><span>Bollinger</span> <span className="text-white">{result.indicators.BB}</span></div>
                <div className="flex justify-between"><span>OBV</span> <span className="text-white">{result.indicators.OBV}</span></div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;