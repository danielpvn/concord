import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Move } from 'lucide-react';

export const ImageCropperModal = ({ isOpen, imageSrc, onCropComplete, onCancel }) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  const imageRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setImageLoaded(false);
    }
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) return null;

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomDelta = e.deltaY * -0.0015;
    setZoom((prevZoom) => Math.min(Math.max(1, prevZoom + zoomDelta), 3.5));
  };

  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleSaveCrop = () => {
    const img = imageRef.current;
    if (!img || !imageLoaded) return;

    const CROP_SIZE = 256;
    const canvas = document.createElement('canvas');
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    const ctx = canvas.getContext('2d');

    // Limpa o canvas
    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);

    // Salva estado e recorta em formato circular suave
    ctx.save();
    ctx.beginPath();
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Calcula dimensões do viewport de 240px na tela
    const viewSize = 240;
    const scaleFactor = CROP_SIZE / viewSize;

    // Dimensões renderizadas da imagem dentro do preview
    const renderedWidth = img.width * zoom;
    const renderedHeight = img.height * zoom;

    // Posição centralizada com offset do usuário
    const destX = (viewSize / 2 - renderedWidth / 2 + position.x) * scaleFactor;
    const destY = (viewSize / 2 - renderedHeight / 2 + position.y) * scaleFactor;
    const destWidth = renderedWidth * scaleFactor;
    const destHeight = renderedHeight * scaleFactor;

    ctx.drawImage(img, destX, destY, destWidth, destHeight);
    ctx.restore();

    try {
      // Safari não gera WEBP: se vier PNG, o servidor também aceita
      canvas.toBlob((blob) => {
        if (blob) {
          onCropComplete(blob);
        }
      }, 'image/webp', 0.92);
    } catch (err) {
      console.error('Erro ao recortar imagem:', err);
      alert('Não foi possível usar essa imagem. Baixe-a e envie pelo botão "Escolher Imagem".');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-gaming-900 border border-gaming-700/80 rounded-2xl p-6 shadow-2xl relative">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-4 border-b border-gaming-800">
          <div className="flex items-center gap-2">
            <Move className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">Ajustar e Redimensionar Avatar</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-gaming-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-3 text-center">
          Arraste a imagem para centralizar e use a barra abaixo para dar zoom.
        </p>

        {/* Área de Visualização e Corte */}
        <div className="mt-4 flex flex-col items-center justify-center">
          <div
            ref={containerRef}
            // Pointer events: funciona com mouse e com o dedo no celular
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              handleMouseDown(e);
            }}
            onPointerMove={handleMouseMove}
            onPointerUp={handleMouseUp}
            onPointerCancel={handleMouseUp}
            style={{ touchAction: 'none' }}
            onWheel={handleWheel}
            className="relative w-60 h-60 rounded-full border-4 border-indigo-500 shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing bg-gaming-950 flex items-center justify-center select-none"
            title="Arraste para reposicionar ou use a roda do mouse para zoom"
          >
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Prévia para corte"
              crossOrigin="anonymous"
              onLoad={() => setImageLoaded(true)}
              draggable={false}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transition: isDragging ? 'none' : 'transform 0.05s ease-out',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                pointerEvents: 'none'
              }}
            />

            {/* Máscara de auxílio visual com grid suave */}
            <div className="absolute inset-0 rounded-full ring-1 ring-white/20 pointer-events-none" />
          </div>
        </div>

        {/* Controles de Zoom e Reset */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3 bg-gaming-950 p-3 rounded-xl border border-gaming-800">
            <ZoomOut className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.02"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gaming-700 rounded-lg appearance-none cursor-pointer accent-gaming-accent"
            />
            <ZoomIn className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-xs font-mono text-slate-300 w-10 text-right">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg bg-gaming-800 hover:bg-gaming-700 text-slate-300 text-xs font-medium transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Centralizar</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-xl bg-gaming-800 hover:bg-gaming-700 text-slate-300 text-xs font-medium transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSaveCrop}
                disabled={!imageLoaded}
                className="px-5 py-2 rounded-xl bg-gaming-accent hover:bg-indigo-600 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Aplicar Avatar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
