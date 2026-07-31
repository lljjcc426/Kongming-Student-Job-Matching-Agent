import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export default function FontAwesomeShapeIcon({ icon, size = 16 }: { icon: IconDefinition; size?: number }) {
  const [width, height, , , pathData] = icon.icon;
  const paths = Array.isArray(pathData) ? pathData : [pathData];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${width} ${height}`} fill="currentColor" aria-hidden="true" focusable="false">
      {paths.map((path, index) => (
        <path key={`${icon.iconName}-${index}`} d={path} />
      ))}
    </svg>
  );
}
