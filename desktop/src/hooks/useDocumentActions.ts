import type {
  CropConfirmPayload,
  DocumentState,
  PagePaperOrientation,
  ScannedPage,
} from "./useFileActions";
import {
  BASE_IMAGE_OBJECT_ID,
  applyRotation,
  flattenPage,
} from "./useFileActions";
import { DEFAULT_DOC_TITLE } from "./useAppState";
import type { ScanSettings } from "./useAppState";

interface UseDocumentActionsParams {
  activeDocIndex: number;
  activePageIndex: number;
  setDocuments: React.Dispatch<React.SetStateAction<DocumentState[]>>;
  setActiveDocIndex: React.Dispatch<React.SetStateAction<number>>;
  setActivePageIndex: React.Dispatch<React.SetStateAction<number>>;
  setScanStatus: (s: string) => void;
  setCropMode: (v: boolean) => void;
  recordHistory?: () => void;
}

export function useDocumentActions({
  activeDocIndex,
  activePageIndex,
  setDocuments,
  setActiveDocIndex,
  setActivePageIndex,
  setScanStatus,
  setCropMode,
  recordHistory,
}: UseDocumentActionsParams) {
  type HistoryOptions = { history?: boolean };

  function maybeRecordHistory(options?: HistoryOptions) {
    if (options?.history === false) return;
    recordHistory?.();
  }

  function updateActiveDoc(
    updater: (doc: DocumentState) => DocumentState,
    options?: HistoryOptions,
  ) {
    maybeRecordHistory(options);
    setDocuments((docs) =>
      docs.map((doc, i) => (i === activeDocIndex ? updater(doc) : doc)),
    );
  }

  function handleNew() {
    maybeRecordHistory();
    setDocuments((current) => {
      // Indeks dokumen baru = panjang array sebelum append.
      setActiveDocIndex(current.length);
      return [
        ...current,
        {
          id: crypto.randomUUID(),
          title: `Dokumen ${current.length + 1}`,
          pages: [],
        },
      ];
    });
    setActivePageIndex(0);
    setScanStatus("Dokumen baru dibuat.");
  }

  function rotateImage(degrees: number, latestPage?: ScannedPage) {
    if (!latestPage?.dataUrl) {
      setScanStatus("Tidak ada gambar untuk diputar.");
      return;
    }
    applyRotation(latestPage.dataUrl, degrees, (newDataUrl) => {
      updateActiveDoc((doc) => ({
        ...doc,
        dirty: true,
        pages: doc.pages.map((p, i) =>
          i === activePageIndex
            ? { ...p, dataUrl: newDataUrl, imageTransform: undefined }
            : p,
        ),
      }));
      setScanStatus(`Gambar diputar ${degrees}\u00b0.`);
    });
  }

  function normalizePaperOrientation(
    orientation: ScanSettings["orientation"] | PagePaperOrientation | undefined,
  ): PagePaperOrientation {
    return orientation === "landscape" ? "landscape" : "portrait";
  }

  function rotateCanvas(
    direction: "left" | "right",
    fallbackPaperSize: string,
    fallbackOrientation: ScanSettings["orientation"],
  ) {
    updateActiveDoc((doc) => {
      const page = doc.pages[activePageIndex];
      if (!page) return doc;
      const current = normalizePaperOrientation(
        page.paperOrientation ?? fallbackOrientation,
      );
      const next: PagePaperOrientation =
        current === "landscape" ? "portrait" : "landscape";
      return {
        ...doc,
        dirty: true,
        pages: doc.pages.map((p, i) =>
          i === activePageIndex
            ? {
                ...p,
                paperSize: p.paperSize ?? fallbackPaperSize,
                paperOrientation: next,
              }
            : p,
        ),
      };
    });
    setScanStatus(
      direction === "left"
        ? "Kertas diputar ke kiri."
        : "Kertas diputar ke kanan.",
    );
  }

  function handleClosePage(index: number) {
    updateActiveDoc((doc) => ({
      ...doc,
      dirty: true,
      pages: doc.pages.filter((_, i) => i !== index),
    }));
    // Hanya geser indeks aktif bila halaman yang ditutup berada di posisi
    // aktif atau sebelumnya; jaga agar tidak negatif.
    setActivePageIndex((prev) =>
      index <= prev ? Math.max(0, prev - 1) : prev,
    );
  }

  function handleReorderPages(fromIndex: number, toIndex: number) {
    updateActiveDoc((doc) => {
      const pages = [...doc.pages];
      const [moved] = pages.splice(fromIndex, 1);
      pages.splice(toIndex, 0, moved);
      return { ...doc, dirty: true, pages };
    });
    setActivePageIndex(toIndex);
  }

  function handleCropConfirm(payload: CropConfirmPayload) {
    updateActiveDoc((doc) => ({
      ...doc,
      dirty: true,
      pages: doc.pages.map((p, i) =>
        i !== activePageIndex
          ? p
          : payload.targetId === BASE_IMAGE_OBJECT_ID
            ? {
                ...p,
                dataUrl: payload.croppedDataUrl,
                imageTransform: payload.imageTransform,
              }
            : {
                ...p,
                objects: (p.objects ?? []).map((object) =>
                  object.id === payload.targetId
                    ? {
                        ...object,
                        src: payload.croppedDataUrl,
                        ...(payload.objectTransform ?? {}),
                      }
                    : object,
                ),
              },
      ),
    }));
    setCropMode(false);
    setScanStatus(
      payload.targetId === BASE_IMAGE_OBJECT_ID
        ? "Gambar dipangkas."
        : "Objek dipangkas.",
    );
  }

  function handleRemoveDoc(docIndex: number) {
    maybeRecordHistory();
    setDocuments((current) => {
      const next = current.filter((_, i) => i !== docIndex);
      if (next.length === 0) {
        return [
          { id: crypto.randomUUID(), title: DEFAULT_DOC_TITLE, pages: [] },
        ];
      }
      return next;
    });
    setActiveDocIndex((prev) => Math.max(0, prev - 1));
    setActivePageIndex(0);
  }

  async function handleSaveSingle(
    index: number,
    activeDoc?: DocumentState,
    sp?: typeof window.scanPilot | null,
  ) {
    if (!activeDoc) return;
    const page = activeDoc.pages[index];
    if (!page) return;
    const flat = (await flattenPage(page)) || page.dataUrl;
    if (sp) {
      try {
        const savePath = await sp.saveFile(page.filename);
        if (savePath && flat) {
          const base64 = flat.split(",")[1];
          if (base64) await sp.saveBuffer(savePath, base64);
          setScanStatus(`Tersimpan: ${savePath}`);
        }
      } catch {
        setScanStatus("Gagal menyimpan.");
      }
    } else if (flat) {
      const a = document.createElement("a");
      a.href = flat;
      a.download = page.filename;
      a.click();
      setScanStatus(`Download: ${page.filename}`);
    }
  }

  function upsertOpenedPage(page: ScannedPage, activeDoc?: DocumentState) {
    if (!activeDoc) return;
    const hasEmpty =
      activeDoc.pages.length > 0 &&
      !activeDoc.pages[activePageIndex]?.dataUrl &&
      !activeDoc.pages[activePageIndex]?.path;
    if (hasEmpty) {
      updateActiveDoc((doc) => ({
        ...doc,
        dirty: true,
        pages: doc.pages.map((item, index) =>
          index === activePageIndex ? page : item,
        ),
        title: doc.title === DEFAULT_DOC_TITLE ? page.filename : doc.title,
      }));
    } else {
      updateActiveDoc((doc) => ({
        ...doc,
        dirty: true,
        pages: [...doc.pages, page],
      }));
      setActivePageIndex(activeDoc.pages.length);
    }
  }

  function upsertOpenedPages(pages: ScannedPage[], activeDoc?: DocumentState) {
    if (!activeDoc || pages.length === 0) return;
    const hasEmpty =
      activeDoc.pages.length > 0 &&
      !activeDoc.pages[activePageIndex]?.dataUrl &&
      !activeDoc.pages[activePageIndex]?.path;
    const startIndex = hasEmpty ? activePageIndex : activeDoc.pages.length;

    updateActiveDoc((doc) => {
      const nextPages = hasEmpty
        ? [
            ...doc.pages.slice(0, activePageIndex),
            ...pages,
            ...doc.pages.slice(activePageIndex + 1),
          ]
        : [...doc.pages, ...pages];

      return {
        ...doc,
        dirty: true,
        pages: nextPages,
        title: doc.title === DEFAULT_DOC_TITLE ? pages[0].filename : doc.title,
      };
    });
    setActivePageIndex(startIndex);
  }

  function updatePage(index: number, updates: Partial<ScannedPage>) {
    updateActiveDoc((doc) => ({
      ...doc,
      pages: doc.pages.map((p, i) => (i === index ? { ...p, ...updates } : p)),
    }));
  }

  function updateLastPage(updates: Partial<ScannedPage>) {
    updateActiveDoc((doc) => ({
      ...doc,
      pages: doc.pages.map((p, i) =>
        i === doc.pages.length - 1 ? { ...p, ...updates } : p,
      ),
    }));
  }

  function renameActiveDoc(title: string, options?: HistoryOptions) {
    updateActiveDoc((doc) => ({ ...doc, title }), options);
  }

  /** Tandai dokumen aktif sebagai tersimpan (hapus penanda perubahan). */
  function markDocSaved(savedPath: string, title?: string) {
    updateActiveDoc((doc) => ({
      ...doc,
      dirty: false,
      savedPath: savedPath || doc.savedPath,
      title: title ?? doc.title,
    }), { history: false });
  }

  /** Ganti gambar halaman aktif (mis. hasil deskew) dan tandai perubahan. */
  function applyImageToActivePage(dataUrl: string) {
    updateActiveDoc((doc) => ({
      ...doc,
      dirty: true,
      pages: doc.pages.map((p, i) =>
        i === activePageIndex
          ? { ...p, dataUrl, imageTransform: undefined }
          : p,
      ),
    }));
  }

  return {
    updateActiveDoc,
    applyImageToActivePage,
    handleNew,
    rotateImage,
    rotateCanvas,
    handleClosePage,
    handleReorderPages,
    handleCropConfirm,
    handleRemoveDoc,
    handleSaveSingle,
    upsertOpenedPage,
    upsertOpenedPages,
    updatePage,
    updateLastPage,
    renameActiveDoc,
    markDocSaved,
  };
}
