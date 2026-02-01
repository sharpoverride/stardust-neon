
import React, { useState, useEffect, useCallback } from 'react';
import { GameEngine } from './components/GameEngine';
import { GameState, MissionData } from './types';
import { generateMission } from './services/geminiService';
import { Play, RotateCcw, Crosshair, Cpu, ShieldAlert, Skull, Pause, PlayCircle } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState['status']>('MENU');
  const [mission, setMission] = useState<MissionData | null>(null);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [finalScore, setFinalScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dimensions, setDimensions] = useState({ w: window.innerWidth, h: window.innerHeight });

  // Handle Resize
  useEffect(() => {
    const handleResize = () => setDimensions({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard Command Center
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (gameState === 'PLAYING') setGameState('PAUSED');
        else if (gameState === 'PAUSED') setGameState('PLAYING');
      }
      
      if (e.code === 'Space') {
        if (gameState === 'MENU' && !loading) startGame();
        else if (gameState === 'BRIEFING') startMission();
        else if (gameState === 'GAMEOVER') returnToMenu();
        else if (gameState === 'PAUSED') setGameState('PLAYING');
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [gameState, loading]);

  const startGame = async () => {
    setLoading(true);
    setScore(0);
    setHealth(100);
    const data = await generateMission(1);
    setMission(data);
    setLoading(false);
    setGameState('BRIEFING');
  };

  const startMission = () => {
    setGameState('PLAYING');
  };

  const handleGameOver = useCallback((finalScore: number) => {
    setFinalScore(finalScore);
    setGameState('GAMEOVER');
  }, []);

  const handleScoreUpdate = useCallback((newScore: number) => {
    setScore(newScore);
  }, []);
  
  const handleHealthUpdate = useCallback((newHealth: number) => {
    setHealth(newHealth);
  }, []);

  const returnToMenu = () => {
    setGameState('MENU');
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-mono text-white select-none">
      {/* Background Visuals */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0a0a1a] to-[#000000]" />
      <div className="scanline" />
      <div className="crt-flicker" />

      {/* MENU SCREEN */}
      {gameState === 'MENU' && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full space-y-8 animate-fade-in">
          <div className="text-center space-y-2">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 drop-shadow-[0_0_15px_rgba(0,255,255,0.5)]">
              STARDUST NEON
            </h1>
            <p className="text-xl text-cyan-200 tracking-[0.5em] uppercase opacity-80">Vector Vanguard</p>
          </div>
          
          <div className="p-1 border border-cyan-500/30 rounded-lg backdrop-blur-sm">
            <button 
              onClick={startGame}
              disabled={loading}
              className="group relative px-12 py-4 bg-cyan-900/20 hover:bg-cyan-500/20 transition-all duration-300 border border-cyan-500/50 hover:border-cyan-400 overflow-hidden"
            >
              <div className="absolute inset-0 bg-cyan-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <div className="flex items-center space-x-3 text-cyan-100 group-hover:text-white">
                {loading ? <Cpu className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />}
                <span className="text-lg font-bold tracking-widest">
                  {loading ? 'INITIALIZING SYSTEMS...' : 'PRESS SPACE TO START'}
                </span>
              </div>
            </button>
          </div>
          <div className="absolute bottom-8 text-xs text-gray-500 tracking-widest">
            V.1.1.0 // VECTOR ENGINE ONLINE
          </div>
        </div>
      )}

      {/* BRIEFING SCREEN */}
      {gameState === 'BRIEFING' && mission && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full max-w-4xl mx-auto px-6">
          <div className="w-full bg-black/80 border border-cyan-500/50 p-8 rounded-sm shadow-[0_0_50px_rgba(0,255,255,0.1)] backdrop-blur-md">
            <div className="flex items-center space-x-2 mb-6 border-b border-cyan-500/30 pb-4">
              <ShieldAlert className="w-6 h-6 text-yellow-400" />
              <h2 className="text-2xl text-yellow-400 font-bold tracking-widest">MISSION BRIEFING</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-widest block mb-1">Target Sector</span>
                <h3 className="text-4xl font-bold text-white tracking-tight" style={{ color: mission.themeColor }}>
                  {mission.title}
                </h3>
              </div>
              
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-widest block mb-1">Intelligence</span>
                <p className="text-lg text-cyan-100 leading-relaxed font-light border-l-2 border-cyan-500/50 pl-4">
                  {mission.briefing}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="bg-cyan-900/10 p-4 border border-cyan-500/20">
                  <span className="text-xs text-gray-400 uppercase block">Hostile Density</span>
                  <div className="w-full h-2 bg-gray-800 mt-2">
                    <div className="h-full bg-red-500" style={{ width: `${mission.enemyDensity * 100}%` }} />
                  </div>
                </div>
                <div className="bg-cyan-900/10 p-4 border border-cyan-500/20">
                  <span className="text-xs text-gray-400 uppercase block">Velocity</span>
                  <div className="w-full h-2 bg-gray-800 mt-2">
                    <div className="h-full bg-yellow-400" style={{ width: `${mission.speedModifier * 60}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={startMission}
              className="mt-8 w-full py-4 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 hover:text-yellow-200 font-bold tracking-[0.2em] transition-all uppercase"
            >
              PRESS SPACE TO LAUNCH
            </button>
          </div>
        </div>
      )}

      {/* PAUSE MENU */}
      {gameState === 'PAUSED' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-900/90 border border-white/20 p-10 text-center space-y-6 shadow-2xl">
                <Pause className="w-12 h-12 text-white mx-auto" />
                <h2 className="text-4xl font-bold tracking-[0.3em]">PAUSED</h2>
                <div className="space-y-3 flex flex-col">
                    <button 
                        onClick={() => setGameState('PLAYING')}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/30 text-sm tracking-widest"
                    >
                        RESUME MISSION
                    </button>
                    <button 
                        onClick={returnToMenu}
                        className="px-6 py-2 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-200 text-sm tracking-widest"
                    >
                        ABORT
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* GAME SCREEN */}
      {(gameState === 'PLAYING' || gameState === 'PAUSED') && mission && (
        <>
          <div className="absolute inset-0 z-0">
            <GameEngine 
              mission={mission} 
              onGameOver={handleGameOver}
              onScoreUpdate={handleScoreUpdate}
              onHealthUpdate={handleHealthUpdate}
              width={dimensions.w}
              height={dimensions.h}
              paused={gameState === 'PAUSED'}
            />
          </div>
          
          {/* HUD Layer */}
          <div className="absolute inset-0 z-20 pointer-events-none p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="bg-black/20 backdrop-blur-sm border-l-2 border-cyan-500 pl-4 transition-all duration-100">
                 <div className="text-xs text-cyan-300 opacity-70 tracking-widest">SCORE</div>
                 <div className="text-3xl font-bold text-cyan-100 font-mono tracking-wider">{score.toString().padStart(6, '0')}</div>
              </div>
              <div className="bg-black/20 backdrop-blur-sm border-r-2 border-red-500 pr-4 text-right">
                 <div className="text-xs text-red-300 opacity-70 tracking-widest">SHIELD</div>
                 <div className={`text-3xl font-bold font-mono tracking-wider ${health < 30 ? 'text-red-500 animate-pulse' : 'text-red-100'}`}>
                    {health}%
                 </div> 
              </div>
            </div>
            
            <div className="flex justify-center">
                <div className="text-cyan-500/30 text-xs tracking-[1em] animate-pulse">RADAR ACTIVE</div>
            </div>
            
            {score < 100 && (
                <div className="absolute bottom-10 left-0 right-0 text-center text-white/20 text-xs uppercase tracking-widest">
                    MOUSE TO AIM • SPACE TO FIRE • ESC TO PAUSE
                </div>
            )}
          </div>
        </>
      )}

      {/* GAME OVER */}
      {gameState === 'GAMEOVER' && (
        <div className="relative z-50 flex flex-col items-center justify-center h-full bg-black/80 backdrop-blur-sm">
           <div className="text-center space-y-6 p-10 border-2 border-red-600/50 bg-red-900/10 rounded-xl animate-bounce-in">
              <Skull className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-5xl font-black text-red-500 tracking-tighter">MISSION FAILED</h2>
              
              <div className="space-y-2">
                <p className="text-gray-400 text-sm uppercase tracking-widest">Final Score</p>
                <p className="text-4xl text-white font-mono">{finalScore.toString().padStart(6, '0')}</p>
              </div>

              <button 
                onClick={returnToMenu}
                className="mt-8 px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest rounded-sm transition-colors flex items-center space-x-2 mx-auto"
              >
                <RotateCcw className="w-4 h-4" />
                <span>PRESS SPACE TO REBOOT</span>
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
