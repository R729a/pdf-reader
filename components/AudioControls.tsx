'use client';

import React, { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';
import { TTSService, TTSState } from '@/services/tts-service';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  RotateCw, 
  Gauge, 
  Sliders, 
  Radio, 
  ChevronDown, 
  GripHorizontal, 
  GripVertical, 
  Minus, 
  Maximize2, 
  FileText,
  ArrowDownToLine,
  X
} from 'lucide-react';

interface AudioControlsProps {
  className?: string;
  onDock?: () => void;
  onClose?: () => void;
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const AudioControls: React.FC<AudioControlsProps> = ({ 
  className = '',
  onDock,
  onClose,
}) => {
  const [ttsState, setTtsState] = useState<TTSState>(TTSService.getState());
  const [isMinimized, setIsMinimized] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mounted, setMounted] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = TTSService.subscribe((state) => setTtsState(state));

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const tagName = target.tagName.toLowerCase();
      const isInput = tagName === 'input';
      const isRange = isInput && (target as HTMLInputElement).type === 'range';
      const isTextInput = (isInput && !isRange) || tagName === 'textarea' || target.isContentEditable;

      // Do not intercept if user is typing in chat, search, or inputs
      if (isTextInput) return;

      const state = TTSService.getState();
      if (state.totalWords === 0) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const seconds = e.shiftKey ? 15 : 5;
        TTSService.seekForward(seconds);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const seconds = e.shiftKey ? 15 : 5;
        TTSService.seekBackward(seconds);
      } else if (e.key === ' ' && tagName !== 'button') {
        e.preventDefault();
        if (state.status === 'playing') {
          TTSService.pause();
        } else if (state.status === 'paused') {
          TTSService.resume();
        } else if (state.totalWords > 0) {
          TTSService.speakFromWord(state.currentWordIndex || 0);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      unsubscribe();
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const handlePlayPause = () => {
    if (ttsState.status === 'playing') {
      TTSService.pause();
    } else if (ttsState.status === 'paused') {
      TTSService.resume();
    } else if (ttsState.totalWords > 0) {
      TTSService.speakFromWord(ttsState.currentWordIndex || 0);
    }
  };

  const handleStop = () => {
    TTSService.stop();
  };

  const handleSeekForward = () => {
    TTSService.seekForward(10);
  };

  const handleSeekBackward = () => {
    TTSService.seekBackward(10);
  };

  const handleSliderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const seconds = e.shiftKey ? 15 : 5;
      TTSService.seekForward(seconds);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const seconds = e.shiftKey ? 15 : 5;
      TTSService.seekBackward(seconds);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = parseFloat(e.target.value);
    TTSService.seekToPercent(percent);
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const speed = parseFloat(e.target.value);
    TTSService.setRate(speed);
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    TTSService.setVoice(e.target.value);
  };

  const speedPresetList = [0.75, 1.0, 1.25, 1.5, 2.0];
  const remainingTime = Math.max(0, ttsState.totalDuration - ttsState.currentTime);

  if (!mounted) return null;

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".drag-handle"
      bounds="body"
      defaultPosition={{ x: 0, y: 0 }}
    >
      <div
        ref={nodeRef}
        style={{ touchAction: 'none' }}
        className={`fixed bottom-6 right-6 z-50 select-none ${className}`}
      >
        {isMinimized ? (
          /* ================= MINIMIZED CAPSULE WIDGET ================= */
          <div className="bg-slate-900/95 border border-slate-700/90 backdrop-blur-xl rounded-full shadow-2xl p-2 px-3 flex items-center gap-2.5 text-slate-100 hover:border-indigo-500/50 transition-all duration-200">
            {/* Drag Handle */}
            <div
              className="drag-handle cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-200"
              title="Drag widget"
            >
              <GripVertical className="w-4 h-4" />
            </div>

            {/* Rewind 10s */}
            <button
              id="tts-minimized-rewind-btn"
              onClick={handleSeekBackward}
              disabled={ttsState.totalWords === 0}
              className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors disabled:opacity-40"
              title="Rewind 10 seconds (Left Arrow)"
            >
              <RotateCcw className="w-3 h-3" />
            </button>

            {/* Play / Pause Toggle Button */}
            <button
              id="tts-minimized-play-btn"
              onClick={handlePlayPause}
              disabled={ttsState.totalWords === 0}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md transition-all active:scale-95 disabled:opacity-40 ${
                ttsState.status === 'playing'
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/30'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/30'
              }`}
              title={ttsState.status === 'playing' ? 'Pause (Space)' : ttsState.status === 'paused' ? 'Resume (Space)' : 'Play (Space)'}
            >
              {ttsState.status === 'playing' ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5 ml-0.5" />
              )}
            </button>

            {/* Forward 10s */}
            <button
              id="tts-minimized-forward-btn"
              onClick={handleSeekForward}
              disabled={ttsState.totalWords === 0}
              className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors disabled:opacity-40"
              title="Forward 10 seconds (Right Arrow)"
            >
              <RotateCw className="w-3 h-3" />
            </button>

            {/* Stop button (if playing or paused) */}
            {ttsState.status !== 'idle' && (
              <button
                id="tts-minimized-stop-btn"
                onClick={handleStop}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                title="Stop playback"
              >
                <Square className="w-3 h-3" />
              </button>
            )}

            {/* Progress percent badge */}
            <span className="font-mono text-[10px] font-bold bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-full border border-slate-700">
              {Math.round(ttsState.progressPercent)}%
            </span>

            {/* Live Equalizer Animation when speaking */}
            {ttsState.status === 'playing' ? (
              <div className="flex items-center gap-0.5 h-3 px-1">
                {[0.5, 1.2, 0.7, 1.4, 0.6].map((val, i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-indigo-400 rounded-full animate-wave"
                    style={{ animationDelay: `${i * 0.15}s`, height: `${val * 100}%` }}
                  />
                ))}
              </div>
            ) : null}

            {/* Current Speed Badge */}
            <span className="font-mono text-[10px] font-bold bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded border border-slate-700">
              {ttsState.rate.toFixed(2)}x
            </span>

            {/* Maximize Button */}
            <button
              id="tts-maximize-btn"
              onClick={() => setIsMinimized(false)}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-indigo-300 transition-colors"
              title="Expand TTS controls"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            {/* Dock button (minimized) */}
            {onDock && (
              <button
                id="tts-minimized-dock-btn"
                onClick={onDock}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors"
                title="Dock player into viewer toolbar"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          /* ================= MAXIMIZED AUDIOBOOK PLAYER WIDGET ================= */
          <div className="w-[410px] max-w-[calc(100vw-2rem)] bg-slate-900/95 border border-slate-700/90 backdrop-blur-xl rounded-2xl shadow-2xl p-4 text-slate-100 transition-all duration-200">
            {/* Draggable Header Bar */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div className="drag-handle cursor-grab active:cursor-grabbing flex items-center gap-2 flex-1 min-w-0 py-1">
                <GripHorizontal className="w-4 h-4 text-slate-400 hover:text-slate-200 shrink-0" />
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                      ttsState.status === 'playing'
                        ? 'bg-indigo-600 text-white animate-pulse-glow'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-slate-200 block truncate">
                      PDF Audiobook Player
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Badge & Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {ttsState.status === 'playing' && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Speaking
                  </span>
                )}
                {ttsState.status === 'paused' && (
                  <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Paused
                  </span>
                )}
                {ttsState.status === 'idle' && ttsState.totalWords > 0 && (
                  <span className="text-[10px] text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                    Ready
                  </span>
                )}

                {/* Voice Settings Button */}
                <button
                  id="tts-voice-settings-btn"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={`p-1.5 rounded-lg border text-xs transition-colors ${
                    showAdvanced
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                  title="Voice Settings"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>

                {/* Minimize Button */}
                <button
                  id="tts-minimize-btn"
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
                  title="Minimize widget"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                {/* Dock into PDF Viewer Button */}
                {onDock && (
                  <button
                    id="tts-dock-btn"
                    onClick={onDock}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-indigo-300 border border-slate-700 transition-colors"
                    title="Dock controls into PDF viewer"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Close Button */}
                {onClose && (
                  <button
                    id="tts-close-btn"
                    onClick={onClose}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors"
                    title="Close floating player"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Document Context Preview */}
            <div className="mt-2.5 px-2.5 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-slate-300 font-medium truncate">
                  {ttsState.title || (ttsState.totalWords > 0 ? 'PDF Document' : 'No text loaded')}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                <span className="text-indigo-400">Page {ttsState.currentPage}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">Word {ttsState.currentWordIndex + 1}/{ttsState.totalWords}</span>
              </div>
            </div>

            {/* Equalizer waveform animation when speaking */}
            {ttsState.status === 'playing' && (
              <div className="flex items-center justify-center gap-1 my-2.5 h-3">
                {[0.4, 0.9, 0.5, 1.4, 0.6, 1.2, 0.3, 1.0, 0.7].map((val, i) => (
                  <div
                    key={i}
                    className="w-1 bg-indigo-400 rounded-full animate-wave"
                    style={{ animationDelay: `${i * 0.12}s`, height: `${val * 100}%` }}
                  />
                ))}
              </div>
            )}

            {/* Scrubbable Progress Bar Section */}
            <div className="mt-3 px-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span className="text-indigo-300 font-semibold">{formatTime(ttsState.currentTime)}</span>
                <span className="font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                  {Math.round(ttsState.progressPercent)}%
                </span>
                <span className="text-slate-500">-{formatTime(remainingTime)}</span>
              </div>

              <label htmlFor="floating-audio-timeline-slider" className="sr-only">
                Seek audio timeline
              </label>
              <input
                id="floating-audio-timeline-slider"
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={ttsState.progressPercent}
                onChange={handleSliderChange}
                onKeyDown={handleSliderKeyDown}
                disabled={ttsState.totalWords === 0}
                aria-label="Seek audio timeline"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(ttsState.progressPercent)}
                aria-valuetext={`${Math.round(ttsState.progressPercent)}% played`}
                className="w-full h-6 py-2 bg-transparent appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                title="Seek audio position (Use Left/Right arrow keys)"
              />
            </div>

            {/* Media Player Controls: [◀ 10s] [Play/Pause] [Stop] [10s ▶] */}
            <div className="mt-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* 10s Rewind */}
                <button
                  id="tts-seek-back-btn"
                  onClick={handleSeekBackward}
                  disabled={ttsState.totalWords === 0}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex flex-col items-center justify-center transition-colors disabled:opacity-40 group"
                  title="Rewind 10 seconds (Left Arrow)"
                >
                  <RotateCcw className="w-3.5 h-3.5 group-hover:-rotate-12 transition-transform" />
                  <span className="text-[8px] font-mono leading-none mt-0.5 font-bold text-slate-400">10s</span>
                </button>

                {/* Main Play / Pause Button */}
                <button
                  id="tts-play-btn"
                  onClick={handlePlayPause}
                  disabled={ttsState.totalWords === 0}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:hover:scale-100 ${
                    ttsState.status === 'playing'
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/30'
                  }`}
                  title={ttsState.status === 'playing' ? 'Pause (Space)' : ttsState.status === 'paused' ? 'Resume (Space)' : 'Play (Space)'}
                >
                  {ttsState.status === 'playing' ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>

                {/* 10s Forward */}
                <button
                  id="tts-seek-fwd-btn"
                  onClick={handleSeekForward}
                  disabled={ttsState.totalWords === 0}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex flex-col items-center justify-center transition-colors disabled:opacity-40 group"
                  title="Forward 10 seconds (Right Arrow)"
                >
                  <RotateCw className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                  <span className="text-[8px] font-mono leading-none mt-0.5 font-bold text-slate-400">10s</span>
                </button>

                {/* Stop Button */}
                <button
                  id="tts-stop-btn"
                  onClick={handleStop}
                  disabled={ttsState.status === 'idle'}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 flex items-center justify-center transition-colors"
                  title="Stop Speech"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Dynamic Continuous Speed Slider */}
              <div className="flex-1 flex flex-col gap-1 min-w-0">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                  <span className="flex items-center gap-1 text-indigo-400 truncate">
                    <Gauge className="w-3 h-3 shrink-0" /> Speed
                  </span>
                  <span className="font-bold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-indigo-300 text-[10px]">
                    {ttsState.rate.toFixed(2)}x
                  </span>
                </div>

                <input
                  id="tts-speed-slider"
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.05}
                  value={ttsState.rate}
                  onChange={handleSpeedChange}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>

            {/* Quick Speed Presets */}
            <div className="mt-2.5 flex items-center justify-between gap-1">
              <span className="text-[10px] text-slate-500 font-medium">Quick Speed:</span>
              <div className="flex items-center gap-1">
                {speedPresetList.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => TTSService.setRate(preset)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                      Math.abs(ttsState.rate - preset) < 0.04
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                    }`}
                  >
                    {preset}x
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Voice Settings Modal Dropdown */}
            {showAdvanced && (
              <div className="mt-3 pt-3 border-t border-slate-800 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Select Voice
                  </label>
                  <div className="relative">
                    <select
                      value={ttsState.selectedVoiceName}
                      onChange={handleVoiceChange}
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg p-2 pr-8 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                    >
                      {ttsState.availableVoices.map((voice) => (
                        <option key={voice.name} value={voice.name}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Voice Pitch</span>
                    <span className="font-mono text-slate-200">{ttsState.pitch.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.1}
                    value={ttsState.pitch}
                    onChange={(e) => TTSService.setPitch(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Draggable>
  );
};
