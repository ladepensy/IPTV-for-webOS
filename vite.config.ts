import {copyFileSync, existsSync, writeFileSync} from "node:fs";
import {resolve} from "node:path";
import react from "@vitejs/plugin-react";
import {defineConfig, type Plugin} from "vite";

function copyWebOsAssets(): Plugin {
  return {
    name: "copy-webos-assets",
    closeBundle() {
      const root = process.cwd();
      const output = resolve(root, "dist");
      for (const file of ["appinfo.json", "icon.png", "largeIcon.png", "interaction.js", "app.js"]) {
        const source = resolve(root, file);
        if (existsSync(source)) copyFileSync(source, resolve(output, file));
      }
      writeFileSync(resolve(output, "config.js"), "window.IPTV_CONFIG = window.IPTV_CONFIG || {};\n", "utf8");
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), copyWebOsAssets()],
  build: {
    target: "es2015",
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false
  },
  test: {
    include: ["src/**/*.test.ts"]
  }
});
