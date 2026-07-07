import { useCallback, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DocumentState } from "./useFileActions";

type HistorySnapshot = {
  documents: DocumentState[];
  activeDocIndex: number;
  activePageIndex: number;
};

interface UseDocumentHistoryParams {
  documents: DocumentState[];
  activeDocIndex: number;
  activePageIndex: number;
  setDocuments: Dispatch<SetStateAction<DocumentState[]>>;
  setActiveDocIndex: Dispatch<SetStateAction<number>>;
  setActivePageIndex: Dispatch<SetStateAction<number>>;
  setScanStatus: (status: string) => void;
  onRestore?: () => void;
}

const MAX_HISTORY = 30;

function cloneSnapshot(snapshot: HistorySnapshot): HistorySnapshot {
  return structuredClone(snapshot);
}

function clampIndex(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(Math.max(0, value), max);
}

export function useDocumentHistory({
  documents,
  activeDocIndex,
  activePageIndex,
  setDocuments,
  setActiveDocIndex,
  setActivePageIndex,
  setScanStatus,
  onRestore,
}: UseDocumentHistoryParams) {
  const currentRef = useRef<HistorySnapshot>({
    documents,
    activeDocIndex,
    activePageIndex,
  });
  const pastRef = useRef<HistorySnapshot[]>([]);
  const futureRef = useRef<HistorySnapshot[]>([]);
  const [, setVersion] = useState(0);

  currentRef.current = { documents, activeDocIndex, activePageIndex };

  const publish = useCallback(
    (past: HistorySnapshot[], future: HistorySnapshot[]) => {
      pastRef.current = past;
      futureRef.current = future;
      setVersion((version) => version + 1);
    },
    [],
  );

  const restoreSnapshot = useCallback(
    (snapshot: HistorySnapshot) => {
      const next = cloneSnapshot(snapshot);
      const docIndex = clampIndex(next.activeDocIndex, next.documents.length - 1);
      const pageCount = next.documents[docIndex]?.pages.length ?? 0;
      const pageIndex = clampIndex(next.activePageIndex, pageCount - 1);

      setDocuments(next.documents);
      setActiveDocIndex(docIndex);
      setActivePageIndex(pageIndex);
      onRestore?.();
    },
    [onRestore, setActiveDocIndex, setActivePageIndex, setDocuments],
  );

  const recordHistory = useCallback(() => {
    const snapshot = cloneSnapshot(currentRef.current);
    const nextPast = [...pastRef.current, snapshot].slice(-MAX_HISTORY);
    publish(nextPast, []);
  }, [publish]);

  const undo = useCallback(() => {
    const past = pastRef.current;
    if (past.length === 0) {
      setScanStatus("Tidak ada aksi untuk diurungkan.");
      return;
    }

    const target = past[past.length - 1];
    const current = cloneSnapshot(currentRef.current);
    publish(past.slice(0, -1), [current, ...futureRef.current]);
    restoreSnapshot(target);
    setScanStatus("Diurungkan.");
  }, [publish, restoreSnapshot, setScanStatus]);

  const redo = useCallback(() => {
    const future = futureRef.current;
    if (future.length === 0) {
      setScanStatus("Tidak ada aksi untuk diulangi.");
      return;
    }

    const target = future[0];
    const current = cloneSnapshot(currentRef.current);
    publish([...pastRef.current, current].slice(-MAX_HISTORY), future.slice(1));
    restoreSnapshot(target);
    setScanStatus("Diulangi.");
  }, [publish, restoreSnapshot, setScanStatus]);

  return {
    recordHistory,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
