import { ZoomIn, ZoomOut, Search } from "lucide-react";
import { RibbonContent, RibbonGroup, RibbonBig } from "../RibbonHelpers";

interface Props {
  active: boolean;
  zoom: number;
  onZoom: (v: number) => void;
  showStatusBar: boolean;
  onShowStatusBar: (v: boolean) => void;
  showDocTabs: boolean;
  onShowDocTabs: (v: boolean) => void;
}

export default function RibbonTampilan({
  active,
  zoom,
  onZoom,
  showStatusBar,
  onShowStatusBar,
  showDocTabs,
  onShowDocTabs,
}: Props) {
  return (
    <RibbonContent active={active}>
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
