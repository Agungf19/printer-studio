import { useEffect, useRef, useState, useCallback } from "react";
import { Stage, Layer, Rect, Image as KonvaImage, Group } from "react-konva";

interface KonvaCanvasProps {
  dataUrl?: string;
  zoom?: number;
  paperSize?: string;
  orientation?: "auto" | "portrait" | "landscape";
  onZoomChange?: (zoom: number) => void;
  cropMode?: boolean;
  onCropConfirm?: (croppedDataUrl: string) => void;
  onCropCancel?: () => void;
}

const PAPER_MM: Record<string, [number, number]> = {
  a4: [210, 297],
  letter: [216, 279],
  legal: [216, 356],
  folio: [210, 330],
  f4: [210, 330],
  b5: [176, 250],
  a5: [148, 210],
  a6: [105, 148],
  a3: [297, 420],
  executive: [184, 267],
  "com-10": [105, 241],
  dl: [110, 220],
  c5: [162, 229],
  monarch: [98, 191],
  ledger: [432, 279],
  "a5 long edge": [210, 148],
};

const PAGE_SHADOW = "rgba(0,0,0,0.12)";
const PAD = 40;

export default function KonvaCanvas({
  dataUrl,
  zoom = 100,
  paperSize = "A4",
  orientation = "auto",
  onZoomChange,
  cropMode = false,
  onCropConfirm,
  onCropCancel,
}: KonvaCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState({ w: 800, h: 600 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [cropRect, setCropRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [isDrag, setIsDrag] = useState(false);

  // Track viewport
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setVp({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Load image
  useEffect(() => {
    if (!dataUrl) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = dataUrl;
  }, [dataUrl]);

  // Ctrl+Scroll zoom — cursor-centered
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onZoomChange) return;
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const oldZ = zoom;
      const newZ = Math.min(
        200,
        Math.max(50, zoom + (e.deltaY > 0 ? -10 : 10)),
      );
      if (newZ === oldZ) return;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left + el.scrollLeft;
      const my = e.clientY - rect.top + el.scrollTop;
      onZoomChange(newZ);
      requestAnimationFrame(() => {
        el.scrollLeft = mx * (newZ / oldZ) - (e.clientX - rect.left);
        el.scrollTop = my * (newZ / oldZ) - (e.clientY - rect.top);
      });
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [zoom, onZoomChange]);

  // Reset crop
  useEffect(() => {
    if (!cropMode) {
      setCropStart(null);
      setCropRect(null);
      setIsDrag(false);
    }
  }, [cropMode]);

  // Crop handlers (content coords)
  function cropDown(e: React.MouseEvent) {
    if (!cropMode || !image) return;
    const el = scrollRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCropStart({
      x: e.clientX - r.left + el.scrollLeft,
      y: e.clientY - r.top + el.scrollTop,
    });
    setCropRect(null);
    setIsDrag(true);
  }
  function cropMove(e: React.MouseEvent) {
    if (!isDrag || !cropStart) return;
    const el = scrollRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left + el.scrollLeft;
    const y = e.clientY - r.top + el.scrollTop;
    setCropRect({
      x: Math.min(cropStart.x, x),
      y: Math.min(cropStart.y, y),
      w: Math.abs(x - cropStart.x),
      h: Math.abs(y - cropStart.y),
    });
  }
  function cropUp() {
    setIsDrag(false);
  }

  // Page + image calculation
  const calc = useCallback(() => {
    const key = paperSize.toLowerCase().trim();
    const [pwmm, hmm] = PAPER_MM[key] ?? PAPER_MM["a4"];
    let land: boolean;
    if (orientation === "landscape") land = true;
    else if (orientation === "portrait") land = false;
    else land = image ? image.naturalWidth > image.naturalHeight : false;
    const pageWmm = land ? hmm : pwmm;
    const pageHmm = land ? pwmm : hmm;
    const [rw, rh] = PAPER_MM["a4"];
    const refPW = rw * 2.5,
      refPH = rh * 2.5;
    const fit = Math.min((vp.w - PAD * 2) / refPW, (vp.h - PAD * 2) / refPH, 1);
    const scale = fit * (zoom / 100);
    const mm = 2.5 * scale;
    const sw = Math.ceil(pageWmm * mm);
    const sh = Math.ceil(pageHmm * mm);
    const margin = 10 * scale;
    return { sw, sh, margin, scale };
  }, [image, vp, zoom, paperSize, orientation]);

  const { sw, sh, margin } = calc();

  // Image fit inside page
  const imgL = useCallback(() => {
    if (!image) return null;
    let x = margin,
      y = margin,
      w = sw - margin * 2,
      h = sh - margin * 2;
    const a = image.naturalWidth / image.naturalHeight;
    const ba = w / h;
    if (a > ba) {
      const fh = w / a;
      y += (h - fh) / 2;
      h = fh;
    } else {
      const fw = h * a;
      x += (w - fw) / 2;
      w = fw;
    }
    return { x, y, w, h };
  }, [image, sw, sh, margin]);

  const img = imgL();
  const so = Math.max(2, 4 * (zoom / 100));

  // Center padding
  const px = Math.max(0, (vp.w - sw) / 2);
  const py = Math.max(0, (vp.h - sh) / 2);

  // Perform crop
  function doCrop() {
    if (!image || !cropRect || cropRect.w < 10 || cropRect.h < 10 || !img)
      return;
    const rx = (cropRect.x - px - img.x) / img.w;
    const ry = (cropRect.y - py - img.y) / img.h;
    const rw2 = cropRect.w / img.w;
    const rh2 = cropRect.h / img.h;
    const sx = Math.max(0, Math.min(1, rx));
    const sy = Math.max(0, Math.min(1, ry));
    const ssw = Math.max(0, Math.min(1 - sx, rw2));
    const ssh = Math.max(0, Math.min(1 - sy, rh2));
    if (ssw < 0.01 || ssh < 0.01) return;
    const c = document.createElement("canvas");
    c.width = Math.round(ssw * image.naturalWidth);
    c.height = Math.round(ssh * image.naturalHeight);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      image,
      sx * image.naturalWidth,
      sy * image.naturalHeight,
      c.width,
      c.height,
      0,
      0,
      c.width,
      c.height,
    );
    onCropConfirm?.(c.toDataURL("image/jpeg", 0.92));
  }

  return (
    <div
      ref={scrollRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        position: "relative",
        cursor: cropMode ? "crosshair" : "default",
        background: "var(--workspace-bg)",
      }}
      onMouseDown={cropDown}
      onMouseMove={cropMove}
      onMouseUp={cropUp}
    >
      <div
        style={{
          display: "inline-block",
          minWidth: "100%",
          minHeight: "100%",
          padding: `${py}px ${px}px`,
          boxSizing: "border-box",
        }}
      >
        <Stage width={sw} height={sh}>
          <Layer>
            <Group>
              <Rect
                x={so}
                y={so}
                width={sw}
                height={sh}
                fill={PAGE_SHADOW}
                cornerRadius={2}
              />
              <Rect
                x={0}
                y={0}
                width={sw}
                height={sh}
                fill="#ffffff"
                stroke="#d0d0d0"
                strokeWidth={1}
                cornerRadius={2}
              />
              {img && image && (
                <KonvaImage
                  image={image}
                  x={img.x}
                  y={img.y}
                  width={img.w}
                  height={img.h}
                />
              )}
            </Group>
          </Layer>
        </Stage>
      </div>
      {cropMode && cropRect && cropRect.w > 2 && cropRect.h > 2 && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.3)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: cropRect.x,
              top: cropRect.y,
              width: cropRect.w,
              height: cropRect.h,
              border: "2px dashed #0066ff",
              background: "rgba(255,255,255,0.1)",
              pointerEvents: "none",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.3)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: cropRect.x + cropRect.w / 2 - 45,
              top: cropRect.y + cropRect.h + 8,
              display: "flex",
              gap: 4,
            }}
          >
            <button
              className="ps-crop-btn confirm"
              onClick={(e) => {
                e.stopPropagation();
                doCrop();
              }}
            >
              Potong
            </button>
            <button
              className="ps-crop-btn cancel"
              onClick={(e) => {
                e.stopPropagation();
                onCropCancel?.();
              }}
            >
              Batal
            </button>
          </div>
        </>
      )}
    </div>
  );
}
