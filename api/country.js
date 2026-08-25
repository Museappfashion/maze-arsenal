// api/country.js
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}

export default {
  async fetch(request) {
    if (request.method !== "GET") {
      return json({ error: "Method not allowed." }, 405);
    }

    const country = String(
      request.headers.get("x-vercel-ip-country") ?? "",
    )
      .trim()
      .toUpperCase();

    return json({
      country: COUNTRY_CODE_PATTERN.test(country) ? country : "",
    });
  },
};
