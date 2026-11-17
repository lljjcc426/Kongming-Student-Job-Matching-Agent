export default function ProductAvatar({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`product-avatar ${compact ? "compact" : ""}`}>
      <img src="/brand/kongming-mark.svg" alt="" aria-hidden="true" />
    </span>
  );
}
