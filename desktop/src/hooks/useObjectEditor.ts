import { useCallback, useEffect, useState } from "react";
import type {
  CanvasObject,
  DocumentState,
  PageImageTransform,
  ScannedPage,
} from "./useFileActions";
import { BASE_IMAGE_OBJECT_ID } from "./useFileActions";

interface Params {
  activePageIndex: number;
  activePage?: ScannedPage;
  updateActiveDoc: (updater: (doc: DocumentState) => DocumentState) => void;
  setScanStatus: (s: string) => void;
}

/** Geseran posisi (px gambar dasar) tiap kali menempel/menduplikat objek. */
const OFFSET = 24;

function uid(): string {
  return crypto.randomUUID();
}

function clampLayerIndex(value: number | undefined, objectCount: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(0, Math.round(value)), objectCount);
}

function normalizeRotation(rotation: number) {
  return ((rotation % 360) + 360) % 360;
}

function layerIdsFor(objects: CanvasObject[], baseImageLayerIndex?: number) {
  const baseIndex = clampLayerIndex(baseImageLayerIndex, objects.length);
  const objectIds = objects.map((object) => object.id);
  return [
    ...objectIds.slice(0, baseIndex),
    BASE_IMAGE_OBJECT_ID,
    ...objectIds.slice(baseIndex),
  ];
}

function layerStateFromIds(
  layerIds: string[],
  objectMap: Map<string, CanvasObject>,
) {
  const basePosition = Math.max(0, layerIds.indexOf(BASE_IMAGE_OBJECT_ID));
  const baseImageLayerIndex = layerIds
    .slice(0, basePosition)
    .filter((id) => id !== BASE_IMAGE_OBJECT_ID).length;
  return {
    objects: layerIds
      .filter((id) => id !== BASE_IMAGE_OBJECT_ID)
      .map((id) => objectMap.get(id))
      .filter((object): object is CanvasObject => !!object),
    baseImageLayerIndex,
  };
}

function loadImageSize(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Mengelola lapisan objek gambar pada halaman aktif: seleksi, pindah, ubah
 * ukuran/putar (di-commit dari kanvas), salin/potong/tempel/duplikat/hapus,
 * serta urutan lapisan (z-order).
 */
export function useObjectEditor({
  activePageIndex,
  activePage,
  updateActiveDoc,
  setScanStatus,
}: Params) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<CanvasObject[]>([]);

  // Kosongkan seleksi saat berpindah halaman.
  useEffect(() => {
    setSelectedIds([]);
  }, [activePageIndex]);

  const setPageObjects = useCallback(
    (updater: (objs: CanvasObject[]) => CanvasObject[]) => {
      updateActiveDoc((doc) => ({
        ...doc,
        dirty: true,
        pages: doc.pages.map((p, i) =>
          i === activePageIndex
            ? { ...p, objects: updater(p.objects ?? []) }
            : p,
        ),
      }));
    },
    [updateActiveDoc, activePageIndex],
  );

  const clearSelection = useCallback(() => setSelectedIds([]), []);
  const clearClipboard = useCallback(() => setClipboard([]), []);

  const addObjects = useCallback(
    (objs: CanvasObject[]) => {
      setPageObjects((cur) => [...cur, ...objs]);
      setSelectedIds(objs.map((o) => o.id));
    },
    [setPageObjects],
  );

  /** Terapkan perubahan geometri (dari drag/transform di kanvas) per id. */
  const commitObjects = useCallback(
    (changed: CanvasObject[]) => {
      if (changed.length === 0) return;
      const map = new Map(changed.map((o) => [o.id, o]));
      setPageObjects((cur) => cur.map((o) => map.get(o.id) ?? o));
    },
    [setPageObjects],
  );

  const removeSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const ids = new Set(selectedIds);
    updateActiveDoc((doc) => ({
      ...doc,
      dirty: true,
      pages: doc.pages.map((p, i) => {
        if (i !== activePageIndex) return p;
        const objects = p.objects ?? [];
        const objectMap = new Map(objects.map((object) => [object.id, object]));
        const nextLayerIds = layerIdsFor(
          objects,
          p.baseImageLayerIndex,
        ).filter(
          (id) => id === BASE_IMAGE_OBJECT_ID || !ids.has(id),
        );
        return {
          ...p,
          ...layerStateFromIds(nextLayerIds, objectMap),
        };
      }),
    }));
    setSelectedIds([]);
    setScanStatus(
      ids.has(BASE_IMAGE_OBJECT_ID) && ids.size === 1
        ? "Gambar asli tidak dihapus."
        : "Objek dihapus.",
    );
  }, [selectedIds, updateActiveDoc, activePageIndex, setScanStatus]);

  const getSelected = useCallback(() => {
    const objs = activePage?.objects ?? [];
    const ids = new Set(selectedIds);
    return objs.filter((o) => ids.has(o.id));
  }, [activePage, selectedIds]);

  const getSelectedBaseAsObject = useCallback((): CanvasObject | null => {
    if (!selectedIds.includes(BASE_IMAGE_OBJECT_ID)) return null;
    if (!activePage?.dataUrl || !activePage.imageTransform) return null;
    return {
      id: BASE_IMAGE_OBJECT_ID,
      src: activePage.dataUrl,
      ...activePage.imageTransform,
    };
  }, [activePage, selectedIds]);

  const copySelected = useCallback(() => {
    const sel = [...getSelected()];
    const baseObj = getSelectedBaseAsObject();
    if (baseObj) sel.unshift(baseObj);
    if (sel.length === 0) return false;
    setClipboard(sel.map((o) => ({ ...o })));
    setScanStatus(`${sel.length} objek disalin.`);
    return true;
  }, [getSelected, getSelectedBaseAsObject, setScanStatus]);

  const paste = useCallback(() => {
    if (clipboard.length === 0) return false;
    const clones = clipboard.map((o) => ({
      ...o,
      id: uid(),
      cx: o.cx + OFFSET,
      cy: o.cy + OFFSET,
    }));
    addObjects(clones);
    setScanStatus(`${clones.length} objek ditempel.`);
    return true;
  }, [clipboard, addObjects, setScanStatus]);

  const cutSelected = useCallback(() => {
    const ok = copySelected();
    if (ok) removeSelected();
    return ok;
  }, [copySelected, removeSelected]);

  const duplicateSelected = useCallback(() => {
    const sel = [...getSelected()];
    const baseObj = getSelectedBaseAsObject();
    if (baseObj) sel.unshift(baseObj);
    if (sel.length === 0) return;
    const clones = sel.map((o) => ({
      ...o,
      id: uid(),
      cx: o.cx + OFFSET,
      cy: o.cy + OFFSET,
    }));
    addObjects(clones);
    setScanStatus(`${clones.length} objek diduplikat.`);
  }, [getSelected, getSelectedBaseAsObject, addObjects, setScanStatus]);

  /** Simpan geometri gambar asli halaman setelah drag/resize/rotate. */
  const commitBaseImageTransform = useCallback(
    (imageTransform: PageImageTransform) => {
      updateActiveDoc((doc) => ({
        ...doc,
        dirty: true,
        pages: doc.pages.map((p, i) =>
          i === activePageIndex ? { ...p, imageTransform } : p,
        ),
      }));
    },
    [updateActiveDoc, activePageIndex],
  );

  /**
   * Tambahkan gambar (data URL) sebagai objek baru di tengah halaman aktif,
   * diperkecil agar tidak melebihi ~60% lebar gambar dasar.
   */
  const pasteImageDataUrl = useCallback(
    async (dataUrl: string) => {
      const baseSrc = activePage?.dataUrl;
      const [baseSize, objSize] = await Promise.all([
        baseSrc ? loadImageSize(baseSrc) : Promise.resolve(null),
        loadImageSize(dataUrl),
      ]);
      if (!objSize) {
        setScanStatus("Gambar tidak valid.");
        return;
      }
      const baseW = baseSize?.w ?? objSize.w;
      const baseH = baseSize?.h ?? objSize.h;
      const maxW = baseW * 0.6;
      let w = objSize.w;
      let h = objSize.h;
      if (w > maxW) {
        const r = maxW / w;
        w = maxW;
        h = h * r;
      }
      const obj: CanvasObject = {
        id: uid(),
        src: dataUrl,
        cx: baseW / 2,
        cy: baseH / 2,
        width: w,
        height: h,
        rotation: 0,
      };
      addObjects([obj]);
      setScanStatus("Gambar ditempel sebagai objek.");
    },
    [activePage, addObjects, setScanStatus],
  );

  const rotateSelected = useCallback(
    async (degrees: number) => {
      if (selectedIds.length === 0) {
        setScanStatus("Pilih gambar atau objek dulu.");
        return;
      }

      const ids = new Set(selectedIds);
      let defaultBaseTransform: PageImageTransform | null = null;
      if (ids.has(BASE_IMAGE_OBJECT_ID) && activePage?.dataUrl) {
        const size = await loadImageSize(activePage.dataUrl);
        if (size) {
          defaultBaseTransform = {
            cx: size.w / 2,
            cy: size.h / 2,
            width: size.w,
            height: size.h,
            rotation: 0,
          };
        }
      }

      updateActiveDoc((doc) => {
        const page = doc.pages[activePageIndex];
        if (!page) return doc;
        const selectedObjectCount = (page.objects ?? []).filter((object) =>
          ids.has(object.id),
        ).length;
        const hasSelectedBase =
          ids.has(BASE_IMAGE_OBJECT_ID) &&
          !!(page.imageTransform ?? defaultBaseTransform);

        if (!hasSelectedBase && selectedObjectCount === 0) return doc;

        return {
          ...doc,
          dirty: true,
          pages: doc.pages.map((p, i) => {
            if (i !== activePageIndex) return p;
            const baseTransform = p.imageTransform ?? defaultBaseTransform;
            return {
              ...p,
              imageTransform:
                ids.has(BASE_IMAGE_OBJECT_ID) && baseTransform
                  ? {
                      ...baseTransform,
                      rotation: normalizeRotation(
                        baseTransform.rotation + degrees,
                      ),
                    }
                  : p.imageTransform,
              objects: (p.objects ?? []).map((object) =>
                ids.has(object.id)
                  ? {
                      ...object,
                      rotation: normalizeRotation(object.rotation + degrees),
                    }
                  : object,
              ),
            };
          }),
        };
      });
      setScanStatus(`Pilihan diputar ${degrees}°.`);
    },
    [
      activePage,
      activePageIndex,
      selectedIds,
      updateActiveDoc,
      setScanStatus,
    ],
  );

  /** Ubah urutan lapisan objek terpilih. */
  const reorder = useCallback(
    (mode: "front" | "back" | "forward" | "backward") => {
      if (selectedIds.length === 0) return;
      const ids = new Set(selectedIds);
      updateActiveDoc((doc) => ({
        ...doc,
        dirty: true,
        pages: doc.pages.map((p, i) => {
          if (i !== activePageIndex) return p;
          const objects = p.objects ?? [];
          const objectMap = new Map(objects.map((object) => [object.id, object]));
          const arr = layerIdsFor(objects, p.baseImageLayerIndex);
          const before = arr.join("|");

          if (mode === "front") {
            const sel = arr.filter((id) => ids.has(id));
            const rest = arr.filter((id) => !ids.has(id));
            arr.splice(0, arr.length, ...rest, ...sel);
          } else if (mode === "back") {
            const sel = arr.filter((id) => ids.has(id));
            const rest = arr.filter((id) => !ids.has(id));
            arr.splice(0, arr.length, ...sel, ...rest);
          } else if (mode === "forward") {
            for (let index = arr.length - 2; index >= 0; index -= 1) {
              if (ids.has(arr[index]) && !ids.has(arr[index + 1])) {
                const tmp = arr[index];
                arr[index] = arr[index + 1];
                arr[index + 1] = tmp;
              }
            }
          } else {
            for (let index = 1; index < arr.length; index += 1) {
              if (ids.has(arr[index]) && !ids.has(arr[index - 1])) {
                const tmp = arr[index];
                arr[index] = arr[index - 1];
                arr[index - 1] = tmp;
              }
            }
          }

          if (arr.join("|") === before) return p;
          return {
            ...p,
            ...layerStateFromIds(arr, objectMap),
          };
        }),
      }));
      setScanStatus(
        mode === "forward" || mode === "front"
          ? "Lapisan dimajukan."
          : "Lapisan dimundurkan.",
      );
    },
    [selectedIds, updateActiveDoc, activePageIndex, setScanStatus],
  );

  return {
    selectedIds,
    setSelectedIds,
    clearSelection,
    clipboard,
    clearClipboard,
    hasSelection: selectedIds.length > 0,
    addObjects,
    commitObjects,
    commitBaseImageTransform,
    removeSelected,
    copySelected,
    cutSelected,
    paste,
    duplicateSelected,
    rotateSelected,
    pasteImageDataUrl,
    bringToFront: () => reorder("front"),
    sendToBack: () => reorder("back"),
    bringForward: () => reorder("forward"),
    sendBackward: () => reorder("backward"),
  };
}
