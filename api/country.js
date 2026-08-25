// api/country.js
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

function sendJson(response, status, body) {
  response.status(status).json(body);
}

export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  response.setHeader(
    "Cache-Control",
    "public, max-age=0, must-revalidate",
  );

  const country = String(
    request.headers["x-vercel-ip-country"] ?? "",
  )
    .trim()
    .toUpperCase();

  sendJson(response, 200, {
    country: COUNTRY_CODE_PATTERN.test(country) ? country : "",
  });
}
