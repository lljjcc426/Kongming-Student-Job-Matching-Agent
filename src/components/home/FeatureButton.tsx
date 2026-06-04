import type { LucideIcon } from "lucide-react";

type FeatureButtonProps = {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
};

export default function FeatureButton({ icon: Icon, label, onClick }: FeatureButtonProps) {
  return (
    <button className="km-feature-button" type="button" onClick={onClick}>
      <span className="km-feature-button-icon">
        <Icon size={24} strokeWidth={2.2} />
      </span>
      <strong>{label}</strong>
    </button>
  );
}
