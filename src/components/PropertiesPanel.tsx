/**
 * PropertiesPanel - Element properties editor
 */

import React, { useState, useCallback, useEffect } from 'react';
import type {
  VectorElement,
  Color,
  Stroke,
  Fill,
  Transform,
  PathElement,
  RectElement,
  EllipseElement,
  TextElement,
  StarElement,
} from '../types';
import { colorToHex, hexToColor, createStroke } from '../types';

interface PropertiesPanelProps {
  selectedElements: VectorElement[];
  onElementUpdate: (id: string, updates: Partial<VectorElement>) => void;
}

interface ColorInputProps {
  label: string;
  color: Color | null;
  onChange: (color: Color | null) => void;
  allowNone?: boolean;
}

const ColorInput: React.FC<ColorInputProps> = ({ label, color, onChange, allowNone = true }) => {
  const [hex, setHex] = useState(color ? colorToHex(color) : '#000000');

  useEffect(() => {
    if (color) {
      setHex(colorToHex(color));
    }
  }, [color]);

  const handleChange = (value: string) => {
    setHex(value);
    if (value.match(/^#[0-9a-fA-F]{6}$/)) {
      onChange(hexToColor(value));
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 dark:text-white/50 w-12">{label}</label>
      <div className="flex items-center gap-1 flex-1">
        {allowNone && (
          <button
            onClick={() => onChange(color ? null : hexToColor('#000000'))}
            className={`w-5 h-5 flex items-center justify-center rounded border text-xs
              ${color === null
                ? 'border-red-400 text-red-400'
                : 'border-gray-300 dark:border-white/20 text-gray-400 dark:text-white/40'
              }
            `}
            title={color ? 'Remove fill' : 'Add fill'}
          >
            {color === null ? '/' : ''}
          </button>
        )}
        <input
          type="color"
          value={hex}
          onChange={(e) => handleChange(e.target.value)}
          disabled={color === null}
          className="w-7 h-7 rounded cursor-pointer disabled:opacity-30"
        />
        <input
          type="text"
          value={color ? hex : 'None'}
          onChange={(e) => handleChange(e.target.value)}
          disabled={color === null}
          className="flex-1 px-2 py-1 text-sm bg-gray-100 dark:bg-white/10 rounded text-gray-800 dark:text-white/80 font-mono disabled:opacity-30"
        />
        {color && (
          <input
            type="number"
            min="0"
            max="100"
            value={Math.round(color.a * 100)}
            onChange={(e) => onChange({ ...color, a: parseInt(e.target.value, 10) / 100 })}
            className="w-12 px-1 py-1 text-sm bg-gray-100 dark:bg-white/10 rounded text-gray-800 dark:text-white/80 text-center"
          />
        )}
      </div>
    </div>
  );
};

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

const NumberInput: React.FC<NumberInputProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}) => {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 dark:text-white/50 w-12">{label}</label>
      <div className="flex items-center gap-1 flex-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          className="flex-1 px-2 py-1 text-sm bg-gray-100 dark:bg-white/10 rounded text-gray-800 dark:text-white/80"
        />
        {unit && <span className="text-xs text-gray-400 dark:text-white/40">{unit}</span>}
      </div>
    </div>
  );
};

interface StrokeEditorProps {
  stroke: Stroke | null;
  onChange: (stroke: Stroke | null) => void;
}

const StrokeEditor: React.FC<StrokeEditorProps> = ({ stroke, onChange }) => {
  const handleToggle = () => {
    if (stroke) {
      onChange(null);
    } else {
      onChange(createStroke({ r: 0, g: 0, b: 0, a: 1 }));
    }
  };

  const handleUpdate = (updates: Partial<Stroke>) => {
    if (stroke) {
      onChange({ ...stroke, ...updates });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600 dark:text-white/60">Stroke</span>
        <button
          onClick={handleToggle}
          className={`px-2 py-0.5 text-xs rounded ${
            stroke
              ? 'bg-blue-100 dark:bg-blue-600/30 text-blue-600 dark:text-blue-400'
              : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50'
          }`}
        >
          {stroke ? 'On' : 'Off'}
        </button>
      </div>

      {stroke && (
        <div className="space-y-2 pl-2 border-l-2 border-gray-200 dark:border-white/10">
          <ColorInput
            label="Color"
            color={stroke.color}
            onChange={(color) => handleUpdate({ color: color || { r: 0, g: 0, b: 0, a: 1 } })}
            allowNone={false}
          />
          <NumberInput
            label="Width"
            value={stroke.width}
            onChange={(width) => handleUpdate({ width })}
            min={0}
            max={100}
            step={0.5}
            unit="px"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-white/50 w-12">Cap</label>
            <select
              value={stroke.cap}
              onChange={(e) => handleUpdate({ cap: e.target.value as Stroke['cap'] })}
              className="flex-1 px-2 py-1 text-sm bg-gray-100 dark:bg-white/10 rounded text-gray-800 dark:text-white/80"
            >
              <option value="butt">Butt</option>
              <option value="round">Round</option>
              <option value="square">Square</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-white/50 w-12">Join</label>
            <select
              value={stroke.join}
              onChange={(e) => handleUpdate({ join: e.target.value as Stroke['join'] })}
              className="flex-1 px-2 py-1 text-sm bg-gray-100 dark:bg-white/10 rounded text-gray-800 dark:text-white/80"
            >
              <option value="miter">Miter</option>
              <option value="round">Round</option>
              <option value="bevel">Bevel</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-white/50 w-12">Dash</label>
            <input
              type="text"
              value={stroke.dashArray.join(', ')}
              onChange={(e) => {
                const dashes = e.target.value
                  .split(',')
                  .map((s) => parseFloat(s.trim()))
                  .filter((n) => !isNaN(n));
                handleUpdate({ dashArray: dashes });
              }}
              placeholder="e.g. 5, 3"
              className="flex-1 px-2 py-1 text-sm bg-gray-100 dark:bg-white/10 rounded text-gray-800 dark:text-white/80"
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface TransformEditorProps {
  transform: Transform;
  onChange: (transform: Transform) => void;
}

const TransformEditor: React.FC<TransformEditorProps> = ({ transform, onChange }) => {
  const handleUpdate = (updates: Partial<Transform>) => {
    onChange({ ...transform, ...updates });
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-gray-600 dark:text-white/60">Transform</span>
      <div className="grid grid-cols-2 gap-2">
        <NumberInput
          label="X"
          value={transform.translateX}
          onChange={(translateX) => handleUpdate({ translateX })}
        />
        <NumberInput
          label="Y"
          value={transform.translateY}
          onChange={(translateY) => handleUpdate({ translateY })}
        />
        <NumberInput
          label="Rot"
          value={transform.rotation}
          onChange={(rotation) => handleUpdate({ rotation })}
          unit="deg"
        />
        <NumberInput
          label="Scale"
          value={transform.scaleX}
          onChange={(scale) => handleUpdate({ scaleX: scale, scaleY: scale })}
          step={0.1}
        />
      </div>
    </div>
  );
};

// Type-specific editors
const RectEditor: React.FC<{
  element: RectElement;
  onUpdate: (updates: Partial<RectElement>) => void;
}> = ({ element, onUpdate }) => (
  <div className="space-y-2">
    <span className="text-xs font-medium text-gray-600 dark:text-white/60">Rectangle</span>
    <div className="grid grid-cols-2 gap-2">
      <NumberInput label="X" value={element.x} onChange={(x) => onUpdate({ x })} />
      <NumberInput label="Y" value={element.y} onChange={(y) => onUpdate({ y })} />
      <NumberInput label="W" value={element.width} onChange={(width) => onUpdate({ width })} min={1} />
      <NumberInput label="H" value={element.height} onChange={(height) => onUpdate({ height })} min={1} />
      <NumberInput label="Rx" value={element.rx} onChange={(rx) => onUpdate({ rx })} min={0} />
      <NumberInput label="Ry" value={element.ry} onChange={(ry) => onUpdate({ ry })} min={0} />
    </div>
  </div>
);

const EllipseEditor: React.FC<{
  element: EllipseElement;
  onUpdate: (updates: Partial<EllipseElement>) => void;
}> = ({ element, onUpdate }) => (
  <div className="space-y-2">
    <span className="text-xs font-medium text-gray-600 dark:text-white/60">Ellipse</span>
    <div className="grid grid-cols-2 gap-2">
      <NumberInput label="CX" value={element.cx} onChange={(cx) => onUpdate({ cx })} />
      <NumberInput label="CY" value={element.cy} onChange={(cy) => onUpdate({ cy })} />
      <NumberInput label="RX" value={element.rx} onChange={(rx) => onUpdate({ rx })} min={1} />
      <NumberInput label="RY" value={element.ry} onChange={(ry) => onUpdate({ ry })} min={1} />
    </div>
  </div>
);

const StarEditor: React.FC<{
  element: StarElement;
  onUpdate: (updates: Partial<StarElement>) => void;
}> = ({ element, onUpdate }) => (
  <div className="space-y-2">
    <span className="text-xs font-medium text-gray-600 dark:text-white/60">Star</span>
    <div className="grid grid-cols-2 gap-2">
      <NumberInput label="Points" value={element.points} onChange={(points) => onUpdate({ points })} min={3} max={12} />
      <NumberInput label="Outer" value={element.outerRadius} onChange={(outerRadius) => onUpdate({ outerRadius })} min={1} />
      <NumberInput label="Inner" value={element.innerRadius} onChange={(innerRadius) => onUpdate({ innerRadius })} min={1} />
      <NumberInput label="Rot" value={element.rotation} onChange={(rotation) => onUpdate({ rotation })} />
    </div>
  </div>
);

const TextEditor: React.FC<{
  element: TextElement;
  onUpdate: (updates: Partial<TextElement>) => void;
}> = ({ element, onUpdate }) => (
  <div className="space-y-2">
    <span className="text-xs font-medium text-gray-600 dark:text-white/60">Text</span>
    <input
      type="text"
      value={element.text}
      onChange={(e) => onUpdate({ text: e.target.value })}
      className="w-full px-2 py-1 text-sm bg-gray-100 dark:bg-white/10 rounded text-gray-800 dark:text-white/80"
    />
    <div className="grid grid-cols-2 gap-2">
      <NumberInput label="Size" value={element.fontSize} onChange={(fontSize) => onUpdate({ fontSize })} min={1} />
      <NumberInput label="Weight" value={element.fontWeight} onChange={(fontWeight) => onUpdate({ fontWeight })} min={100} max={900} step={100} />
    </div>
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 dark:text-white/50 w-12">Font</label>
      <select
        value={element.fontFamily}
        onChange={(e) => onUpdate({ fontFamily: e.target.value })}
        className="flex-1 px-2 py-1 text-sm bg-gray-100 dark:bg-white/10 rounded text-gray-800 dark:text-white/80"
      >
        <option value="Inter, sans-serif">Inter</option>
        <option value="Arial, sans-serif">Arial</option>
        <option value="Georgia, serif">Georgia</option>
        <option value="monospace">Monospace</option>
      </select>
    </div>
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 dark:text-white/50 w-12">Align</label>
      <select
        value={element.textAnchor}
        onChange={(e) => onUpdate({ textAnchor: e.target.value as TextElement['textAnchor'] })}
        className="flex-1 px-2 py-1 text-sm bg-gray-100 dark:bg-white/10 rounded text-gray-800 dark:text-white/80"
      >
        <option value="start">Left</option>
        <option value="middle">Center</option>
        <option value="end">Right</option>
      </select>
    </div>
  </div>
);

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedElements,
  onElementUpdate,
}) => {
  if (selectedElements.length === 0) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-[#1e1e1e] p-4">
        <p className="text-sm text-gray-400 dark:text-white/40 text-center mt-8">
          Select an element to edit its properties
        </p>
      </div>
    );
  }

  const element = selectedElements[0]; // Edit first selected element
  const isMultiple = selectedElements.length > 1;

  const handleUpdate = (updates: Partial<VectorElement>) => {
    onElementUpdate(element.id, updates);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1e1e1e]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-white/10">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wide">
          Properties
          {isMultiple && ` (${selectedElements.length} selected)`}
        </h3>
      </div>

      {/* Properties */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Element name */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-white/50 w-12">Name</label>
          <input
            type="text"
            value={element.name}
            onChange={(e) => handleUpdate({ name: e.target.value })}
            className="flex-1 px-2 py-1 text-sm bg-gray-100 dark:bg-white/10 rounded text-gray-800 dark:text-white/80"
          />
        </div>

        {/* Opacity */}
        <NumberInput
          label="Opacity"
          value={Math.round(element.opacity * 100)}
          onChange={(value) => handleUpdate({ opacity: value / 100 })}
          min={0}
          max={100}
          unit="%"
        />

        <hr className="border-gray-200 dark:border-white/10" />

        {/* Fill */}
        {element.type !== 'group' && (
          <div className="space-y-2">
            <span className="text-xs font-medium text-gray-600 dark:text-white/60">Fill</span>
            <ColorInput
              label="Color"
              color={(element.fill as Color) || null}
              onChange={(color) => handleUpdate({ fill: color } as Partial<VectorElement>)}
            />
          </div>
        )}

        {/* Stroke */}
        {element.type !== 'group' && (
          <StrokeEditor
            stroke={element.stroke}
            onChange={(stroke) => handleUpdate({ stroke } as Partial<VectorElement>)}
          />
        )}

        <hr className="border-gray-200 dark:border-white/10" />

        {/* Type-specific editors */}
        {element.type === 'rect' && (
          <RectEditor element={element} onUpdate={handleUpdate} />
        )}
        {element.type === 'ellipse' && (
          <EllipseEditor element={element} onUpdate={handleUpdate} />
        )}
        {element.type === 'star' && (
          <StarEditor element={element} onUpdate={handleUpdate} />
        )}
        {element.type === 'text' && (
          <TextEditor element={element} onUpdate={handleUpdate} />
        )}

        <hr className="border-gray-200 dark:border-white/10" />

        {/* Transform */}
        <TransformEditor
          transform={element.transform}
          onChange={(transform) => handleUpdate({ transform })}
        />
      </div>
    </div>
  );
};
