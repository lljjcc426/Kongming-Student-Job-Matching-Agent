export type GatewayOperation = "jobs" | "status" | "model";

const PUBLIC_GATEWAY_PATH = "/api/gateway";

export const hasPublicGateway = () => (
  typeof window !== "undefined" && window.location.protocol !== "file:"
);

export const publicGatewayUrl = (operation: GatewayOperation) => {
  if (!hasPublicGateway()) return null;
  const url = new URL(PUBLIC_GATEWAY_PATH, window.location.href);
  url.searchParams.set("operation", operation);
  return url;
};
