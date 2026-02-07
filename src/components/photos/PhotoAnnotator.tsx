import { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Line, Arrow, Rect, Circle, Text, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import { X, Save, Undo2, Redo2, Trash2, Pen, ArrowRight, Minus, Square, CircleIcon, Type } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToolType = 'pen' | 'arrow' | 'line' | 'rectangle' | 'circle' | 'text';

interface ShapeData {
  id: string;
  type: ToolType;
  points: number[];
  color: string;
  strokeWidth: number;
  text?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
}

interface PhotoAnnotatorProps {
  imageUrl: string;
  existingShapes?: ShapeData[];
  onSave: (dataUrl: string, shapes: ShapeData[]) => void;
  onCancel: () => void;
}

const COLORS = [
  '#EF4444', '#3B82F6', '#10B981', '#F59E0B',
  '#F97316', '#8B5CF6', '#FFFFFF', '#000000',
];

const STROKE_WIDTHS = [2, 4, 8];

const TOOLS: { type: ToolType; icon: React.ElementType; label: string }[] = [
  { type: 'pen', icon: Pen, label: 'Pen' },
  { type: 'arrow', icon: ArrowRight, label: 'Arrow' },
  { type: 'line', icon: Minus, label: 'Line' },
  { type: 'rectangle', icon: Square, label: 'Rectangle' },
  { type: 'circle', icon: CircleIcon, label: 'Circle' },
  { type: 'text', icon: Type, label: 'Text' },
];

export function PhotoAnnotator({ imageUrl, existingShapes = [], onSave, onCancel }: PhotoAnnotatorProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [imageScale, setImageScale] = useState(1);

  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [activeColor, setActiveColor] = useState('#EF4444');
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(4);

  const [shapes, setShapes] = useState<ShapeData[]>(existingShapes);
  const [undoneShapes, setUndoneShapes] = useState<ShapeData[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentShape, setCurrentShape] = useState<ShapeData | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputPos, setTextInputPos] = useState({ x: 0, y: 0 });
  const [textValue, setTextValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load image
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      updateStageSize(img);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const updateStageSize = useCallback((img: HTMLImageElement) => {
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight - 160; // Leave room for toolbars
    const scale = Math.min(containerWidth / img.width, containerHeight / img.height);
    setImageScale(scale);
    setStageSize({
      width: img.width * scale,
      height: img.height * scale,
    });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (image) updateStageSize(image);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [image, updateStageSize]);

  const generateId = () => `shape_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const getPointerPos = (_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return { x: pos.x / imageScale, y: pos.y / imageScale };
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (showTextInput) return;
    const pos = getPointerPos(e);

    if (activeTool === 'text') {
      setTextInputPos({ x: pos.x * imageScale, y: pos.y * imageScale });
      setTextValue('');
      setShowTextInput(true);
      return;
    }

    setIsDrawing(true);
    setUndoneShapes([]);

    const newShape: ShapeData = {
      id: generateId(),
      type: activeTool,
      points: [pos.x, pos.y],
      color: activeColor,
      strokeWidth: activeStrokeWidth,
      x: pos.x,
      y: pos.y,
    };

    if (activeTool === 'rectangle' || activeTool === 'circle') {
      newShape.width = 0;
      newShape.height = 0;
      newShape.radius = 0;
    }

    setCurrentShape(newShape);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!isDrawing || !currentShape) return;
    const pos = getPointerPos(e);

    if (activeTool === 'pen') {
      setCurrentShape({
        ...currentShape,
        points: [...currentShape.points, pos.x, pos.y],
      });
    } else if (activeTool === 'arrow' || activeTool === 'line') {
      const startX = currentShape.points[0];
      const startY = currentShape.points[1];
      setCurrentShape({
        ...currentShape,
        points: [startX, startY, pos.x, pos.y],
      });
    } else if (activeTool === 'rectangle') {
      setCurrentShape({
        ...currentShape,
        width: pos.x - (currentShape.x || 0),
        height: pos.y - (currentShape.y || 0),
      });
    } else if (activeTool === 'circle') {
      const dx = pos.x - (currentShape.x || 0);
      const dy = pos.y - (currentShape.y || 0);
      setCurrentShape({
        ...currentShape,
        radius: Math.sqrt(dx * dx + dy * dy),
      });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentShape) return;
    setIsDrawing(false);
    setShapes((prev) => [...prev, currentShape]);
    setCurrentShape(null);
  };

  const handleTextSubmit = () => {
    if (textValue.trim()) {
      const pos = { x: textInputPos.x / imageScale, y: textInputPos.y / imageScale };
      const newShape: ShapeData = {
        id: generateId(),
        type: 'text',
        points: [pos.x, pos.y],
        color: activeColor,
        strokeWidth: activeStrokeWidth,
        text: textValue,
        x: pos.x,
        y: pos.y,
      };
      setShapes((prev) => [...prev, newShape]);
      setUndoneShapes([]);
    }
    setShowTextInput(false);
    setTextValue('');
  };

  const handleUndo = () => {
    if (shapes.length === 0) return;
    const lastShape = shapes[shapes.length - 1];
    setShapes((prev) => prev.slice(0, -1));
    setUndoneShapes((prev) => [...prev, lastShape]);
  };

  const handleRedo = () => {
    if (undoneShapes.length === 0) return;
    const lastUndone = undoneShapes[undoneShapes.length - 1];
    setUndoneShapes((prev) => prev.slice(0, -1));
    setShapes((prev) => [...prev, lastUndone]);
  };

  const handleClearAll = () => {
    if (shapes.length === 0) return;
    if (window.confirm('Clear all annotations?')) {
      setShapes([]);
      setUndoneShapes([]);
    }
  };

  const handleSave = async () => {
    if (!stageRef.current || !image) return;
    setIsSaving(true);

    try {
      // Create a full-resolution canvas
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = image.width;
      exportCanvas.height = image.height;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      // Draw original image at full res
      ctx.drawImage(image, 0, 0);

      // Export the annotation layer from Konva at full res
      const scale = image.width / stageSize.width;
      const annotationDataUrl = stageRef.current.toDataURL({
        pixelRatio: scale,
      });

      // Draw annotations on top
      const annotImg = new window.Image();
      annotImg.onload = () => {
        ctx.drawImage(annotImg, 0, 0, image.width, image.height);
        const finalDataUrl = exportCanvas.toDataURL('image/jpeg', 0.9);
        onSave(finalDataUrl, shapes);
      };
      annotImg.src = annotationDataUrl;
    } catch (err) {
      console.error('Error saving annotation:', err);
      setIsSaving(false);
    }
  };

  const renderShape = (shape: ShapeData, key?: string) => {
    const props = { key: key || shape.id };
    const scaledStroke = shape.strokeWidth;

    switch (shape.type) {
      case 'pen':
        return (
          <Line
            {...props}
            points={shape.points}
            stroke={shape.color}
            strokeWidth={scaledStroke}
            lineCap="round"
            lineJoin="round"
            tension={0.5}
          />
        );
      case 'arrow':
        return (
          <Arrow
            {...props}
            points={shape.points}
            stroke={shape.color}
            strokeWidth={scaledStroke}
            fill={shape.color}
            lineCap="round"
            pointerLength={scaledStroke * 3}
            pointerWidth={scaledStroke * 3}
          />
        );
      case 'line':
        return (
          <Line
            {...props}
            points={shape.points}
            stroke={shape.color}
            strokeWidth={scaledStroke}
            lineCap="round"
          />
        );
      case 'rectangle':
        return (
          <Rect
            {...props}
            x={shape.x || 0}
            y={shape.y || 0}
            width={shape.width || 0}
            height={shape.height || 0}
            stroke={shape.color}
            strokeWidth={scaledStroke}
          />
        );
      case 'circle':
        return (
          <Circle
            {...props}
            x={shape.x || 0}
            y={shape.y || 0}
            radius={shape.radius || 0}
            stroke={shape.color}
            strokeWidth={scaledStroke}
          />
        );
      case 'text':
        return (
          <Text
            {...props}
            x={shape.x || 0}
            y={shape.y || 0}
            text={shape.text || ''}
            fontSize={shape.strokeWidth * 5}
            fill={shape.color}
            fontFamily="Arial"
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between p-3 bg-gray-900">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 text-white/80 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10"
        >
          <X className="w-5 h-5" />
          <span className="text-sm">Cancel</span>
        </button>
        <span className="text-white font-medium text-sm">Annotate Photo</span>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            "flex items-center gap-1 text-white px-3 py-1.5 rounded-lg",
            isSaving ? "opacity-50" : "bg-blue-500 hover:bg-blue-600"
          )}
        >
          <Save className="w-4 h-4" />
          <span className="text-sm">{isSaving ? 'Saving...' : 'Save'}</span>
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-gray-950">
        {image && (
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            scaleX={imageScale}
            scaleY={imageScale}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
          >
            <Layer>
              <KonvaImage image={image} width={image.width} height={image.height} />
            </Layer>
            <Layer>
              {shapes.map((shape) => renderShape(shape))}
              {currentShape && renderShape(currentShape, 'current')}
            </Layer>
          </Stage>
        )}

        {/* Text input overlay */}
        {showTextInput && (
          <div
            className="absolute z-10"
            style={{ left: textInputPos.x, top: textInputPos.y + 56 }}
          >
            <div className="bg-white rounded-lg shadow-xl p-2 flex gap-2">
              <input
                type="text"
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                placeholder="Enter text..."
                className="px-2 py-1 border rounded text-sm w-48"
                autoFocus
              />
              <button
                onClick={handleTextSubmit}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
              >
                Add
              </button>
              <button
                onClick={() => setShowTextInput(false)}
                className="px-2 py-1 text-gray-500 text-sm hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="bg-gray-900 p-3 space-y-3 safe-area-bottom">
        {/* Tools row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {TOOLS.map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => setActiveTool(type)}
                className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
                  activeTool === type
                    ? "bg-blue-500 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                )}
                title={label}
              >
                <Icon className="w-5 h-5" />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={shapes.length === 0}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30"
              title="Undo"
            >
              <Undo2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={undoneShapes.length === 0}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30"
              title="Redo"
            >
              <Redo2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleClearAll}
              disabled={shapes.length === 0}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/10 disabled:opacity-30"
              title="Clear all"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Color + stroke row */}
        <div className="flex items-center justify-between">
          {/* Colors */}
          <div className="flex items-center gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setActiveColor(color)}
                className={cn(
                  "w-7 h-7 rounded-full border-2 transition-transform",
                  activeColor === color
                    ? "border-white scale-110"
                    : "border-gray-600 hover:border-gray-400"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          {/* Stroke widths */}
          <div className="flex items-center gap-2">
            {STROKE_WIDTHS.map((width) => (
              <button
                key={width}
                onClick={() => setActiveStrokeWidth(width)}
                className={cn(
                  "w-10 h-8 flex items-center justify-center rounded transition-colors",
                  activeStrokeWidth === width
                    ? "bg-white/20 text-white"
                    : "text-gray-400 hover:text-white"
                )}
              >
                <div
                  className="rounded-full bg-current"
                  style={{ width: `${width * 4}px`, height: `${width}px` }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
