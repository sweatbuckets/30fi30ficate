import { mkdir, cp, rm } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const backgroundOutfile = path.join(distDir, "background", "index.js");
const popupOutfile = path.join(distDir, "popup", "main.js");

async function ensureDistStructure() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(path.join(distDir, "background"), { recursive: true });
  await mkdir(path.join(distDir, "popup"), { recursive: true });
}

async function bundleEntries() {
  await build({
    entryPoints: [path.join(rootDir, "src", "background", "index.ts")],
    outfile: backgroundOutfile,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["firefox109"],
    sourcemap: true,
    legalComments: "none"
  });

  await build({
    entryPoints: [path.join(rootDir, "src", "popup", "main.ts")],
    outfile: popupOutfile,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["firefox109"],
    sourcemap: true,
    legalComments: "none"
  });
}

async function copyStaticAssets() {
  await cp(
    path.join(rootDir, "src", "popup", "index.html"),
    path.join(distDir, "popup", "index.html")
  );
  await cp(
    path.join(rootDir, "src", "popup", "styles.css"),
    path.join(distDir, "popup", "styles.css")
  );
}

async function main() {
  await ensureDistStructure();
  await bundleEntries();
  await copyStaticAssets();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
