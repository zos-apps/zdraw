/**
 * Toolbar - Tool selection sidebar
 */

import React from 'react';
import {
  MousePointer2,
  Pen,
  Square,
  Circle,
  Hexagon,
  Star,
  Minus,
  Type,
  Pipette,
  Hand,
  ZoomIn,
} from 'lucide-react';
import type { ToolType } from '../types';

interface ToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

interface ToolButtonProps {
  tool: ToolType;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
}

const tools: Array<{ id: ToolType; icon: React.ComponentType<{ className?: string }>; label: string; shortcut: string }> = [
  { id: 'select', icon: MousePointer2, label: 'Selection', shortcut: 'V' },
  { id: 'pen', icon: Pen, label: 'Pen', shortcut: 'P' },
  { id: 'rectangle', icon: Square, label: 'Rectangle', shortcut: 'R' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse', shortcut: 'O' },
  { id: 'polygon', icon: Hexagon, label: 'Polygon', shortcut: 'Y' },
  { id: 'star', icon: Star, label: 'Star', shortcut: 'S' },
  { id: 'line', icon: Minus, label: 'Line', shortcut: 'L' },
  { id: 'text', icon: Type, label: 'Text', shortcut: 'T' },
  { id: 'eyedropper', icon: Pipette, label: 'Eyedropper', shortcut: 'I' },
  { id: 'hand', icon: Hand, label: 'Hand', shortcut: 'H' },
  { id: 'zoom', icon: ZoomIn, label: 'Zoom', shortcut: 'Z' },
];

function ToolButton({ tool, active, onClick, icon, label, shortcut }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-10 h-10 flex items-center justify-center rounded-lg transition-colors
        ${active
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10'
        }
      `}
      title={`${label} (${shortcut})`}
    >
      {icon}
    </button>
  );
}

export const Toolbar: React.FC<ToolbarProps> = ({ activeTool, onToolChange }) => {
  return (
    <div className="w-14 bg-gray-50 dark:bg-[#2c2c2e] border-r border-gray-200 dark:border-white/10 flex flex-col items-center py-2 gap-1">
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <ToolButton
            key={tool.id}
            tool={tool.id}
            active={activeTool === tool.id}
            onClick={() => onToolChange(tool.id)}
            icon={<Icon className="w-5 h-5" />}
            label={tool.label}
            shortcut={tool.shortcut}
          />
        );
      })}
    </div>
  );
};
