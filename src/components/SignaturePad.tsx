import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eraser, CheckCircle2, PenTool, AlertCircle } from 'lucide-react';

interface SignaturePadProps {
  title: string;
  role: string;
  name: string;
  onNameChange: (name: string) => void;
  regNumber?: string;
  onRegNumberChange?: (reg: string) => void;
  regLabel?: string;
  signature?: string;
  onSignatureChange: (signature: string | undefined) => void;
  placeholderName?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  title,
  role,
  name,
  onNameChange,
  regNumber = '',
  onRegNumberChange,
  regLabel = 'N° Registro / RUT',
  signature,
  onSignatureChange,
  placeholderName = 'Nombre completo'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(!!signature);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions considering DPI
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Only resize if needed
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a'; // Slate-900 dark ink
    ctx.lineWidth = 2.5;

    // If signature exists, draw it onto canvas
    if (signature) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
      img.src = signature;
    } else {
      ctx.clearRect(0, 0, rect.width, rect.height);
      setHasDrawn(false);
    }
  }, [signature]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (hasDrawn) {
      // Export signature as PNG data URL
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureChange(dataUrl);
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    onSignatureChange(undefined);
  };

  return (
    <Card className="border border-neutral-200 shadow-sm rounded-xl overflow-hidden bg-white">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
          <div className="flex items-center gap-2">
            <PenTool className="h-4 w-4 text-blue-600" />
            <h4 className="font-semibold text-sm text-neutral-900">{title}</h4>
          </div>
          <Badge variant={signature ? 'default' : 'outline'} className={signature ? 'bg-emerald-600 text-white' : 'text-neutral-500'}>
            {signature ? (
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Firmado</span>
            ) : (
              <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Pendiente</span>
            )}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-neutral-700">{role}</Label>
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={placeholderName}
              className="text-sm h-9"
            />
          </div>

          {onRegNumberChange && (
            <div className="space-y-1">
              <Label className="text-xs font-medium text-neutral-700">{regLabel}</Label>
              <Input
                value={regNumber}
                onChange={(e) => onRegNumberChange(e.target.value)}
                placeholder="Ej: 12.345.678-9 / Reg. 45012"
                className="text-sm h-9"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-neutral-600 flex items-center gap-1">
              Cuadro de Firma Electrónica <span className="text-neutral-400 font-normal">(Dibuje con el ratón o táctil)</span>
            </Label>
            {hasDrawn && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2"
              >
                <Eraser className="h-3.5 w-3.5 mr-1" /> Limpiar Firma
              </Button>
            )}
          </div>

          <div className="relative border-2 border-dashed border-neutral-300 rounded-lg bg-neutral-50/50 hover:bg-white transition-colors overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-32 touch-none cursor-crosshair block"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            {!hasDrawn && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <span className="text-xs text-neutral-400 select-none flex items-center gap-1.5">
                  <PenTool className="h-3.5 w-3.5" /> Dibuje la firma electrónica aquí
                </span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-neutral-400 italic">
            Esta firma quedará estampada en la versión oficial del Informe Técnico en formato PDF.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
