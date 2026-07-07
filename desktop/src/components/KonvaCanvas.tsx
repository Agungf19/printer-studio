import { useEffect, useRef, useState, useCallback } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import {
  Stage,
  Layer,
  Rect,
  Image as KonvaImage,
  Group,
  Transformer,
} from "react-konva";
import type Konva from "konva";
import type {
  CanvasObject,
  CropConfirmPayload,
  PageImageFit,
  PageImageTransform,
  ScannedPage,
} from "../hooks/useFileActions";
import { BASE_IMAGE_OBJECT_ID } from "../hooks/useFileActions";

interface KonvaCanvasProps {
  pages: ScannedPage[];
  activePageIndex: number;
  onActivePageChange?: (index: number) => void;
  zoom?: number;
  paperSize?: string;
  orientation?: "auto" | "portrait" | "landscape";
  onZoomChange?: (zoom: number) => void;
  cropMode?: boolean;
  onCropConfirm?: (payload: CropConfirmPayload) => void;
  onCropCancel?: () => void;
  panMode?: boolean;
  fitNonce?: number;
  fitMode?: "width" | "page";
  selectedIds?: string[];
  onSelectIds?: (ids: string[]) => void;
  onCommitObjects?: (objs: CanvasObject[]) => void;
  onCommitBaseImageTransform?: (transform: PageImageTransform) => void;
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
const ZOOM_MIN = 10;
const ZOOM_MAX = 500;

function usePageImage(dataUrl?: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!dataUrl) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = dataUrl;
  }, [dataUrl]);
  return image;
}

/** Muat elemen gambar untuk tiap objek (dipetakan berdasarkan id). */
function useObjectImages(objects: CanvasObject[]) {
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  const key = objects.map((o) => o.id + ":" + o.src.length).join("|");
  useEffect(() => {
    let cancelled = false;
    const jobs = objects.map(
      (o) =>
        new Promise<[string, HTMLImageElement] | null>((resolve) => {
          const img = new window.Image();
          img.onload = () => resolve([o.id, img]);
          img.onerror = () => resolve(null);
          img.src = o.src;
        }),
    );
    void Promise.all(jobs).then((res) => {
      if (cancelled) return;
      const map: Record<string, HTMLImageElement> = {};
      for (const e of res) if (e) map[e[0]] = e[1];
      setImages(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return images;
}

function computePageLayout(
  vp: { w: number; h: number },
  zoom: number,
  paperSize: string,
  orientation: "auto" | "portrait" | "landscape",
) {
  const key = paperSize.toLowerCase().trim();
  const dims = PAPER_MM[key] || PAPER_MM.a4;
  const pwmm = dims[0];
  const hmm = dims[1];
  let land: boolean;
  if (orientation === "landscape") land = true;
  else land = false;
  const pageWmm = land ? hmm : pwmm;
  const pageHmm = land ? pwmm : hmm;
  const refPW = PAPER_MM.a4[0] * 2.5;
  const refPH = PAPER_MM.a4[1] * 2.5;
  const fit = Math.min((vp.w - PAD * 2) / refPW, (vp.h - PAD * 2) / refPH, 1);
  const scale = fit * (zoom / 100);
  const mm = 2.5 * scale;
  const sw = Math.ceil(pageWmm * mm);
  const sh = Math.ceil(pageHmm * mm);
  const margin = 10 * scale;
  return { sw, sh, margin, scale };
}

function computeImageBoxFromSize(
  imageWidth: number,
  imageHeight: number,
  sw: number,
  sh: number,
  margin: number,
  fitMode: PageImageFit,
) {
  let x = margin;
  let y = margin;
  let w = sw - margin * 2;
  let h = sh - margin * 2;
  const a = imageWidth / imageHeight;
  const ba = w / h;
  if (fitMode === "cover") {
    if (a > ba) {
      const fw = h * a;
      x -= (fw - w) / 2;
      w = fw;
    } else {
      const fh = w / a;
      y -= (fh - h) / 2;
      h = fh;
    }
  } else if (a > ba) {
    const fh = w / a;
    y += (h - fh) / 2;
    h = fh;
  } else {
    const fw = h * a;
    x += (w - fw) / 2;
    w = fw;
  }
  return { x, y, w, h };
}

function computeImageBox(
  image: HTMLImageElement | null,
  sw: number,
  sh: number,
  margin: number,
  fitMode: PageImageFit,
) {
  if (!image) return null;
  return computeImageBoxFromSize(
    image.naturalWidth,
    image.naturalHeight,
    sw,
    sh,
    margin,
    fitMode,
  );
}

function clampLayerIndex(value: number | undefined, objectCount: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(0, Math.round(value)), objectCount);
}

function orderedLayerIds(objects: CanvasObject[], baseImageLayerIndex?: number) {
  const baseIndex = clampLayerIndex(baseImageLayerIndex, objects.length);
  const objectIds = objects.map((object) => object.id);
  return [
    ...objectIds.slice(0, baseIndex),
    BASE_IMAGE_OBJECT_ID,
    ...objectIds.slice(baseIndex),
  ];
}

interface CanvasPageProps {
  dataUrl?: string;
  zoom: number;
  paperSize: string;
  orientation: "auto" | "portrait" | "landscape";
  vp: { w: number; h: number };
  cropMode: boolean;
  onCropConfirm?: (payload: CropConfirmPayload) => void;
  onCropCancel?: () => void;
  imageFit?: PageImageFit;
  imageTransform?: PageImageTransform;
  baseImageLayerIndex?: number;
  objects?: CanvasObject[];
  interactive?: boolean;
  selectedIds?: string[];
  onSelectIds?: (ids: string[]) => void;
  onCommitObjects?: (objs: CanvasObject[]) => void;
  onCommitBaseImageTransform?: (transform: PageImageTransform) => void;
}

function CanvasPage({
  dataUrl,
  zoom,
  paperSize,
  orientation,
  vp,
  cropMode,
  onCropConfirm,
  onCropCancel,
  imageFit = "contain",
  imageTransform,
  baseImageLayerIndex,
  objects = [],
  interactive = false,
  selectedIds = [],
  onSelectIds,
  onCommitObjects,
  onCommitBaseImageTransform,
}: CanvasPageProps) {
  const image = usePageImage(dataUrl);
  const objImages = useObjectImages(objects);
  const cropRectRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const objTrRef = useRef<Konva.Transformer>(null);
  const baseImageRef = useRef<Konva.Image>(null);
  const objRefs = useRef<Record<string, Konva.Image>>({});
  const selStart = useRef<{ x: number; y: number } | null>(null);
  const [selRect, setSelRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [crop, setCrop] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const layout = computePageLayout(vp, zoom, paperSize, orientation);
  const sw = layout.sw;
  const sh = layout.sh;
  const margin = layout.margin;
  const img = computeImageBox(image, sw, sh, margin, imageFit);
  const so = Math.max(2, 4 * (zoom / 100));
  const k = img && image ? img.w / image.naturalWidth : 1;

  const baseTransform =
    image && img
      ? (imageTransform ?? {
          cx: image.naturalWidth / 2,
          cy: image.naturalHeight / 2,
          width: image.naturalWidth,
          height: image.naturalHeight,
          rotation: 0,
        })
      : null;
  const baseDisp =
    img && baseTransform
      ? {
          cx: img.x + baseTransform.cx * k,
          cy: img.y + baseTransform.cy * k,
          w: baseTransform.width * k,
          h: baseTransform.height * k,
          rotation: baseTransform.rotation,
        }
      : null;
  function toDisp(o: CanvasObject) {
    return {
      cx: (img?.x ?? 0) + o.cx * k,
      cy: (img?.y ?? 0) + o.cy * k,
      w: o.width * k,
      h: o.height * k,
    };
  }

  const baseCropBox = baseDisp
    ? {
        x: baseDisp.cx - baseDisp.w / 2,
        y: baseDisp.cy - baseDisp.h / 2,
        w: baseDisp.w,
        h: baseDisp.h,
      }
    : img
      ? {
          x: img.x,
          y: img.y,
          w: img.w,
          h: img.h,
      }
    : null;
  const cropTargetId = selectedIds.length === 1 ? selectedIds[0] : null;
  const cropObject =
    cropTargetId && cropTargetId !== BASE_IMAGE_OBJECT_ID
      ? objects.find((object) => object.id === cropTargetId)
      : undefined;
  const cropObjectImage = cropObject ? objImages[cropObject.id] : undefined;
  const cropObjectBox =
    cropObject && cropObjectImage
      ? (() => {
          const d = toDisp(cropObject);
          return {
            x: d.cx - d.w / 2,
            y: d.cy - d.h / 2,
            w: d.w,
            h: d.h,
          };
        })()
      : null;
  const cropSourceBox =
    cropTargetId === BASE_IMAGE_OBJECT_ID ? baseCropBox : cropObjectBox;
  const cropSourceImage =
    cropTargetId === BASE_IMAGE_OBJECT_ID ? image : cropObjectImage;

  useEffect(() => {
    if (
      cropMode &&
      cropSourceBox &&
      cropSourceBox.w > 0 &&
      cropSourceBox.h > 0
    ) {
      setCrop({ ...cropSourceBox });
    } else if (!cropMode) {
      setCrop(null);
    }
  }, [
    cropMode,
    cropSourceBox?.x,
    cropSourceBox?.y,
    cropSourceBox?.w,
    cropSourceBox?.h,
  ]);

  useEffect(() => {
    if (cropMode && trRef.current && cropRectRef.current) {
      trRef.current.nodes([cropRectRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [cropMode, crop]);

  // Pasang transformer objek ke node yang terpilih.
  useEffect(() => {
    if (!interactive || !objTrRef.current) return;
    const nodes = selectedIds
      .map((id) =>
        id === BASE_IMAGE_OBJECT_ID
          ? baseImageRef.current
          : objRefs.current[id],
      )
      .filter((n): n is Konva.Image => !!n);
    objTrRef.current.nodes(nodes);
    objTrRef.current.getLayer()?.batchDraw();
  }, [
    interactive,
    selectedIds,
    objects,
    objImages,
    imageTransform,
    baseImageLayerIndex,
    image,
  ]);

  function commitCropNode() {
    const node = cropRectRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    let nx = node.x();
    let ny = node.y();
    let nw = Math.max(10, node.width() * scaleX);
    let nh = Math.max(10, node.height() * scaleY);
    if (cropSourceBox) {
      nx = Math.max(
        cropSourceBox.x,
        Math.min(nx, cropSourceBox.x + cropSourceBox.w - 10),
      );
      ny = Math.max(
        cropSourceBox.y,
        Math.min(ny, cropSourceBox.y + cropSourceBox.h - 10),
      );
      nw = Math.min(nw, cropSourceBox.x + cropSourceBox.w - nx);
      nh = Math.min(nh, cropSourceBox.y + cropSourceBox.h - ny);
    }
    node.x(nx);
    node.y(ny);
    node.width(nw);
    node.height(nh);
    setCrop({ x: nx, y: ny, w: nw, h: nh });
  }

  function doCrop() {
    if (
      !cropTargetId ||
      !cropSourceImage ||
      !crop ||
      !cropSourceBox ||
      crop.w < 10 ||
      crop.h < 10
    ) {
      return;
    }
    const rx = (crop.x - cropSourceBox.x) / cropSourceBox.w;
    const ry = (crop.y - cropSourceBox.y) / cropSourceBox.h;
    const rw2 = crop.w / cropSourceBox.w;
    const rh2 = crop.h / cropSourceBox.h;
    const sx = Math.max(0, Math.min(1, rx));
    const sy = Math.max(0, Math.min(1, ry));
    const ssw = Math.max(0, Math.min(1 - sx, rw2));
    const ssh = Math.max(0, Math.min(1 - sy, rh2));
    if (ssw < 0.01 || ssh < 0.01) return;
    const c = document.createElement("canvas");
    c.width = Math.round(ssw * cropSourceImage.naturalWidth);
    c.height = Math.round(ssh * cropSourceImage.naturalHeight);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      cropSourceImage,
      sx * cropSourceImage.naturalWidth,
      sy * cropSourceImage.naturalHeight,
      c.width,
      c.height,
      0,
      0,
      c.width,
      c.height,
    );
    const croppedDataUrl =
      cropTargetId === BASE_IMAGE_OBJECT_ID
        ? c.toDataURL("image/jpeg", 0.92)
        : c.toDataURL("image/png");

    if (cropTargetId !== BASE_IMAGE_OBJECT_ID) {
      if (!img || !cropObject) return;
      onCropConfirm?.({
        targetId: cropTargetId,
        croppedDataUrl,
        objectTransform: {
          cx: (crop.x + crop.w / 2 - img.x) / k,
          cy: (crop.y + crop.h / 2 - img.y) / k,
          width: crop.w / k,
          height: crop.h / k,
          rotation: cropObject.rotation,
        },
      });
      return;
    }

    const nextBox = computeImageBoxFromSize(
      c.width,
      c.height,
      sw,
      sh,
      margin,
      imageFit,
    );
    const nextK = nextBox.w / c.width;
    onCropConfirm?.({
      targetId: cropTargetId,
      croppedDataUrl,
      imageTransform: {
        cx: (crop.x + crop.w / 2 - nextBox.x) / nextK,
        cy: (crop.y + crop.h / 2 - nextBox.y) / nextK,
        width: crop.w / nextK,
        height: crop.h / nextK,
        rotation: baseTransform?.rotation ?? 0,
      },
    });
  }

  function onBaseMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    e.cancelBubble = true;
    const evt = e.evt;
    const additive = evt.shiftKey || evt.ctrlKey || evt.metaKey;
    if (additive) {
      onSelectIds?.(
        selectedIds.includes(BASE_IMAGE_OBJECT_ID)
          ? selectedIds.filter((x) => x !== BASE_IMAGE_OBJECT_ID)
          : [...selectedIds, BASE_IMAGE_OBJECT_ID],
      );
    } else if (!selectedIds.includes(BASE_IMAGE_OBJECT_ID)) {
      onSelectIds?.([BASE_IMAGE_OBJECT_ID]);
    }
  }

  function onBaseChange(e: Konva.KonvaEventObject<Event>) {
    if (!img) return;
    const node = e.target as Konva.Image;
    const newW = Math.max(5, node.width() * node.scaleX());
    const newH = Math.max(5, node.height() * node.scaleY());
    node.scaleX(1);
    node.scaleY(1);
    node.width(newW);
    node.height(newH);
    node.offsetX(newW / 2);
    node.offsetY(newH / 2);
    onCommitBaseImageTransform?.({
      cx: (node.x() - img.x) / k,
      cy: (node.y() - img.y) / k,
      width: newW / k,
      height: newH / k,
      rotation: node.rotation(),
    });
  }

  function onObjMouseDown(e: Konva.KonvaEventObject<MouseEvent>, id: string) {
    e.cancelBubble = true;
    const evt = e.evt;
    const additive = evt.shiftKey || evt.ctrlKey || evt.metaKey;
    if (additive) {
      onSelectIds?.(
        selectedIds.includes(id)
          ? selectedIds.filter((x) => x !== id)
          : [...selectedIds, id],
      );
    } else if (!selectedIds.includes(id)) {
      onSelectIds?.([id]);
    }
  }

  function onObjChange(e: Konva.KonvaEventObject<Event>, o: CanvasObject) {
    if (!img) return;
    const node = e.target as Konva.Image;
    const newW = Math.max(5, node.width() * node.scaleX());
    const newH = Math.max(5, node.height() * node.scaleY());
    node.scaleX(1);
    node.scaleY(1);
    node.width(newW);
    node.height(newH);
    node.offsetX(newW / 2);
    node.offsetY(newH / 2);
    onCommitObjects?.([
      {
        ...o,
        cx: (node.x() - img.x) / k,
        cy: (node.y() - img.y) / k,
        width: newW / k,
        height: newH / k,
        rotation: node.rotation(),
      },
    ]);
  }

  function onStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!interactive) return;
    const stage = e.target.getStage();
    if (!stage || e.target !== stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    selStart.current = { x: pos.x, y: pos.y };
    setSelRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
    const evt = e.evt;
    if (!(evt.shiftKey || evt.ctrlKey || evt.metaKey)) onSelectIds?.([]);
  }

  function onStageMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!interactive || !selStart.current) return;
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    const x = Math.min(pos.x, selStart.current.x);
    const y = Math.min(pos.y, selStart.current.y);
    setSelRect({
      x,
      y,
      w: Math.abs(pos.x - selStart.current.x),
      h: Math.abs(pos.y - selStart.current.y),
    });
  }

  function onStageMouseUp() {
    if (!interactive) {
      selStart.current = null;
      return;
    }
    if (selStart.current && selRect && (selRect.w > 3 || selRect.h > 3)) {
      const hits: string[] = [];
      if (baseDisp) {
        const bx = baseDisp.cx - baseDisp.w / 2;
        const by = baseDisp.cy - baseDisp.h / 2;
        if (
          !(
            bx > selRect.x + selRect.w ||
            bx + baseDisp.w < selRect.x ||
            by > selRect.y + selRect.h ||
            by + baseDisp.h < selRect.y
          )
        ) {
          hits.push(BASE_IMAGE_OBJECT_ID);
        }
      }
      hits.push(
        ...objects
          .filter((o) => {
            const d = toDisp(o);
            const bx = d.cx - d.w / 2;
            const by = d.cy - d.h / 2;
            return !(
              bx > selRect.x + selRect.w ||
              bx + d.w < selRect.x ||
              by > selRect.y + selRect.h ||
              by + d.h < selRect.y
            );
          })
          .map((o) => o.id),
      );
      onSelectIds?.(hits);
    }
    selStart.current = null;
    setSelRect(null);
  }

  const pageStyle: CSSProperties = {
    position: "relative",
    width: sw,
    height: sh,
  };
  const cropActionsStyle: CSSProperties | undefined = crop
    ? {
        position: "absolute",
        left: Math.max(0, crop.x),
        top: crop.y + crop.h + 6,
        display: "flex",
        gap: 6,
        zIndex: 5,
      }
    : undefined;

  return (
    <div className="ps-konva-page" style={pageStyle}>
      <Stage
        width={sw}
        height={sh}
        onMouseDown={interactive ? onStageMouseDown : undefined}
        onMouseMove={interactive ? onStageMouseMove : undefined}
        onMouseUp={interactive ? onStageMouseUp : undefined}
      >
        <Layer>
          <Group>
            <Rect
              x={so}
              y={so}
              width={sw}
              height={sh}
              fill={PAGE_SHADOW}
              cornerRadius={2}
              listening={false}
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
              listening={false}
            />
          </Group>

          {img &&
            orderedLayerIds(objects, baseImageLayerIndex).map((layerId) => {
              if (layerId === BASE_IMAGE_OBJECT_ID) {
                if (!baseDisp || !image) return null;
                return (
                  <KonvaImage
                    key={BASE_IMAGE_OBJECT_ID}
                    image={image}
                    x={baseDisp.cx}
                    y={baseDisp.cy}
                    width={baseDisp.w}
                    height={baseDisp.h}
                    offsetX={baseDisp.w / 2}
                    offsetY={baseDisp.h / 2}
                    rotation={baseDisp.rotation}
                    draggable={interactive}
                    listening={interactive}
                    ref={baseImageRef}
                    onMouseDown={interactive ? onBaseMouseDown : undefined}
                    onDragEnd={interactive ? onBaseChange : undefined}
                    onTransformEnd={interactive ? onBaseChange : undefined}
                  />
                );
              }
              const o = objects.find((object) => object.id === layerId);
              const oimg = o ? objImages[o.id] : undefined;
              if (!o || !oimg) return null;
              const d = toDisp(o);
              return (
                <KonvaImage
                  key={o.id}
                  image={oimg}
                  x={d.cx}
                  y={d.cy}
                  width={d.w}
                  height={d.h}
                  offsetX={d.w / 2}
                  offsetY={d.h / 2}
                  rotation={o.rotation}
                  draggable={interactive}
                  listening={interactive}
                  ref={(node: Konva.Image | null) => {
                    if (node) objRefs.current[o.id] = node;
                    else delete objRefs.current[o.id];
                  }}
                  onMouseDown={
                    interactive ? (e) => onObjMouseDown(e, o.id) : undefined
                  }
                  onDragEnd={interactive ? (e) => onObjChange(e, o) : undefined}
                  onTransformEnd={
                    interactive ? (e) => onObjChange(e, o) : undefined
                  }
                />
              );
            })}

          {cropMode && crop && (
            <Group>
              <Rect
                x={0}
                y={0}
                width={sw}
                height={crop.y}
                fill="rgba(0,0,0,0.45)"
                listening={false}
              />
              <Rect
                x={0}
                y={crop.y + crop.h}
                width={sw}
                height={Math.max(0, sh - crop.y - crop.h)}
                fill="rgba(0,0,0,0.45)"
                listening={false}
              />
              <Rect
                x={0}
                y={crop.y}
                width={crop.x}
                height={crop.h}
                fill="rgba(0,0,0,0.45)"
                listening={false}
              />
              <Rect
                x={crop.x + crop.w}
                y={crop.y}
                width={Math.max(0, sw - crop.x - crop.w)}
                height={crop.h}
                fill="rgba(0,0,0,0.45)"
                listening={false}
              />
              <Rect
                ref={cropRectRef}
                x={crop.x}
                y={crop.y}
                width={crop.w}
                height={crop.h}
                fill="rgba(255,255,255,0.01)"
                stroke="#2563eb"
                strokeWidth={2}
                dash={[6, 4]}
                draggable
                onDragMove={commitCropNode}
                onDragEnd={commitCropNode}
                onTransform={commitCropNode}
                onTransformEnd={commitCropNode}
              />
              <Transformer
                ref={trRef}
                rotateEnabled={false}
                keepRatio={false}
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width < 10 || newBox.height < 10 ? oldBox : newBox
                }
              />
            </Group>
          )}

          {interactive && (
            <>
              <Transformer
                ref={objTrRef}
                rotateEnabled
                keepRatio
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width < 10 || newBox.height < 10 ? oldBox : newBox
                }
              />
              {selRect && (
                <Rect
                  x={selRect.x}
                  y={selRect.y}
                  width={selRect.w}
                  height={selRect.h}
                  fill="rgba(37,99,235,0.12)"
                  stroke="#2563eb"
                  strokeWidth={1}
                  listening={false}
                />
              )}
            </>
          )}
        </Layer>
      </Stage>
      {cropMode && crop && (
        <div className="ps-crop-actions" style={cropActionsStyle}>
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
      )}
    </div>
  );
}

export default function KonvaCanvas({
  pages = [],
  activePageIndex,
  onActivePageChange,
  zoom = 100,
  paperSize = "A4",
  orientation = "auto",
  onZoomChange,
  cropMode = false,
  onCropConfirm,
  onCropCancel,
  panMode = false,
  fitNonce = 0,
  fitMode = "page",
  selectedIds = [],
  onSelectIds,
  onCommitObjects,
  onCommitBaseImageTransform,
}: KonvaCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const suppressSync = useRef(false);
  const [vp, setVp] = useState({ w: 800, h: 600 });
  const activePage = pages[activePageIndex];
  const activePaperSize = activePage?.paperSize ?? paperSize;
  const activeOrientation = activePage?.paperOrientation ?? orientation;
  const panState = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      if (rect.width > 0 && rect.height > 0)
        setVp({ w: rect.width, h: rect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onZoomChange) return;
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const oldZ = zoom;
      const newZ = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, zoom + (e.deltaY > 0 ? -10 : 10)),
      );
      if (newZ === oldZ) return;
      const ratio = newZ / oldZ;
      const top = el.getBoundingClientRect().top;
      const anchor = el.scrollTop + (e.clientY - top);
      onZoomChange(newZ);
      requestAnimationFrame(() => {
        el.scrollTop = anchor * ratio - (e.clientY - top);
      });
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [zoom, onZoomChange]);

  useEffect(() => {
    if (!fitNonce || !onZoomChange) return;
    const base = computePageLayout(
      vp,
      100,
      activePaperSize,
      activeOrientation,
    );
    const availW = vp.w - PAD * 2;
    const availH = vp.h - PAD * 2;
    if (base.sw <= 0 || base.sh <= 0) return;
    let z =
      fitMode === "width"
        ? (availW / base.sw) * 100
        : Math.min(availW / base.sw, availH / base.sh) * 100;
    z = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)));
    onZoomChange(z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce]);

  const handleScroll = useCallback(() => {
    if (suppressSync.current || cropMode || !onActivePageChange) return;
    const cont = scrollRef.current;
    if (!cont) return;
    const centerY = cont.scrollTop + cont.clientHeight / 2;
    let best = 0;
    let bestDist = Infinity;
    pageRefs.current.forEach((el, i) => {
      if (!el) return;
      const mid = el.offsetTop + el.offsetHeight / 2;
      const d = Math.abs(mid - centerY);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best !== activePageIndex) onActivePageChange(best);
  }, [cropMode, onActivePageChange, activePageIndex]);

  useEffect(() => {
    if (cropMode) return;
    const el = pageRefs.current[activePageIndex];
    const cont = scrollRef.current;
    if (!el || !cont) return;
    const mid = el.offsetTop + el.offsetHeight / 2;
    const target = mid - cont.clientHeight / 2;
    if (Math.abs(cont.scrollTop - target) < 8) return;
    suppressSync.current = true;
    cont.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    const t = setTimeout(() => {
      suppressSync.current = false;
    }, 450);
    return () => clearTimeout(t);
  }, [activePageIndex, cropMode, vp, zoom]);

  const onPanDown = (e: ReactMouseEvent) => {
    if (!panMode || cropMode) return;
    const el = scrollRef.current;
    if (!el) return;
    panState.current = {
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
    };
  };
  const onPanMove = (e: ReactMouseEvent) => {
    if (!panState.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = panState.current.left - (e.clientX - panState.current.x);
    el.scrollTop = panState.current.top - (e.clientY - panState.current.y);
  };
  const onPanUp = () => {
    panState.current = null;
  };

  const hasPages = pages.length > 0;
  const scrollCls =
    panMode && !cropMode ? "ps-konva-scroll pan" : "ps-konva-scroll";

  return (
    <div
      ref={scrollRef}
      className={scrollCls}
      onScroll={handleScroll}
      onMouseDown={onPanDown}
      onMouseMove={onPanMove}
      onMouseUp={onPanUp}
      onMouseLeave={onPanUp}
    >
      {!hasPages ? (
        <div className="ps-konva-pages ps-konva-pages-empty">
          <CanvasPage
            zoom={zoom}
            paperSize={paperSize}
            orientation={orientation}
            vp={vp}
            cropMode={false}
          />
        </div>
      ) : cropMode ? (
        <div className="ps-konva-pages">
          <CanvasPage
            dataUrl={pages[activePageIndex]?.dataUrl}
            zoom={zoom}
            paperSize={activePaperSize}
            orientation={activeOrientation}
            vp={vp}
            cropMode
            onCropConfirm={onCropConfirm}
            onCropCancel={onCropCancel}
            imageFit={pages[activePageIndex]?.imageFit}
            imageTransform={pages[activePageIndex]?.imageTransform}
            baseImageLayerIndex={pages[activePageIndex]?.baseImageLayerIndex}
            objects={pages[activePageIndex]?.objects ?? []}
            selectedIds={selectedIds}
          />
        </div>
      ) : (
        <div className="ps-konva-pages">
          {pages.map((p, i) => {
            const cls =
              i === activePageIndex
                ? "ps-konva-page-wrap active"
                : "ps-konva-page-wrap";
            const isActive = i === activePageIndex;
            return (
              <div
                key={"kpage-" + i}
                ref={(el) => {
                  pageRefs.current[i] = el;
                }}
                className={cls}
              >
                <CanvasPage
                  dataUrl={p.dataUrl}
                  zoom={zoom}
                  paperSize={p.paperSize ?? paperSize}
                  orientation={p.paperOrientation ?? orientation}
                  vp={vp}
                  cropMode={false}
                  imageFit={p.imageFit}
                  imageTransform={p.imageTransform}
                  baseImageLayerIndex={p.baseImageLayerIndex}
                  objects={p.objects ?? []}
                  interactive={isActive && !panMode}
                  selectedIds={isActive ? selectedIds : []}
                  onSelectIds={onSelectIds}
                  onCommitObjects={onCommitObjects}
                  onCommitBaseImageTransform={onCommitBaseImageTransform}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
