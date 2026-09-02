// vite.config.js
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { mazeHardeningPlugin } from "./tools/mazeHardeningPlugin.js";

export default defineConfig({
  plugins: [mazeHardeningPlugin(), react()],
});
