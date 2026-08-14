const http = require("node:http");
const https = require("node:https");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const defaultEnhanceMiddleware = config.server?.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware, metroServer) => {
    const nextMiddleware = defaultEnhanceMiddleware
      ? defaultEnhanceMiddleware(metroMiddleware, metroServer)
      : metroMiddleware;

    return (request, response, next) => {
      const requestPath = request.url ?? "";

      if (requestPath.startsWith("/api/") || requestPath.startsWith("/health/")) {
        proxyToGateway(request, response);
        return;
      }

      nextMiddleware(request, response, next);
    };
  },
};

function proxyToGateway(request, response) {
  const target =
    process.env.EXPO_API_PROXY_TARGET ??
    process.env.VITE_API_PROXY_TARGET ??
    "http://localhost:8000";
  const upstreamUrl = new URL(request.url ?? "/", target);
  const transport = upstreamUrl.protocol === "https:" ? https : http;

  const proxyRequest = transport.request(
    upstreamUrl,
    {
      method: request.method,
      headers: {
        ...request.headers,
        host: upstreamUrl.host,
      },
    },
    (proxyResponse) => {
      response.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
      proxyResponse.pipe(response);
    },
  );

  proxyRequest.on("error", (error) => {
    if (!response.headersSent) {
      response.writeHead(502, { "content-type": "application/problem+json" });
    }

    response.end(
      JSON.stringify({
        type: "about:blank",
        title: "Gateway no disponible",
        status: 502,
        detail: error.message,
      }),
    );
  });

  request.pipe(proxyRequest);
}

module.exports = config;
