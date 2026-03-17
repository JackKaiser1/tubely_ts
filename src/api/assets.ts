import { existsSync, mkdirSync } from "fs";
import type { ApiConfig } from "../config";
import path from "node:path";

export function ensureAssetsDir(cfg: ApiConfig) {
  if (!existsSync(cfg.assetsRoot)) {
    mkdirSync(cfg.assetsRoot, { recursive: true });
  }
}

export function mediaTypeToExt(mediaType: string) {
  const mediaTypeParts = mediaType.split("/");
  if (mediaTypeParts.length !== 2) {
    return ".bin";
  }
  return `.${mediaTypeParts[1]}`;
}

export function getAssetDiskPath(cfg: ApiConfig, fileName: string) {
  return path.join(cfg.assetsRoot, fileName);
}

export function getAssetURL(cfg: ApiConfig, fileName: string) {
  return `http://localhost:${cfg.port}/assets/${fileName}`;
}



