export type ScannedPage = { path: string; filename: string; dataUrl?: string };

/** A document containing multiple pages (document-centric model) */
export type DocPage = ScannedPage;
export type DocumentState = {
  id: string;
  title: string;
  pages: DocPage[];
};

const sp = typeof window !== "undefined" ? window.scanPilot : null;

function browserOpenFile(): Promise<{
  fileName: string;
  dataUrl: string;
  mime: string;
} | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".png,.jpg,.jpeg,.bmp,image/png,image/jpeg,image/bmp";
    input.multiple = false;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const isSupportedImage = [
        "image/png",
        "image/jpeg",
        "image/bmp",
      ].includes(file.type);
      if (!isSupportedImage) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          fileName: file.name,
          dataUrl: reader.result as string,
          mime: file.type,
        });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
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

export async function openFile(
  upsertPage: (page: ScannedPage) => void,
  setTitle: (t: string) => void,
  setStatus: (s: string) => void,
  closeBackstage: () => void,
) {
  if (sp) {
    const paths = await sp.openFile();
    if (paths && paths.length > 0) {
      const filePath = paths[0];
      const fileName = filePath.split(/[\\/]/).pop() || "Dokumen.pdf";
      try {
        const { dataUrl, mime } = await sp.readFileAsDataUrl(filePath);
        upsertPage({ path: filePath, filename: fileName, dataUrl });
        setTitle(fileName);
        setStatus(`Dibuka: ${fileName} (${mime})`);
      } catch {
        setStatus(`Gagal membuka: ${fileName}`);
      }
      closeBackstage();
    }
  } else {
    const result = await browserOpenFile();
    if (result) {
      upsertPage({
        path: "",
        filename: result.fileName,
        dataUrl: result.dataUrl,
      });
      setTitle(result.fileName);
      setStatus(`Dibuka: ${result.fileName} (${result.mime})`);
      closeBackstage();
    }
  }
}

export async function saveFile(
  latestPage: ScannedPage | undefined,
  activePageIndex: number,
  documentTitle: string,
  setStatus: (s: string) => void,
  closeBackstage: () => void,
  updatePage: (index: number, updates: Partial<ScannedPage>) => void,
  setTitle: (t: string) => void,
) {
  const dataUrl = latestPage?.dataUrl;
  if (!dataUrl) {
    setStatus("Tidak ada dokumen untuk disimpan.");
    closeBackstage();
    return;
  }
  const base64 = dataUrl.split(",")[1] || "";
  if (sp) {
    let filePath = latestPage?.path || "";
    if (!filePath) {
      const chosen = await sp.saveFile(documentTitle);
      if (!chosen) return;
      filePath = chosen;
    }
    try {
      await sp.saveBuffer(filePath, base64);
      updatePage(activePageIndex, { path: filePath, dataUrl });
      setTitle(filePath.split(/[\\/]/).pop() || documentTitle);
      setStatus(`Disimpan: ${filePath}`);
    } catch {
      setStatus("Gagal menyimpan file.");
    }
  } else {
    browserDownload(dataUrl, documentTitle);
    setStatus(`Diunduh: ${documentTitle}`);
  }
  closeBackstage();
}

export async function saveAsFile(
  latestPage: ScannedPage | undefined,
  documentTitle: string,
  setStatus: (s: string) => void,
  closeBackstage: () => void,
  updateLastPage: (updates: Partial<ScannedPage>) => void,
  setTitle: (t: string) => void,
) {
  if (!latestPage?.dataUrl) {
    setStatus("Tidak ada dokumen untuk disimpan.");
    closeBackstage();
    return;
  }
  const base64 = latestPage.dataUrl.split(",")[1] || "";
  if (sp) {
    const filePath = await sp.saveFile();
    if (!filePath) return;
    try {
      await sp.saveBuffer(filePath, base64);
      updateLastPage({ path: filePath });
      setTitle(filePath.split(/[\\/]/).pop() || documentTitle);
      setStatus(`Disimpan sebagai: ${filePath}`);
    } catch {
      setStatus("Gagal menyimpan file.");
    }
  } else {
    browserDownload(latestPage.dataUrl, documentTitle);
    setStatus(`Diunduh: ${documentTitle}`);
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
  const base64 = latestPage.dataUrl.split(",")[1] || "";
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
    browserDownload(latestPage.dataUrl, "Dokumen Scan");
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
