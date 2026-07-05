import {
  Clipboard,
  Copy,
  Scissors,
  FilePlus2,
  FolderOpen,
  Save,
  RotateCw,
  RotateCcw,
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
  onSave: () => void;
  onRotate: (deg: number) => void;
  cropMode: boolean;
  onToggleCrop: () => void;
}

export default function RibbonBeranda({
  active,
  latestPage,
  onPaste,
  onCut,
  onCopy,
  onNew,
  onOpen,
  onSave,
  onRotate,
  cropMode,
  onToggleCrop,
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
        <RibbonBig
          icon={Save}
          label="Simpan"
          disabled={!hasPage}
          onClick={onSave}
        />
      </RibbonGroup>
      <RibbonGroup title="Putar">
        <RibbonBig
          icon={RotateCw}
          label="Putar Kanan"
          disabled={!hasPage}
          onClick={() => onRotate(90)}
        />
        <RibbonBig
          icon={RotateCcw}
          label="Putar Kiri"
          disabled={!hasPage}
          onClick={() => onRotate(-90)}
        />
        <RibbonBig
          icon={RotateCw}
          label="Putar 180°"
          disabled={!hasPage}
          onClick={() => onRotate(180)}
        />
        <RibbonBig
          icon={Scissors}
          label="Potong"
          primary={cropMode}
          disabled={!hasPage}
          onClick={onToggleCrop}
        />
      </RibbonGroup>
    </RibbonContent>
  );
}
