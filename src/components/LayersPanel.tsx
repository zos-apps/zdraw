/**
 * LayersPanel - Layer and element management
 */

import React, { useState, useCallback } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  Copy,
  GripVertical,
} from 'lucide-react';
import type { Layer, VectorElement, Document } from '../types';

interface LayersPanelProps {
  document: Document;
  activeLayerId: string;
  selectedElementIds: string[];
  onLayerSelect: (layerId: string) => void;
  onElementSelect: (elementIds: string[], addToSelection?: boolean) => void;
  onLayerAdd: () => void;
  onLayerRemove: (layerId: string) => void;
  onLayerVisibilityChange: (layerId: string, visible: boolean) => void;
  onLayerLockChange: (layerId: string, locked: boolean) => void;
  onLayerRename: (layerId: string, name: string) => void;
  onLayerReorder: (fromIndex: number, toIndex: number) => void;
  onElementVisibilityChange: (elementId: string, visible: boolean) => void;
  onElementLockChange: (elementId: string, locked: boolean) => void;
  onElementDelete: (elementId: string) => void;
  onElementDuplicate: (elementId: string) => void;
}

function getElementIcon(type: VectorElement['type']): string {
  switch (type) {
    case 'path': return 'path';
    case 'rect': return 'rect';
    case 'ellipse': return 'ellipse';
    case 'polygon': return 'polygon';
    case 'star': return 'star';
    case 'text': return 'T';
    case 'group': return 'G';
    default: return '?';
  }
}

interface LayerItemProps {
  layer: Layer;
  isActive: boolean;
  selectedElementIds: string[];
  onSelect: () => void;
  onElementSelect: (elementIds: string[], addToSelection?: boolean) => void;
  onVisibilityChange: (visible: boolean) => void;
  onLockChange: (locked: boolean) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onElementVisibilityChange: (elementId: string, visible: boolean) => void;
  onElementLockChange: (elementId: string, locked: boolean) => void;
  onElementDelete: (elementId: string) => void;
  onElementDuplicate: (elementId: string) => void;
}

const LayerItem: React.FC<LayerItemProps> = ({
  layer,
  isActive,
  selectedElementIds,
  onSelect,
  onElementSelect,
  onVisibilityChange,
  onLockChange,
  onRename,
  onDelete,
  onElementVisibilityChange,
  onElementLockChange,
  onElementDelete,
  onElementDuplicate,
}) => {
  const [isExpanded, setIsExpanded] = useState(!layer.collapsed);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(layer.name);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditName(layer.name);
  };

  const handleNameSubmit = () => {
    setIsEditing(false);
    if (editName.trim() && editName !== layer.name) {
      onRename(editName.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(layer.name);
    }
  };

  return (
    <div className="select-none">
      {/* Layer header */}
      <div
        className={`
          flex items-center gap-1 px-2 py-1.5 cursor-pointer
          ${isActive
            ? 'bg-blue-100 dark:bg-blue-600/30'
            : 'hover:bg-gray-100 dark:hover:bg-white/5'
          }
        `}
        onClick={onSelect}
      >
        {/* Expand/Collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="w-4 h-4 flex items-center justify-center text-gray-500 dark:text-white/50"
        >
          {layer.elements.length > 0 ? (
            isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )
          ) : null}
        </button>

        {/* Folder icon */}
        <span className="w-4 h-4 flex items-center justify-center text-gray-500 dark:text-white/50">
          {isExpanded ? (
            <FolderOpen className="w-4 h-4" />
          ) : (
            <Folder className="w-4 h-4" />
          )}
        </span>

        {/* Layer name */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={handleKeyDown}
              className="w-full px-1 py-0.5 text-sm bg-white dark:bg-[#3c3c3e] border border-blue-500 rounded outline-none"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="text-sm text-gray-800 dark:text-white/80 truncate block"
              onDoubleClick={handleDoubleClick}
            >
              {layer.name}
            </span>
          )}
        </div>

        {/* Visibility toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onVisibilityChange(!layer.visible);
          }}
          className="w-5 h-5 flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60"
        >
          {layer.visible ? (
            <Eye className="w-3.5 h-3.5" />
          ) : (
            <EyeOff className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Lock toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLockChange(!layer.locked);
          }}
          className="w-5 h-5 flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60"
        >
          {layer.locked ? (
            <Lock className="w-3.5 h-3.5" />
          ) : (
            <Unlock className="w-3.5 h-3.5 opacity-30" />
          )}
        </button>
      </div>

      {/* Layer elements */}
      {isExpanded && layer.elements.length > 0 && (
        <div className="ml-4 border-l border-gray-200 dark:border-white/10">
          {layer.elements.map((element) => (
            <ElementItem
              key={element.id}
              element={element}
              isSelected={selectedElementIds.includes(element.id)}
              onSelect={(addToSelection) => onElementSelect([element.id], addToSelection)}
              onVisibilityChange={(visible) => onElementVisibilityChange(element.id, visible)}
              onLockChange={(locked) => onElementLockChange(element.id, locked)}
              onDelete={() => onElementDelete(element.id)}
              onDuplicate={() => onElementDuplicate(element.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ElementItemProps {
  element: VectorElement;
  isSelected: boolean;
  onSelect: (addToSelection?: boolean) => void;
  onVisibilityChange: (visible: boolean) => void;
  onLockChange: (locked: boolean) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const ElementItem: React.FC<ElementItemProps> = ({
  element,
  isSelected,
  onSelect,
  onVisibilityChange,
  onLockChange,
  onDelete,
  onDuplicate,
}) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`
        flex items-center gap-1 pl-3 pr-2 py-1 cursor-pointer
        ${isSelected
          ? 'bg-blue-100 dark:bg-blue-600/30'
          : 'hover:bg-gray-100 dark:hover:bg-white/5'
        }
      `}
      onClick={(e) => onSelect(e.shiftKey)}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Drag handle */}
      <span className="w-3 h-3 flex items-center justify-center text-gray-400 dark:text-white/30 cursor-grab">
        <GripVertical className="w-3 h-3" />
      </span>

      {/* Element type indicator */}
      <span className="w-5 h-5 flex items-center justify-center text-xs font-medium text-gray-500 dark:text-white/50 bg-gray-100 dark:bg-white/10 rounded">
        {getElementIcon(element.type).charAt(0).toUpperCase()}
      </span>

      {/* Element name */}
      <span className="flex-1 text-sm text-gray-700 dark:text-white/70 truncate">
        {element.name}
      </span>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="w-5 h-5 flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60"
            title="Duplicate"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-5 h-5 flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-red-500"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {!showActions && (
        <>
          {/* Visibility toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVisibilityChange(!element.visible);
            }}
            className="w-5 h-5 flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60"
          >
            {element.visible ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3" />
            )}
          </button>

          {/* Lock toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLockChange(!element.locked);
            }}
            className="w-5 h-5 flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60"
          >
            {element.locked ? (
              <Lock className="w-3 h-3" />
            ) : (
              <Unlock className="w-3 h-3 opacity-30" />
            )}
          </button>
        </>
      )}
    </div>
  );
};

export const LayersPanel: React.FC<LayersPanelProps> = ({
  document,
  activeLayerId,
  selectedElementIds,
  onLayerSelect,
  onElementSelect,
  onLayerAdd,
  onLayerRemove,
  onLayerVisibilityChange,
  onLayerLockChange,
  onLayerRename,
  onLayerReorder,
  onElementVisibilityChange,
  onElementLockChange,
  onElementDelete,
  onElementDuplicate,
}) => {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1e1e1e]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-white/10">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wide">
          Layers
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onLayerAdd}
            className="w-6 h-6 flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 rounded"
            title="Add Layer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (document.layers.length > 1) {
                onLayerRemove(activeLayerId);
              }
            }}
            className="w-6 h-6 flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-white/10 rounded disabled:opacity-30"
            disabled={document.layers.length <= 1}
            title="Delete Layer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Layers list */}
      <div className="flex-1 overflow-y-auto">
        {[...document.layers].reverse().map((layer) => (
          <LayerItem
            key={layer.id}
            layer={layer}
            isActive={activeLayerId === layer.id}
            selectedElementIds={selectedElementIds}
            onSelect={() => onLayerSelect(layer.id)}
            onElementSelect={onElementSelect}
            onVisibilityChange={(visible) => onLayerVisibilityChange(layer.id, visible)}
            onLockChange={(locked) => onLayerLockChange(layer.id, locked)}
            onRename={(name) => onLayerRename(layer.id, name)}
            onDelete={() => onLayerRemove(layer.id)}
            onElementVisibilityChange={onElementVisibilityChange}
            onElementLockChange={onElementLockChange}
            onElementDelete={onElementDelete}
            onElementDuplicate={onElementDuplicate}
          />
        ))}
      </div>
    </div>
  );
};
