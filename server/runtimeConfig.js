export const readBoundedIntegerEnv = (
  name,
  fallback,
  { minimum = 1_000, maximum = 300_000 } = {},
) => {
  const rawValue = process.env[name];
  if (typeof rawValue !== "string" || !rawValue.trim()) return fallback;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(parsed)));
};
