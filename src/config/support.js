// src/config/support.js
export const SUPPORT_LINKS = [
  {
    key: "1",
    label: "$1",
    url: import.meta.env.VITE_SUPPORT_URL_1?.trim() ?? "",
  },
  {
    key: "2",
    label: "$2",
    url: import.meta.env.VITE_SUPPORT_URL_2?.trim() ?? "",
  },
  {
    key: "5",
    label: "$5",
    url: import.meta.env.VITE_SUPPORT_URL_5?.trim() ?? "",
  },
  {
    key: "custom",
    label: "CUSTOM",
    url: import.meta.env.VITE_SUPPORT_URL_CUSTOM?.trim() ?? "",
  },
];
