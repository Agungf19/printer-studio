import type { ScannedPage } from "./useFileActions";

const sp = typeof window !== "undefined" ? window.scanPilot : null;

async function browserWriteImageToClipboard(dataUrl: string) {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined")
    return false;
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
  return true;
}

async function browserReadImageFromClipboard() {
  if (!navigator.clipboard?.read) return null;
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const imageType = item.types.find((type) => type.startsWith("image/"));
    if (!imageType) continue;
    const blob = await item.getType(imageType);
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  return null;
}

export async function handleCopy(
  latestPage: ScannedPage | undefined,
  setStatus: (s: string) => void,
) {
  const dataUrl = latestPage?.dataUrl;
  if (!dataUrl) {
    setStatus("Tidak ada gambar untuk disalin.");
    return false;
  }
  try {
    const ok = sp
      ? await sp.writeImageToClipboard(dataUrl)
      : await browserWriteImageToClipboard(dataUrl);
    setStatus(ok ? "Gambar disalin ke clipboard." : "Gagal menyalin gambar.");
    return ok;
  } catch {
    setStatus("Gagal menyalin gambar.");
    return false;
  }
}

export async function handlePaste(
  setStatus: (s: string) => void,
  upsertPage: (page: ScannedPage) => void,
  setTitle: (t: string) => void,
) {
  try {
    const dataUrl = sp
      ? await sp.readImageFromClipboard()
      : await browserReadImageFromClipboard();
    if (!dataUrl) {
      setStatus("Clipboard tidak berisi gambar.");
      return;
    }
    const page: ScannedPage = {
      path: "",
      filename: `Clipboard ${new Date().toLocaleTimeString().replace(/:/g, "-")}.png`,
      dataUrl,
    };
    upsertPage(page);
    setTitle(page.filename);
    setStatus("Gambar ditempel dari clipboard.");
  } catch {
    setStatus("Gagal menempel gambar dari clipboard.");
  }
}

export async function handleCut(
  latestPage: ScannedPage | undefined,
  setStatus: (s: string) => void,
  closePage: (index: number) => void,
  activePageIndex: number,
  upsertPage: (page: ScannedPage) => void,
  setTitle: (t: string) => void,
) {
  const ok = await handleCopy(latestPage, setStatus);
  if (ok && latestPage) {
    closePage(activePageIndex);
    setStatus("Gambar dipotong ke clipboard.");
  }
}
