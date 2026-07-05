import { useEffect, useRef } from "react";

interface ShortcutHandlers {
  handleSave: () => void;
  handleOpen: () => void;
  handleNew: () => void;
  handlePrint: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
  handleCut: () => void;
  handleExport: () => void;
  handleDelete: () => void;
  closeModals: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isCtrl = event.ctrlKey || event.metaKey;

      // Block refresh shortcuts (prevent accidental state loss in desktop app)
      if (
        event.key === "F5" ||
        (isCtrl && event.key === "r") ||
        (isCtrl && event.key === "R")
      ) {
        event.preventDefault();
        return;
      }

      if (event.key === "Escape") ref.current.closeModals();
      if (isCtrl && event.key === "s") {
        event.preventDefault();
        ref.current.handleSave();
      }
      if (isCtrl && event.key === "o") {
        event.preventDefault();
        ref.current.handleOpen();
      }
      if (isCtrl && event.key === "n") {
        event.preventDefault();
        ref.current.handleNew();
      }
      if (isCtrl && event.key === "p") {
        event.preventDefault();
        ref.current.handlePrint();
      }
      if (isCtrl && event.key === "c") {
        event.preventDefault();
        ref.current.handleCopy();
      }
      if (isCtrl && event.key === "v") {
        event.preventDefault();
        ref.current.handlePaste();
      }
      if (isCtrl && event.key === "x") {
        event.preventDefault();
        ref.current.handleCut();
      }
      if (isCtrl && event.key === "e") {
        event.preventDefault();
        ref.current.handleExport();
      }
      if (event.key === "Delete") {
        ref.current.handleDelete();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
