import type { ScannedPage, DocumentState } from "./useFileActions";
import { applyRotation } from "./useFileActions";

interface UseDocumentActionsParams {
  activeDocIndex: number;
  activePageIndex: number;
  setDocuments: React.Dispatch<React.SetStateAction<DocumentState[]>>;
  setActivePageIndex: React.Dispatch<React.SetStateAction<number>>;
  setScanStatus: (s: string) => void;
  setCropMode: (v: boolean) => void;
}

export function useDocumentActions({
  activeDocIndex,
  activePageIndex,
  setDocuments,
  setActivePageIndex,
  setScanStatus,
  setCropMode,
}: UseDocumentActionsParams) {
  function updateActiveDoc(updater: (doc: DocumentState) => DocumentState) {
    setDocuments((docs) =>
      docs.map((doc, i) => (i === activeDocIndex ? updater(doc) : doc)),
    );
  }

  function handleNew() {
    setDocuments((current) => {
      const newDoc: DocumentState = {
        id: crypto.randomUUID(),
        title: `Dokumen ${current.length + 1}`,
        pages: [],
      };
      return [...current, newDoc];
    });
    setDocuments((current) => {
      // After adding, set active to the new one
      setActiveDocIndex(current.length - 1);
      return current;
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
        pages: doc.pages.map((p, i) =>
          i === activePageIndex ? { ...p, dataUrl: newDataUrl } : p,
        ),
      }));
      setScanStatus(`Gambar diputar ${degrees}°.`);
    });
  }

  function handleClosePage(index: number) {
    updateActiveDoc((doc) => ({
      ...doc,
      pages: doc.pages.filter((_, i) => i !== index),
    }));
    setActivePageIndex((prev) => Math.max(0, prev - 1));
  }

  function handleReorderPages(fromIndex: number, toIndex: number) {
    updateActiveDoc((doc) => {
      const pages = [...doc.pages];
      const [moved] = pages.splice(fromIndex, 1);
      pages.splice(toIndex, 0, moved);
      return { ...doc, pages };
    });
    setActivePageIndex(toIndex);
  }

  function handleCropConfirm(croppedDataUrl: string) {
    updateActiveDoc((doc) => ({
      ...doc,
      pages: doc.pages.map((p, i) =>
        i === activePageIndex ? { ...p, dataUrl: croppedDataUrl } : p,
      ),
    }));
    setCropMode(false);
    setScanStatus("Halaman dipotong.");
  }

  function handleRemoveDoc(docIndex: number) {
    setDocuments((current) => {
      const next = current.filter((_, i) => i !== docIndex);
      if (next.length === 0) {
        return [{ id: crypto.randomUUID(), title: "Dokumen Baru", pages: [] }];
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
    if (sp) {
      try {
        const savePath = await sp.saveFile(page.filename);
        if (savePath && page.dataUrl) {
          const base64 = page.dataUrl.split(",")[1];
          if (base64) await sp.saveBuffer(savePath, base64);
          setScanStatus(`Tersimpan: ${savePath}`);
        }
      } catch {
        setScanStatus("Gagal menyimpan.");
      }
    } else if (page.dataUrl) {
      const a = document.createElement("a");
      a.href = page.dataUrl;
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
        pages: doc.pages.map((item, index) =>
          index === activePageIndex ? page : item,
        ),
        title: doc.title === "Dokumen Baru" ? page.filename : doc.title,
      }));
    } else {
      updateActiveDoc((doc) => ({ ...doc, pages: [...doc.pages, page] }));
      setActivePageIndex(activeDoc.pages.length);
    }
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

  function renameActiveDoc(title: string) {
    updateActiveDoc((doc) => ({ ...doc, title }));
  }

  return {
    updateActiveDoc,
    handleNew,
    rotateImage,
    handleClosePage,
    handleReorderPages,
    handleCropConfirm,
    handleRemoveDoc,
    handleSaveSingle,
    upsertOpenedPage,
    updatePage,
    updateLastPage,
    renameActiveDoc,
  };
}
