interface Props {
  label: string;
  active: boolean;
  devOnly?: boolean;
  onClick: () => void;
}

export default function NavItem({ label, active, devOnly, onClick }: Props) {
  return (
    <div className={`vs-nav-item${active ? " active" : ""}`} onClick={onClick}>
      {label}
      {devOnly && <span className="vs-dev-dot" title="Dev mode only" />}
    </div>
  );
}
