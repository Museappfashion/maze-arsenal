// api/country.js
export default {
  fetch(request) {
    const rawCountry = request.headers.get("x-vercel-ip-country") ?? "";
    const country = /^[A-Z]{2}$/.test(rawCountry.toUpperCase())
      ? rawCountry.toUpperCase()
      : "";

    return Response.json(
      { country },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  },
};
