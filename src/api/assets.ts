import { existsSync, mkdirSync } from "fs";
import type { ApiConfig } from "../config";
import { BadRequestError } from "./errors";
import path from "node:path";
import { randomBytes } from "node:crypto";


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

export async function writeFileFromPart(cfg: ApiConfig, part: Bun.FormDataEntryValue) {
  if (!(part instanceof File)) {
      throw new BadRequestError("Video is of incorrect type");
    }

  const blob = await part.arrayBuffer(); 
  const fileExtension = mediaTypeToExt(part.type);
  const randString = randomBytes(32).toString("base64url");
  const fileName = `${randString}${fileExtension}`;
  const filePath = getAssetDiskPath(cfg, fileName);
  Bun.write(filePath, blob);
  return {
    fileUrl: getAssetURL(cfg, fileName),
    bunFile: Bun.file(filePath),
    filePath: filePath,
    fileName: fileName,
    blob: blob,
  };
}


