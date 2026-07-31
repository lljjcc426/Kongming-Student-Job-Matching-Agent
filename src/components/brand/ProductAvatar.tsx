export default function ProductAvatar({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`product-avatar ${compact ? "compact" : ""}`}>
      <img src="/kongming-ip.png" alt="" aria-hidden="true" />
    </span>
  );
}
