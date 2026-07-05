import type { ComponentType, ReactNode } from "react";

type DotTone = "on" | "busy" | "off";

export function RibbonContent({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div className={active ? "ps-ribbon-content active" : "ps-ribbon-content"}>
      {children}
    </div>
  );
}

export function RibbonGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="ps-rgroup">
      <div className="ps-rgroup-items">{children}</div>
      <div className="ps-rgroup-label">{title}</div>
    </div>
  );
}

export function RibbonBig({
  icon: Icon,
  label,
  primary,
  onClick,
  disabled,
  spinning,
  title,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  primary?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  spinning?: boolean;
  title?: string;
}) {
  return (
    <button
      className={primary ? "ps-btn-big primary" : "ps-btn-big"}
      onClick={onClick}
      disabled={disabled || spinning}
      title={title || label}
    >
      <span className={spinning ? "ps-spin" : ""}>
        <Icon size={26} />
      </span>
      <span>{label}</span>
    </button>
  );
}

export function RibbonSmall({
  icon: Icon,
  label,
  onClick,
  spinning,
  title,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick?: () => void;
  spinning?: boolean;
  title?: string;
}) {
  return (
    <button
      className="ps-btn-small"
      onClick={onClick}
      disabled={spinning}
      title={title || label}
    >
      <span className={spinning ? "ps-spin" : ""}>
        <Icon size={15} />
      </span>
      {label}
    </button>
  );
}

export function RibbonField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="ps-rfield">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function DeviceChip({
  label,
  tone = "on",
  selected,
  onClick,
}: {
  label: string;
  tone?: DotTone;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={selected ? "ps-dev-chip selected" : "ps-dev-chip"}
      onClick={onClick}
    >
      <StatusDot tone={tone} />
      {label}
    </button>
  );
}

export function StatusDot({ tone }: { tone: DotTone }) {
  return <span className={`ps-dot ${tone}`} />;
}

export function IconOnly({
  title,
  icon: Icon,
  onClick,
}: {
  title: string;
  icon: ComponentType<{ size?: number }>;
  onClick?: () => void;
}) {
  return (
    <button className="ps-icon-only" title={title} onClick={onClick}>
      <Icon size={15} />
    </button>
  );
}
