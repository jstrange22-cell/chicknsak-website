import { useRef, useEffect, useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Eraser, Check } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  onClear?: () => void;
  width?: number;
  height?: number;
}

export function SignaturePad({
  onSave,
  onClear,
  width = 500,
  height = 200,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasStrokes, setHasStrokes] = useState(false);

  /**
   * Get the position of a pointer event relative to the canvas,
   * accounting for CSS scaling vs. actual canvas dimensions.
   */
  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    []
  );

  /**
   * Initialize canvas with a white background.
   */
  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    initializeCanvas();
  }, [initializeCanvas]);

  /**
   * Begin a new stroke at the given canvas coordinates.
   */
  const startDrawing = useCallback(
    (x: number, y: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      isDrawingRef.current = true;
      lastPointRef.current = { x, y };

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(x, y);
    },
    []
  );

  /**
   * Continue the current stroke to the given canvas coordinates.
   */
  const draw = useCallback(
    (x: number, y: number) => {
      if (!isDrawingRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.lineTo(x, y);
      ctx.stroke();
      lastPointRef.current = { x, y };

      if (!hasStrokes) {
        setHasStrokes(true);
      }
    },
    [hasStrokes]
  );

  /**
   * End the current stroke.
   */
  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  }, []);

  // --- Mouse event handlers ---

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const point = getCanvasPoint(e.clientX, e.clientY);
      startDrawing(point.x, point.y);
    },
    [getCanvasPoint, startDrawing]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const point = getCanvasPoint(e.clientX, e.clientY);
      draw(point.x, point.y);
    },
    [getCanvasPoint, draw]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      stopDrawing();
    },
    [stopDrawing]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      stopDrawing();
    },
    [stopDrawing]
  );

  // --- Touch event handlers ---

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const point = getCanvasPoint(touch.clientX, touch.clientY);
      startDrawing(point.x, point.y);
    },
    [getCanvasPoint, startDrawing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const point = getCanvasPoint(touch.clientX, touch.clientY);
      draw(point.x, point.y);
    },
    [getCanvasPoint, draw]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      stopDrawing();
    },
    [stopDrawing]
  );

  /**
   * Clear the canvas and reset to a blank white state.
   */
  const handleClear = useCallback(() => {
    initializeCanvas();
    setHasStrokes(false);
    onClear?.();
  }, [initializeCanvas, onClear]);

  /**
   * Export the canvas contents as a base64 PNG data URL
   * and pass it to the onSave callback.
   */
  const handleDone = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  }, [onSave]);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border-2 border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full cursor-crosshair touch-none"
          style={{ aspectRatio: `${width} / ${height}` }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>

      <p className="text-center text-xs text-slate-400">
        Draw your signature above
      </p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleClear}
        >
          <Eraser className="h-4 w-4" />
          Clear
        </Button>
        <Button
          type="button"
          size="sm"
          className="flex-1"
          onClick={handleDone}
          disabled={!hasStrokes}
        >
          <Check className="h-4 w-4" />
          Done
        </Button>
      </div>
    </div>
  );
}
