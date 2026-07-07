import { Share2, User, Lock } from "lucide-react";
import { RibbonContent, RibbonGroup, RibbonBig } from "../RibbonHelpers";

interface Props {
  active: boolean;
  onOpenShare: () => void;
  onOpenPermissions: () => void;
  onOpenPin: () => void;
}

export default function RibbonBerbagi({
  active,
  onOpenShare,
  onOpenPermissions,
  onOpenPin,
}: Props) {
  return (
    <RibbonContent active={active}>
      <RibbonGroup title="Bagikan ke Jaringan">
        <RibbonBig
          icon={Share2}
          label="Bagikan Device"
          primary
          onClick={onOpenShare}
        />
      </RibbonGroup>
      <RibbonGroup title="Akses">
        <RibbonBig
          icon={User}
          label="Kelola Izin"
          onClick={onOpenPermissions}
        />
        <RibbonBig icon={Lock} label="Kode PIN" onClick={onOpenPin} />
      </RibbonGroup>
    </RibbonContent>
  );
}
