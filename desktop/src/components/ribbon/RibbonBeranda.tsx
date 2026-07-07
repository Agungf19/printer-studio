import {
  ChevronDown,
  ChevronUp,
  Clipboard,
  Copy,
  Crop,
  FilePlus2,
  FolderOpen,
  Hand,
  Maximize2,
  MoveHorizontal,
  RefreshCw,
  RotateCcwSquare,
  RotateCwSquare,
  Search,
  Scissors,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  RibbonContent,
  RibbonGroup,
  RibbonBig,
  RibbonSmall,
} from "../RibbonHelpers";
import type { ScannedPage } from "../../hooks/useFileActions";

interface Props {
  active: boolean;
  latestPage?: ScannedPage;
  onPaste: () => void;
  onCut: () => void;
  onCopy: () => void;
  onNew: () => void;
  onOpen: () => void;
  onRotate: (deg: number) => void;
  cropMode: boolean;
  onToggleCrop: () => void;
  hasSelection: boolean;
  onDuplicate: () => void;
  onDeleteObject: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  zoom: number;
  onZoom: (v: number) => void;
  panMode: boolean;
  onTogglePan: () => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  showStatusBar: boolean;
  onShowStatusBar: (v: boolean) => void;
  showDocTabs: boolean;
  onShowDocTabs: (v: boolean) => void;
}

export default function RibbonBeranda({
  active,
  latestPage,
  onPaste,
  onCut,
  onCopy,
  onNew,
  onOpen,
  onRotate,
  cropMode,
  onToggleCrop,
  hasSelection,
  onDuplicate,
  onDeleteObject,
  onBringForward,
  onSendBackward,
  zoom,
  onZoom,
  panMode,
  onTogglePan,
  onFitWidth,
  onFitPage,
  showStatusBar,
  onShowStatusBar,
  showDocTabs,
  onShowDocTabs,
}: Props) {
  const hasPage = !!latestPage;
  return (
    <RibbonContent active={active}>
      <RibbonGroup title="Clipboard">
        <RibbonBig icon={Clipboard} label="Tempel" onClick={onPaste} />
        <div className="ps-small-stack">
          <RibbonSmall icon={Scissors} label="Potong" onClick={onCut} />
          <RibbonSmall icon={Copy} label="Salin" onClick={onCopy} />
        </div>
      </RibbonGroup>
      <RibbonGroup title="Dokumen">
        <RibbonBig icon={FilePlus2} label="Baru" onClick={onNew} />
        <RibbonBig icon={FolderOpen} label="Buka" onClick={onOpen} />
      </RibbonGroup>
      <RibbonGroup title="Gambar">
        <RibbonBig
          icon={RotateCcwSquare}
          label="Putar Kiri"
          disabled={!hasSelection}
          onClick={() => onRotate(-90)}
        />
        <RibbonBig
          icon={RotateCwSquare}
          label="Putar Kanan"
          disabled={!hasSelection}
          onClick={() => onRotate(90)}
        />
        <RibbonBig
          icon={RefreshCw}
          label="Putar 180°"
          disabled={!hasSelection}
          onClick={() => onRotate(180)}
        />
      </RibbonGroup>
      <RibbonGroup title="Perbaikan">
        <RibbonBig
          icon={Crop}
          label="Pangkas"
          primary={cropMode}
          disabled={!hasPage}
          onClick={onToggleCrop}
        />
      </RibbonGroup>
      <RibbonGroup title="Objek">
        <RibbonBig
          icon={Copy}
          label="Duplikat"
          disabled={!hasSelection}
          onClick={onDuplicate}
        />
        <RibbonBig
          icon={Trash2}
          label="Hapus"
          disabled={!hasSelection}
          onClick={onDeleteObject}
        />
        <RibbonBig
          icon={ChevronUp}
          label="Maju"
          disabled={!hasSelection}
          onClick={onBringForward}
        />
        <RibbonBig
          icon={ChevronDown}
          label="Mundur"
          disabled={!hasSelection}
          onClick={onSendBackward}
        />
      </RibbonGroup>
      <RibbonGroup title="Zoom">
        <RibbonBig
          icon={ZoomIn}
          label="Perbesar"
          onClick={() => onZoom(zoom + 10)}
        />
        <RibbonBig
          icon={ZoomOut}
          label="Perkecil"
          onClick={() => onZoom(zoom - 10)}
        />
        <RibbonBig icon={Search} label="100%" onClick={() => onZoom(100)} />
      </RibbonGroup>
      <RibbonGroup title="Sesuaikan">
        <RibbonBig icon={MoveHorizontal} label="Lebar" onClick={onFitWidth} />
        <RibbonBig icon={Maximize2} label="Halaman" onClick={onFitPage} />
        <RibbonBig
          icon={Hand}
          label="Geser"
          primary={panMode}
          onClick={onTogglePan}
        />
      </RibbonGroup>
      <RibbonGroup title="Panel">
        <div className="ps-check-stack">
          <label>
            <input
              type="checkbox"
              checked={showStatusBar}
              onChange={(e) => onShowStatusBar(e.target.checked)}
            />{" "}
            Status Bar
          </label>
          <label>
            <input
              type="checkbox"
              checked={showDocTabs}
              onChange={(e) => onShowDocTabs(e.target.checked)}
            />{" "}
            Tab Dokumen
          </label>
        </div>
      </RibbonGroup>
    </RibbonContent>
  );
}
