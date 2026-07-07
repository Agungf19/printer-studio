import { api } from "../api/client";

export type CanvasObject = {
  id: string;
  /** Data URL gambar objek. */
  src: string;
  /** Titik pusat objek dalam koordinat piksel gambar dasar. */
  cx: number;
  cy: number;
  /** Ukuran objek dalam piksel gambar dasar. */
  width: number;
  height: number;
  /** Rotasi (derajat) mengelilingi titik pusat. */
  rotation: number;
};

export const BASE_IMAGE_OBJECT_ID = "__scanpilot_base_image__";

export type PageImageTransform = {
  /** Titik pusat gambar asli dalam koordinat piksel gambar dasar. */
  cx: number;
  cy: number;
  /** Ukuran gambar asli dalam koordinat piksel gambar dasar. */
  width: number;
  height: number;
  /** Rotasi (derajat) mengelilingi titik pusat. */
  rotation: number;
};

export type PageImageFit = "contain" | "cover";
export type PagePaperOrientation = "portrait" | "landscape";
export type ExportImageFormat = "png" | "jpg";

export type ScannedPage = {
  path: string;
  filename: string;
  dataUrl?: string;
  /** Ukuran kertas untuk halaman ini. */
  paperSize?: string;
  /** Orientasi kertas untuk halaman ini. */
  paperOrientation?: PagePaperOrientation;
  /** Cara gambar asli di-fit ke bidang kertas. */
  imageFit?: PageImageFit;
  /** Transformasi gambar asli halaman saat diedit di kanvas. */
  imageTransform?: PageImageTransform;
  /** Posisi gambar asli di antara objek. Default 0 = paling belakang. */
  baseImageLayerIndex?: number;
  /** Objek gambar yang ditumpuk di atas halaman (lapisan objek). */
  objects?: CanvasObject[];
};

/** A document containing multiple pages (document-centric model) */
export type DocPage = ScannedPage;
export type DocumentState = {
  id: string;
  title: string;
  pages: DocPage[];
  /** Absolute path this document was last saved to (undefined = never saved). */
  savedPath?: string;
  /** True when there are changes not yet written to savedPath. */
  dirty?: boolean;
};

const sp = typeof window !== "undefined" ? window.scanPilot : null;
const EXPORT_DPI = 300;
const MM_PER_INCH = 25.4;
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

function browserOpenFiles(): Promise<
  Array<{
    fileName: string;
    dataUrl: string;
    mime: string;
  }>
> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".png,.jpg,.jpeg,.bmp,image/png,image/jpeg,image/bmp";
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) {
        resolve([]);
        return;
      }
      const supported = files.filter((file) =>
        ["image/png", "image/jpeg", "image/bmp"].includes(file.type),
      );
      Promise.all(
        supported.map(
          (file) =>
            new Promise<{
              fileName: string;
              dataUrl: string;
              mime: string;
            } | null>((resolveFile) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolveFile({
                  fileName: file.name,
                  dataUrl: reader.result as string,
                  mime: file.type,
                });
              reader.onerror = () => resolveFile(null);
              reader.readAsDataURL(file);
            }),
        ),
      ).then((items) =>
        resolve(
          items.filter(
            (
              item,
            ): item is {
              fileName: string;
              dataUrl: string;
              mime: string;
            } => item !== null,
          ),
        ),
      );
    };
    input.click();
  });
}

function browserDownload(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function ensurePdfName(title: string): string {
  const base = title.replace(/\.(pdf|png|jpe?g|docx)$/i, "").trim();
  return `${base || "Dokumen Scan"}.pdf`;
}

function isPdfPath(filePath: string): boolean {
  return /\.pdf$/i.test(filePath.trim());
}

function ensurePdfPath(filePath: string): string {
  return isPdfPath(filePath)
    ? filePath
    : filePath.replace(/(\.[^./\\]+)?$/, ".pdf");
}

function ensurePngPath(filePath: string): string {
  return /\.png$/i.test(filePath.trim())
    ? filePath
    : filePath.replace(/(\.[^./\\]+)?$/, ".png");
}

function baseName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

function ensureImageName(title: string, format: ExportImageFormat): string {
  const ext = format === "jpg" ? "jpg" : "png";
  const base = title.replace(/\.(pdf|png|jpe?g|docx)$/i, "").trim();
  return `${base || "Gambar Scan"}.${ext}`;
}

function exportSizeSuffix(targetSizeKb?: number) {
  const kb = Math.round(targetSizeKb || 0);
  return kb > 0 ? `${kb}kb` : "export";
}

function ensureExportImageName(
  title: string,
  format: ExportImageFormat,
  targetSizeKb?: number,
): string {
  const ext = imageExtension(format);
  const suffix = exportSizeSuffix(targetSizeKb).toLowerCase();
  const base = title.replace(/\.(pdf|png|jpe?g|docx)$/i, "").trim();
  const cleanBase = base || "Gambar Scan";
  return cleanBase.toLowerCase().endsWith(`-${suffix}`)
    ? `${cleanBase}.${ext}`
    : `${cleanBase}-${suffix}.${ext}`;
}

function ensureImagePath(
  filePath: string,
  format: ExportImageFormat,
): string {
  const ext = format === "jpg" ? "jpg" : "png";
  return filePath.replace(/(\.[^./\\]+)?$/, `.${ext}`);
}

function qualityToRatio(quality: string | undefined) {
  const key = (quality || "high").toLowerCase();
  if (key === "low") return 0.58;
  if (key === "medium") return 0.76;
  return 0.92;
}

function dataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

function drawScaledCanvas(source: HTMLCanvasElement, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function encodeJpegNearTarget(
  source: HTMLCanvasElement,
  maxQuality: number,
  targetBytes: number,
) {
  let highQualityDataUrl = source.toDataURL("image/jpeg", maxQuality);
  const highQualityBytes = dataUrlBytes(highQualityDataUrl);
  if (!targetBytes || highQualityBytes <= targetBytes) {
    return {
      dataUrl: highQualityDataUrl,
      bytes: highQualityBytes,
      underTarget: true,
    };
  }

  const minQuality = 0.06;
  let low = minQuality;
  let high = maxQuality;
  let bestUnderTarget = "";
  let bestUnderTargetBytes = Number.MAX_SAFE_INTEGER;
  let smallest = source.toDataURL("image/jpeg", minQuality);
  let smallestBytes = dataUrlBytes(smallest);

  for (let i = 0; i < 12; i += 1) {
    const next = (low + high) / 2;
    const candidate = source.toDataURL("image/jpeg", next);
    const bytes = dataUrlBytes(candidate);

    if (bytes < smallestBytes) {
      smallest = candidate;
      smallestBytes = bytes;
    }

    if (bytes <= targetBytes) {
      bestUnderTarget = candidate;
      bestUnderTargetBytes = bytes;
      low = next;
    } else {
      high = next;
    }
  }

  if (bestUnderTarget) {
    return {
      dataUrl: bestUnderTarget,
      bytes: bestUnderTargetBytes,
      underTarget: true,
    };
  }

  return {
    dataUrl: smallest,
    bytes: smallestBytes,
    underTarget: false,
  };
}

function encodeCanvasImage(
  source: HTMLCanvasElement,
  format: ExportImageFormat,
  quality: string | undefined,
  targetSizeKb?: number,
) {
  const mime = format === "jpg" ? "image/jpeg" : "image/png";
  const targetBytes = targetSizeKb && targetSizeKb > 0 ? targetSizeKb * 1024 : 0;
  const maxQuality = qualityToRatio(quality);
  const dataUrl = source.toDataURL(mime, maxQuality);

  if (!targetBytes || dataUrlBytes(dataUrl) <= targetBytes) return dataUrl;

  if (format === "jpg") {
    const original = encodeJpegNearTarget(source, maxQuality, targetBytes);
    if (original.underTarget) return original.dataUrl;

    const longEdge = Math.max(source.width, source.height);
    const minScale = Math.max(0.12, Math.min(1, 1400 / longEdge));
    let lowScale = minScale;
    let highScale = 1;
    let best = original;

    for (let i = 0; i < 9; i += 1) {
      const scale = (lowScale + highScale) / 2;
      const resized = drawScaledCanvas(source, scale);
      const encoded = encodeJpegNearTarget(resized, maxQuality, targetBytes);

      if (encoded.underTarget) {
        best = encoded;
        lowScale = scale;
      } else {
        if (!best.underTarget && encoded.bytes < best.bytes) best = encoded;
        highScale = scale;
      }
    }

    if (!best.underTarget && minScale < 1) {
      const resized = drawScaledCanvas(source, minScale);
      const encoded = encodeJpegNearTarget(resized, maxQuality, targetBytes);
      if (encoded.underTarget || encoded.bytes < best.bytes) best = encoded;
    }

    return best.dataUrl;
  }

  return dataUrl;
}

function rotatedBounds(
  cx: number,
  cy: number,
  width: number,
  height: number,
  rotation: number,
) {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = width * cos + height * sin;
  const h = width * sin + height * cos;
  return {
    minX: cx - w / 2,
    minY: cy - h / 2,
    maxX: cx + w / 2,
    maxY: cy + h / 2,
  };
}

function unionBounds(bounds: ReturnType<typeof rotatedBounds>[]) {
  return bounds.reduce(
    (acc, item) => ({
      minX: Math.min(acc.minX, item.minX),
      minY: Math.min(acc.minY, item.minY),
      maxX: Math.max(acc.maxX, item.maxX),
      maxY: Math.max(acc.maxY, item.maxY),
    }),
    bounds[0],
  );
}

function clampLayerIndex(value: number | undefined, objectCount: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(0, Math.round(value)), objectCount);
}

function orderedLayerIds(page: ScannedPage, objects: CanvasObject[]) {
  const baseIndex = clampLayerIndex(page.baseImageLayerIndex, objects.length);
  const objectIds = objects.map((object) => object.id);
  return [
    ...objectIds.slice(0, baseIndex),
    BASE_IMAGE_OBJECT_ID,
    ...objectIds.slice(baseIndex),
  ];
}

function paperSizePx(page: ScannedPage) {
  const key = (page.paperSize || "A4").toLowerCase().trim();
  const dims = PAPER_MM[key] || PAPER_MM.a4;
  const landscape = page.paperOrientation === "landscape";
  const wmm = landscape ? dims[1] : dims[0];
  const hmm = landscape ? dims[0] : dims[1];
  return {
    w: Math.round((wmm / MM_PER_INCH) * EXPORT_DPI),
    h: Math.round((hmm / MM_PER_INCH) * EXPORT_DPI),
  };
}

function computeImageBox(
  image: HTMLImageElement,
  sw: number,
  sh: number,
  fitMode: PageImageFit = "contain",
) {
  const margin = Math.round((4 / MM_PER_INCH) * EXPORT_DPI);
  let x = margin;
  let y = margin;
  let w = sw - margin * 2;
  let h = sh - margin * 2;
  const a = image.naturalWidth / image.naturalHeight;
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

export function applyRotation(
  dataUrl: string,
  degrees: number,
  onDone: (result: string) => void,
) {
  const img = new window.Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rad = (degrees * Math.PI) / 180;
    const swap = degrees % 180 !== 0;
    canvas.width = swap ? img.height : img.width;
    canvas.height = swap ? img.width : img.height;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    onDone(canvas.toDataURL("image/png"));
  };
  img.src = dataUrl;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Gabungkan (flatten) gambar dasar halaman dengan seluruh objek gambar di
 * atasnya menjadi satu data URL. Dipakai sebelum menyimpan/mengekspor supaya
 * objek ikut tersimpan. Bila halaman tidak punya objek, kembalikan gambar asli.
 */
export async function flattenPage(
  page: ScannedPage,
): Promise<string | undefined> {
  const base = page.dataUrl;
  if (!base) return base;
  const objects = page.objects ?? [];
  const baseImg = await loadImage(base);
  if (!baseImg) return base;
  const pagePx = paperSizePx(page);
  const img = computeImageBox(
    baseImg,
    pagePx.w,
    pagePx.h,
    page.imageFit ?? "contain",
  );
  const k = img.w / baseImg.naturalWidth;
  const canvas = document.createElement("canvas");
  canvas.width = pagePx.w;
  canvas.height = pagePx.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return base;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const baseTransform = page.imageTransform ?? {
    cx: baseImg.naturalWidth / 2,
    cy: baseImg.naturalHeight / 2,
    width: baseImg.naturalWidth,
    height: baseImg.naturalHeight,
    rotation: 0,
  };
  const objectMap = new Map(objects.map((object) => [object.id, object]));
  const objectImageMap = new Map<string, HTMLImageElement>();

  const drawBaseImage = () => {
    ctx.save();
    ctx.translate(img.x + baseTransform.cx * k, img.y + baseTransform.cy * k);
    ctx.rotate((baseTransform.rotation * Math.PI) / 180);
    ctx.drawImage(
      baseImg,
      -(baseTransform.width * k) / 2,
      -(baseTransform.height * k) / 2,
      baseTransform.width * k,
      baseTransform.height * k,
    );
    ctx.restore();
  };

  const drawObject = async (obj: CanvasObject) => {
    let oi = objectImageMap.get(obj.id);
    if (!oi) {
      oi = (await loadImage(obj.src)) ?? undefined;
      if (oi) objectImageMap.set(obj.id, oi);
    }
    if (!oi) return;
    ctx.save();
    ctx.translate(img.x + obj.cx * k, img.y + obj.cy * k);
    ctx.rotate((obj.rotation * Math.PI) / 180);
    ctx.drawImage(
      oi,
      -(obj.width * k) / 2,
      -(obj.height * k) / 2,
      obj.width * k,
      obj.height * k,
    );
    ctx.restore();
  };

  for (const layerId of orderedLayerIds(page, objects)) {
    if (layerId === BASE_IMAGE_OBJECT_ID) {
      drawBaseImage();
      continue;
    }
    const obj = objectMap.get(layerId);
    if (obj) await drawObject(obj);
  }
  return canvas.toDataURL("image/jpeg", 0.92);
}

export async function renderImageContent(
  page: ScannedPage,
  options?: {
    format?: ExportImageFormat;
    quality?: string;
    targetSizeKb?: number;
  },
): Promise<string | undefined> {
  const base = page.dataUrl;
  if (!base) return undefined;
  const baseImg = await loadImage(base);
  if (!baseImg) return base;

  const format = options?.format ?? "png";
  const objects = page.objects ?? [];
  const baseTransform = page.imageTransform ?? {
    cx: baseImg.naturalWidth / 2,
    cy: baseImg.naturalHeight / 2,
    width: baseImg.naturalWidth,
    height: baseImg.naturalHeight,
    rotation: 0,
  };

  const bounds = [
    rotatedBounds(
      baseTransform.cx,
      baseTransform.cy,
      baseTransform.width,
      baseTransform.height,
      baseTransform.rotation,
    ),
    ...objects.map((obj) =>
      rotatedBounds(obj.cx, obj.cy, obj.width, obj.height, obj.rotation),
    ),
  ];
  const content = unionBounds(bounds);
  const minX = Math.floor(content.minX);
  const minY = Math.floor(content.minY);
  const width = Math.max(1, Math.ceil(content.maxX - minX));
  const height = Math.max(1, Math.ceil(content.maxY - minY));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return base;

  if (format === "jpg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  const objectMap = new Map(objects.map((object) => [object.id, object]));
  const objectImageMap = new Map<string, HTMLImageElement>();

  const drawBaseImage = () => {
    ctx.save();
    ctx.translate(baseTransform.cx - minX, baseTransform.cy - minY);
    ctx.rotate((baseTransform.rotation * Math.PI) / 180);
    ctx.drawImage(
      baseImg,
      -baseTransform.width / 2,
      -baseTransform.height / 2,
      baseTransform.width,
      baseTransform.height,
    );
    ctx.restore();
  };

  const drawObject = async (obj: CanvasObject) => {
    let objImg = objectImageMap.get(obj.id);
    if (!objImg) {
      objImg = (await loadImage(obj.src)) ?? undefined;
      if (objImg) objectImageMap.set(obj.id, objImg);
    }
    if (!objImg) return;
    ctx.save();
    ctx.translate(obj.cx - minX, obj.cy - minY);
    ctx.rotate((obj.rotation * Math.PI) / 180);
    ctx.drawImage(
      objImg,
      -obj.width / 2,
      -obj.height / 2,
      obj.width,
      obj.height,
    );
    ctx.restore();
  };

  for (const layerId of orderedLayerIds(page, objects)) {
    if (layerId === BASE_IMAGE_OBJECT_ID) {
      drawBaseImage();
      continue;
    }
    const obj = objectMap.get(layerId);
    if (obj) await drawObject(obj);
  }

  return encodeCanvasImage(
    canvas,
    format,
    options?.quality,
    options?.targetSizeKb,
  );
}

export type ExportProgressInfo = {
  phase: "encoding" | "saving" | "complete";
  completed: number;
  total: number;
  currentIndex: number;
  currentFileName: string;
  progress: number;
};

export type ExportImageResult = {
  exported: number;
  canceled?: boolean;
  message: string;
};

function imageExtension(format: ExportImageFormat) {
  return format === "jpg" ? "jpg" : "png";
}

function splitFilePath(filePath: string) {
  const match = /^(.*[\\/])?([^\\/]+)$/.exec(filePath);
  return {
    dir: match?.[1] ?? "",
    fileName: match?.[2] ?? filePath,
  };
}

function ensureExportImagePath(
  filePath: string,
  format: ExportImageFormat,
  targetSizeKb?: number,
) {
  const normalized = ensureImagePath(filePath, format);
  const { dir, fileName } = splitFilePath(normalized);
  const ext = imageExtension(format);
  const suffix = exportSizeSuffix(targetSizeKb).toLowerCase();
  const base = fileName.replace(/\.[^./\\]+$/, "").trim() || "Gambar Scan";
  return base.toLowerCase().endsWith(`-${suffix}`)
    ? `${dir}${base}.${ext}`
    : `${dir}${base}-${suffix}.${ext}`;
}

function avoidDuplicatePath(filePath: string, used: Set<string>) {
  const { dir, fileName } = splitFilePath(filePath);
  const ext = fileName.match(/(\.[^./\\]+)$/)?.[1] ?? "";
  const base = ext ? fileName.slice(0, -ext.length) : fileName;
  let candidate = filePath;
  let index = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${dir}${base}-${index}${ext}`;
    index += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function exportImagePathForPage(
  chosenPath: string,
  page: ScannedPage,
  format: ExportImageFormat,
  index: number,
  total: number,
  targetSizeKb?: number,
  used?: Set<string>,
) {
  const target =
    total <= 1
      ? ensureExportImagePath(chosenPath, format, targetSizeKb)
      : `${splitFilePath(chosenPath).dir}${ensureExportImageName(
          page.filename || `Gambar Scan ${index + 1}`,
          format,
          targetSizeKb,
        )}`;
  return used ? avoidDuplicatePath(target, used) : target;
}

function exportImageNameForPage(
  chosenName: string,
  page: ScannedPage,
  format: ExportImageFormat,
  index: number,
  total: number,
  targetSizeKb?: number,
  used?: Set<string>,
) {
  const target =
    total <= 1
      ? ensureExportImagePath(chosenName, format, targetSizeKb)
      : ensureExportImageName(
          page.filename || `Gambar Scan ${index + 1}`,
          format,
          targetSizeKb,
        );
  return splitFilePath(used ? avoidDuplicatePath(target, used) : target)
    .fileName;
}

function waitForPaint() {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined" || !window.requestAnimationFrame) {
      resolve();
      return;
    }
    window.requestAnimationFrame(() => window.setTimeout(resolve, 0));
  });
}

function mergeOutputName(title: string, format: "pdf" | "png") {
  const ext = format === "pdf" ? "pdf" : "png";
  const base = title.replace(/\.(pdf|png|jpe?g|docx)$/i, "").trim();
  return `${base || "Dokumen Scan"}-gabung.${ext}`;
}

export type MergeProgressInfo = {
  phase: "rendering" | "saving" | "complete";
  completed: number;
  total: number;
  progress: number;
};

export type MergeResult = {
  merged: number;
  canceled?: boolean;
  message: string;
};

async function flattenPagesForMerge(
  pages: ScannedPage[],
  onProgress?: (info: MergeProgressInfo) => void,
) {
  const flattened: string[] = [];
  for (let i = 0; i < pages.length; i += 1) {
    onProgress?.({
      phase: "rendering",
      completed: i,
      total: pages.length,
      progress: (i / pages.length) * 80,
    });
    await waitForPaint();
    const flat = (await flattenPage(pages[i])) || pages[i].dataUrl;
    if (flat) flattened.push(flat);
  }
  return flattened;
}

async function mergePngDataUrl(pageDataUrls: string[]) {
  const images = (
    await Promise.all(pageDataUrls.map((dataUrl) => loadImage(dataUrl)))
  ).filter((img): img is HTMLImageElement => img !== null);
  if (images.length === 0) return undefined;

  const maxWidth = Math.max(...images.map((img) => img.naturalWidth));
  const sizes = images.map((img) => {
    const scale = maxWidth / img.naturalWidth;
    return {
      width: maxWidth,
      height: Math.max(1, Math.round(img.naturalHeight * scale)),
    };
  });
  const totalHeight = sizes.reduce((sum, size) => sum + size.height, 0);
  const canvas = document.createElement("canvas");
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = 0;
  images.forEach((img, index) => {
    const size = sizes[index];
    ctx.drawImage(img, 0, y, size.width, size.height);
    y += size.height;
  });
  return canvas.toDataURL("image/png");
}

export async function mergePagesToFile(
  pages: ScannedPage[],
  title: string,
  format: "pdf" | "png",
  setStatus: (s: string) => void,
  options?: {
    onProgress?: (info: MergeProgressInfo) => void;
  },
): Promise<MergeResult> {
  const validPages = pages.filter((page) => page.dataUrl);
  if (validPages.length < 2) {
    const message = "Perlu minimal 2 halaman untuk digabung.";
    setStatus(message);
    return { merged: 0, message };
  }

  const defaultName = mergeOutputName(title, format);
  const chosen = sp ? await sp.saveFile(defaultName) : defaultName;
  if (!chosen) {
    return { merged: 0, canceled: true, message: "Gabung dibatalkan." };
  }

  const flattened = await flattenPagesForMerge(validPages, options?.onProgress);
  if (flattened.length < 2) {
    const message = "Tidak ada halaman valid untuk digabung.";
    setStatus(message);
    return { merged: 0, message };
  }

  options?.onProgress?.({
    phase: "saving",
    completed: flattened.length,
    total: validPages.length,
    progress: 88,
  });
  await waitForPaint();

  let base64 = "";
  let targetName = chosen;
  if (format === "pdf") {
    const pageBase64 = flattened.flatMap((dataUrl) => {
      const data = dataUrl.split(",")[1]?.trim() || "";
      return data ? [data] : [];
    });
    const res = await api.savePdf(pageBase64);
    base64 = res.pdfBase64;
    targetName = ensurePdfPath(chosen);
  } else {
    const dataUrl = await mergePngDataUrl(flattened);
    base64 = dataUrl?.split(",")[1] || "";
    targetName = ensurePngPath(chosen);
  }

  if (!base64) {
    const message = "Gagal menyiapkan hasil gabung.";
    setStatus(message);
    return { merged: 0, message };
  }

  if (sp) {
    await sp.saveBuffer(targetName, base64);
  } else {
    browserDownload(
      `data:${format === "pdf" ? "application/pdf" : "image/png"};base64,${base64}`,
      targetName,
    );
  }

  options?.onProgress?.({
    phase: "complete",
    completed: flattened.length,
    total: validPages.length,
    progress: 100,
  });
  const message = `Gabung ${format.toUpperCase()} selesai: ${baseName(targetName)}`;
  setStatus(message);
  return { merged: flattened.length, message };
}

export async function exportImagePages(
  pages: ScannedPage[],
  setStatus: (s: string) => void,
  options?: {
    format?: ExportImageFormat;
    quality?: string;
    targetSizeKb?: number;
    onProgress?: (info: ExportProgressInfo) => void;
  },
): Promise<ExportImageResult> {
  const validPages = pages.filter((page) => page.dataUrl);
  if (validPages.length === 0) {
    const message = "Tidak ada gambar untuk diekspor.";
    setStatus(message);
    return { exported: 0, message };
  }

  const format = options?.format ?? "png";
  const targetSizeKb = options?.targetSizeKb;
  const firstFileName = ensureExportImageName(
    validPages[0].filename || "Gambar Scan",
    format,
    targetSizeKb,
  );
  const chosen = sp ? await sp.saveFile(firstFileName) : firstFileName;
  if (!chosen) {
    return { exported: 0, canceled: true, message: "Ekspor dibatalkan." };
  }

  let exported = 0;
  let lastTargetName = "";
  const usedTargets = new Set<string>();
  for (let i = 0; i < validPages.length; i += 1) {
    const page = validPages[i];
    const targetName = sp
      ? exportImagePathForPage(
          chosen,
          page,
          format,
          i,
          validPages.length,
          targetSizeKb,
          usedTargets,
        )
      : exportImageNameForPage(
          firstFileName,
          page,
          format,
          i,
          validPages.length,
          targetSizeKb,
          usedTargets,
        );
    const currentIndex = i + 1;

    options?.onProgress?.({
      phase: "encoding",
      completed: exported,
      total: validPages.length,
      currentIndex,
      currentFileName: baseName(targetName),
      progress: (exported / validPages.length) * 100,
    });
    setStatus(
      `Mengekspor ${currentIndex}/${validPages.length}: ${baseName(targetName)}`,
    );
    await waitForPaint();

    const dataUrl = await renderImageContent(page, options);
    if (!dataUrl) continue;
    const base64 = dataUrl.split(",")[1] || "";
    if (!base64) continue;

    options?.onProgress?.({
      phase: "saving",
      completed: exported,
      total: validPages.length,
      currentIndex,
      currentFileName: baseName(targetName),
      progress: (exported / validPages.length) * 100,
    });
    setStatus(
      `Menyimpan ${currentIndex}/${validPages.length}: ${baseName(targetName)}`,
    );
    await waitForPaint();

    if (sp) {
      await sp.saveBuffer(targetName, base64);
    } else {
      browserDownload(dataUrl, targetName);
    }
    exported += 1;
    lastTargetName = targetName;
    options?.onProgress?.({
      phase: "complete",
      completed: exported,
      total: validPages.length,
      currentIndex,
      currentFileName: baseName(targetName),
      progress: (exported / validPages.length) * 100,
    });
  }

  const message =
    exported === 1
      ? `Ekspor selesai: ${baseName(lastTargetName || chosen)}`
      : `Ekspor selesai: ${exported} halaman`;
  setStatus(message);
  return { exported, message };
}

export async function exportImageFile(
  page: ScannedPage | undefined,
  setStatus: (s: string) => void,
  closeBackstage: () => void,
  options?: {
    format?: ExportImageFormat;
    quality?: string;
    targetSizeKb?: number;
  },
) {
  if (!page?.dataUrl) {
    setStatus("Tidak ada gambar untuk diekspor.");
    closeBackstage();
    return;
  }

  try {
    const result = await exportImagePages([page], setStatus, options);
    if (result.canceled) return;
  } catch {
    setStatus("Gagal mengekspor gambar.");
  }
  closeBackstage();
}

export async function openFile(
  upsertPages: (pages: ScannedPage[]) => void,
  setTitle: (t: string) => void,
  setStatus: (s: string) => void,
  closeBackstage: () => void,
) {
  if (sp) {
    const paths = await sp.openFile();
    if (paths && paths.length > 0) {
      const pages: ScannedPage[] = [];
      for (let i = 0; i < paths.length; i += 1) {
        const filePath = paths[i];
        const fileName = filePath.split(/[\\/]/).pop() || "Dokumen.pdf";
        try {
          setStatus(`Membuka ${i + 1}/${paths.length}: ${fileName}`);
          const { dataUrl } = await sp.readFileAsDataUrl(filePath);
          pages.push({
            path: filePath,
            filename: fileName,
            dataUrl,
            imageFit: "contain",
          });
        } catch {
          setStatus(`Gagal membuka: ${fileName}`);
        }
      }
      if (pages.length > 0) {
        upsertPages(pages);
        setTitle(pages[0].filename);
        setStatus(
          pages.length === 1
            ? `Dibuka: ${pages[0].filename}`
            : `Dibuka: ${pages.length} file`,
        );
      }
      closeBackstage();
    }
  } else {
    const results = await browserOpenFiles();
    if (results.length > 0) {
      const pages: ScannedPage[] = results.map((result) => ({
        path: "",
        filename: result.fileName,
        dataUrl: result.dataUrl,
        imageFit: "contain",
      }));
      upsertPages(pages);
      setTitle(results[0].fileName);
      setStatus(
        results.length === 1
          ? `Dibuka: ${results[0].fileName} (${results[0].mime})`
          : `Dibuka: ${results.length} file`,
      );
      closeBackstage();
    }
  }
}

/**
 * Simpan seluruh halaman dokumen aktif menjadi SATU berkas PDF.
 *
 * Mode ephemeral: gambar hanya ada di memori, jadi PDF dibuat di backend
 * (POST /save/pdf) lalu ditulis ke lokasi pilihan pengguna. Bila dokumen
 * belum pernah disimpan (atau forceDialog=true) dialog "Simpan Sebagai"
 * ditampilkan; jika sudah, langsung menimpa berkas sebelumnya.
 */
export async function saveDocument(
  activeDoc: DocumentState | undefined,
  setStatus: (s: string) => void,
  closeBackstage: () => void,
  markSaved: (savedPath: string, title?: string) => void,
  opts?: { forceDialog?: boolean },
) {
  if (!activeDoc || activeDoc.pages.length === 0) {
    setStatus("Tidak ada dokumen untuk disimpan.");
    closeBackstage();
    return;
  }
  const pages = activeDoc.pages.filter((p) => p.dataUrl);
  if (pages.length === 0) {
    setStatus("Tidak ada halaman untuk disimpan.");
    closeBackstage();
    return;
  }
  const flattened = await Promise.all(pages.map((p) => flattenPage(p)));
  const pageBase64 = flattened.flatMap((d) => {
    const data = d ? d.split(",")[1]?.trim() || "" : "";
    return data ? [data] : [];
  });
  if (pageBase64.length === 0) {
    setStatus("Tidak ada halaman valid untuk disimpan.");
    closeBackstage();
    return;
  }

  let pdfBase64: string;
  try {
    const res = await api.savePdf(pageBase64);
    pdfBase64 = res.pdfBase64;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Gagal membuat PDF.");
    closeBackstage();
    return;
  }

  if (sp) {
    let targetPath =
      !opts?.forceDialog && activeDoc.savedPath && isPdfPath(activeDoc.savedPath)
        ? activeDoc.savedPath
        : "";
    if (!targetPath) {
      const chosen = await sp.saveFile(ensurePdfName(activeDoc.title));
      if (!chosen) return; // dibatalkan — biarkan tetap "belum disimpan"
      targetPath = ensurePdfPath(chosen);
    }
    try {
      await sp.saveBuffer(targetPath, pdfBase64);
      markSaved(targetPath, baseName(targetPath).replace(/\.pdf$/i, ""));
      setStatus(`Disimpan (${pages.length} halaman): ${targetPath}`);
    } catch {
      setStatus("Gagal menyimpan file.");
    }
  } else {
    browserDownload(
      `data:application/pdf;base64,${pdfBase64}`,
      ensurePdfName(activeDoc.title),
    );
    markSaved("", activeDoc.title);
    setStatus(`Diunduh: ${ensurePdfName(activeDoc.title)}`);
  }
  closeBackstage();
}

export async function exportFile(
  latestPage: ScannedPage | undefined,
  setStatus: (s: string) => void,
  closeBackstage: () => void,
) {
  if (!latestPage?.dataUrl) {
    setStatus("Tidak ada dokumen untuk diekspor.");
    closeBackstage();
    return;
  }
  const flat = (await flattenPage(latestPage)) || latestPage.dataUrl;
  const base64 = flat.split(",")[1] || "";
  if (sp) {
    const result = await sp.exportFile();
    if (!result) return;
    try {
      await sp.saveBuffer(result.filePath, base64);
      setStatus(`Diekspor: ${result.filePath}`);
    } catch {
      setStatus("Gagal mengekspor file.");
    }
  } else {
    browserDownload(flat, "Dokumen Scan");
    setStatus(`Diunduh: Dokumen Scan`);
  }
  closeBackstage();
}

export async function printFile(
  setStatus: (s: string) => void,
  closeBackstage: () => void,
) {
  if (sp) {
    const ok = await sp.print();
    setStatus(ok ? "Cetak dikirim." : "Cetak dibatalkan.");
  } else {
    window.print();
    setStatus("Cetak dikirim.");
  }
  closeBackstage();
}
