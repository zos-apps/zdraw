/**
 * PathfinderPanel - Pathfinder operations and path manipulation panel
 *
 * Provides UI for:
 * - Pathfinder operations (unite, subtract, intersect, exclude, divide)
 * - Path operations (offset, smooth, simplify, join, reverse)
 * - Outline stroke
 */

import React, { useCallback } from 'react';
import {
  Combine,
  Minus,
  Intersect,
  XCircle,
  Grid3X3,
  Plus,
  Minus as MinusIcon,
  Wand2,
  Link,
  ArrowRightLeft,
  Circle,
} from 'lucide-react';
import type { VectorElement, PathElement } from '../types';
import { pathfinderOperation, PathfinderOperation } from '../engine/Pathfinder';
import {
  offsetPath,
  smoothPath,
  simplifyPath,
  joinPaths,
  reversePath,
  outlineStroke,
} from '../engine/PathManipulation';

interface PathfinderPanelProps {
  selectedElements: VectorElement[];
  onElementsChange: (oldIds: string[], newElements: PathElement[]) => void;
  onCommitHistory: (description: string) => void;
}

interface ButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function ToolButton({ icon, label, onClick, disabled }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex flex-col items-center justify-center p-2 rounded-lg transition-colors
        ${disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:bg-white/10 active:bg-white/20 cursor-pointer'
        }
      `}
      title={label}
    >
      <div className="w-6 h-6 flex items-center justify-center">{icon}</div>
      <span className="text-[10px] mt-1 text-white/60">{label}</span>
    </button>
  );
}

export const PathfinderPanel: React.FC<PathfinderPanelProps> = ({
  selectedElements,
  onElementsChange,
  onCommitHistory,
}) => {
  // Filter to only path elements
  const pathElements = selectedElements.filter((el): el is PathElement => el.type === 'path');
  const hasTwoPaths = pathElements.length >= 2;
  const hasOnePath = pathElements.length >= 1;

  const handlePathfinder = useCallback(
    (operation: PathfinderOperation) => {
      if (pathElements.length < 2) return;

      try {
        const result = pathfinderOperation(pathElements[0], pathElements[1], operation);
        const oldIds = pathElements.slice(0, 2).map((el) => el.id);
        onElementsChange(oldIds, result);
        onCommitHistory(`Pathfinder: ${operation}`);
      } catch (error) {
        console.error('Pathfinder operation failed:', error);
      }
    },
    [pathElements, onElementsChange, onCommitHistory]
  );

  const handleOffset = useCallback(
    (amount: number) => {
      if (pathElements.length === 0) return;

      const results = pathElements.map((el) => offsetPath(el, amount));
      onElementsChange(
        pathElements.map((el) => el.id),
        results
      );
      onCommitHistory(`Offset path ${amount > 0 ? 'outward' : 'inward'}`);
    },
    [pathElements, onElementsChange, onCommitHistory]
  );

  const handleSmooth = useCallback(() => {
    if (pathElements.length === 0) return;

    const results = pathElements.map((el) => smoothPath(el, 0.5));
    onElementsChange(
      pathElements.map((el) => el.id),
      results
    );
    onCommitHistory('Smooth path');
  }, [pathElements, onElementsChange, onCommitHistory]);

  const handleSimplify = useCallback(() => {
    if (pathElements.length === 0) return;

    const results = pathElements.map((el) => simplifyPath(el, 2));
    onElementsChange(
      pathElements.map((el) => el.id),
      results
    );
    onCommitHistory('Simplify path');
  }, [pathElements, onElementsChange, onCommitHistory]);

  const handleJoin = useCallback(() => {
    if (pathElements.length < 2) return;

    // Join pairs of paths
    let result = pathElements[0];
    for (let i = 1; i < pathElements.length; i++) {
      result = joinPaths(result, pathElements[i]);
    }

    onElementsChange(
      pathElements.map((el) => el.id),
      [result]
    );
    onCommitHistory('Join paths');
  }, [pathElements, onElementsChange, onCommitHistory]);

  const handleReverse = useCallback(() => {
    if (pathElements.length === 0) return;

    const results = pathElements.map((el) => reversePath(el));
    onElementsChange(
      pathElements.map((el) => el.id),
      results
    );
    onCommitHistory('Reverse path');
  }, [pathElements, onElementsChange, onCommitHistory]);

  const handleOutlineStroke = useCallback(() => {
    if (pathElements.length === 0) return;

    const results: PathElement[] = [];
    const idsToRemove: string[] = [];

    for (const el of pathElements) {
      const outlined = outlineStroke(el);
      if (outlined) {
        results.push(outlined);
        idsToRemove.push(el.id);
      }
    }

    if (results.length > 0) {
      onElementsChange(idsToRemove, results);
      onCommitHistory('Outline stroke');
    }
  }, [pathElements, onElementsChange, onCommitHistory]);

  return (
    <div className="p-3 space-y-4">
      {/* Pathfinder Operations */}
      <div>
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-2">
          Shape Modes
        </h3>
        <div className="grid grid-cols-5 gap-1">
          <ToolButton
            icon={<Combine className="w-4 h-4" />}
            label="Unite"
            onClick={() => handlePathfinder('unite')}
            disabled={!hasTwoPaths}
          />
          <ToolButton
            icon={<Minus className="w-4 h-4" />}
            label="Subtract"
            onClick={() => handlePathfinder('subtract')}
            disabled={!hasTwoPaths}
          />
          <ToolButton
            icon={<Intersect className="w-4 h-4" />}
            label="Intersect"
            onClick={() => handlePathfinder('intersect')}
            disabled={!hasTwoPaths}
          />
          <ToolButton
            icon={<XCircle className="w-4 h-4" />}
            label="Exclude"
            onClick={() => handlePathfinder('exclude')}
            disabled={!hasTwoPaths}
          />
          <ToolButton
            icon={<Grid3X3 className="w-4 h-4" />}
            label="Divide"
            onClick={() => handlePathfinder('divide')}
            disabled={!hasTwoPaths}
          />
        </div>
      </div>

      {/* Path Operations */}
      <div>
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-2">
          Path Operations
        </h3>
        <div className="grid grid-cols-4 gap-1">
          <ToolButton
            icon={<Plus className="w-4 h-4" />}
            label="Expand"
            onClick={() => handleOffset(10)}
            disabled={!hasOnePath}
          />
          <ToolButton
            icon={<MinusIcon className="w-4 h-4" />}
            label="Contract"
            onClick={() => handleOffset(-10)}
            disabled={!hasOnePath}
          />
          <ToolButton
            icon={<Wand2 className="w-4 h-4" />}
            label="Smooth"
            onClick={handleSmooth}
            disabled={!hasOnePath}
          />
          <ToolButton
            icon={
              <svg viewBox="0 0 16 16" className="w-4 h-4" stroke="currentColor" fill="none">
                <polyline points="2,8 6,4 10,12 14,8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
            label="Simplify"
            onClick={handleSimplify}
            disabled={!hasOnePath}
          />
        </div>
        <div className="grid grid-cols-4 gap-1 mt-1">
          <ToolButton
            icon={<Link className="w-4 h-4" />}
            label="Join"
            onClick={handleJoin}
            disabled={!hasTwoPaths}
          />
          <ToolButton
            icon={<ArrowRightLeft className="w-4 h-4" />}
            label="Reverse"
            onClick={handleReverse}
            disabled={!hasOnePath}
          />
          <ToolButton
            icon={<Circle className="w-4 h-4" />}
            label="Outline"
            onClick={handleOutlineStroke}
            disabled={!hasOnePath || !pathElements.some((el) => el.stroke)}
          />
        </div>
      </div>

      {/* Help text */}
      {!hasOnePath && (
        <p className="text-xs text-white/40 text-center py-2">
          Select path elements to use these operations
        </p>
      )}
    </div>
  );
};
