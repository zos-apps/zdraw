/**
 * StatusBar - Bottom status bar with zoom controls and info
 */

import React from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import type { ViewState, Document } from '../types';

interface StatusBarProps {
  view: ViewState;
  document: Document;
  selectedCount: number;
  onZoomChange: (zoom: number) => void;
  onFitToWindow: () => void;
}

const zoomPresets = [25, 50, 75, 100, 150, 200, 400, 800];

export const StatusBar: React.FC<StatusBarProps> = ({
  view,
  document,
  selectedCount,
  onZoomChange,
  onFitToWindow,
}) => {
  const zoomPercent = Math.round(view.zoom * 100);

  const handleZoomIn = () => {
    const nextPreset = zoomPresets.find((z) => z > zoomPercent);
    onZoomChange(nextPreset ? nextPreset / 100 : view.zoom * 1.5);
  };

  const handleZoomOut = () => {
    const prevPreset = [...zoomPresets].reverse().find((z) => z < zoomPercent);
    onZoomChange(prevPreset ? prevPreset / 100 : view.zoom / 1.5);
  };

  const handleZoomSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'fit') {
      onFitToWindow();
    } else {
      onZoomChange(parseInt(value, 10) / 100);
    }
  };

  return (
    <div className="h-7 bg-gray-100 dark:bg-[#2c2c2e] border-t border-gray-200 dark:border-white/10 flex items-center justify-between px-3 text-xs text-gray-500 dark:text-white/50">
      {/* Left: Document info */}
      <div className="flex items-center gap-4">
        <span>
          {document.width} x {document.height} px
        </span>
        {selectedCount > 0 && (
          <span>
            {selectedCount} object{selectedCount !== 1 ? 's' : ''} selected
          </span>
        )}
      </div>

      {/* Right: Zoom controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleZoomOut}
          className="w-5 h-5 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/10 rounded"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <select
          value={zoomPresets.includes(zoomPercent) ? zoomPercent : 'custom'}
          onChange={handleZoomSelect}
          className="w-20 px-1 py-0.5 bg-transparent border border-gray-300 dark:border-white/20 rounded text-xs text-gray-600 dark:text-white/60 cursor-pointer"
        >
          {!zoomPresets.includes(zoomPercent) && (
            <option value="custom">{zoomPercent}%</option>
          )}
          {zoomPresets.map((z) => (
            <option key={z} value={z}>
              {z}%
            </option>
          ))}
          <option value="fit">Fit to Window</option>
        </select>

        <button
          onClick={handleZoomIn}
          className="w-5 h-5 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/10 rounded"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-gray-300 dark:bg-white/20 mx-1" />

        <button
          onClick={onFitToWindow}
          className="w-5 h-5 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/10 rounded"
          title="Fit to Window"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
