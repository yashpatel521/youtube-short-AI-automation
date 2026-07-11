interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`nav-item w-full ${active ? 'active' : ''}`}
      title={label}
    >
      <span className="w-5 h-5 shrink-0 flex items-center justify-center">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
