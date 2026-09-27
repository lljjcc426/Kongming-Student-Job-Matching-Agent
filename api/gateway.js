import { handlePublicGatewayRequest } from "../server/publicGateway.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
};

export default async function handler(request, response) {
  const result = await handlePublicGatewayRequest({
    method: request.method,
    headers: request.headers,
    query: request.query,
    body: request.body,
    remoteAddress: request.socket?.remoteAddress,
  });

  for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value);
  response.status(result.status);
  if (result.payload === undefined) {
    response.end();
    return;
  }
  response.json(result.payload);
}
