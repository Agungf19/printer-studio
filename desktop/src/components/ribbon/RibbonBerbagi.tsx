import { Share2, User, Lock, Network, RefreshCw } from "lucide-react";
import { RibbonContent, RibbonGroup, RibbonBig } from "../RibbonHelpers";

interface Props {
  active: boolean;
  onOpenShare: () => void;
  onOpenPermissions: () => void;
  onOpenPin: () => void;
  onNetworkDevices: () => void;
  onRefresh: () => void;
}

export default function RibbonBerbagi({
  active,
  onOpenShare,
  onOpenPermissions,
  onOpenPin,
  onNetworkDevices,
  onRefresh,
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
      <RibbonGroup title="Status Jaringan">
        <RibbonBig
          icon={Network}
          label="Perangkat Terhubung"
          onClick={onNetworkDevices}
        />
        <RibbonBig
          icon={RefreshCw}
          label="Segarkan Jaringan"
          onClick={onRefresh}
        />
      </RibbonGroup>
    </RibbonContent>
  );
}
