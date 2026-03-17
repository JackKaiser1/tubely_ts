import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import { pathToFileURL, type BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { displayPartsToString } from "typescript";
import { mediaTypeToExt, getAssetDiskPath, getAssetURL } from "./assets";
import path from "node:path";
import { randomBytes } from "node:crypto";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

// const videoThumbnails: Map<string, Thumbnail> = new Map();

// export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
//   const { videoId } = req.params as { videoId?: string };
//   if (!videoId) {
//     throw new BadRequestError("Invalid video ID");
//   }

//   const video = getVideo(cfg.db, videoId);
//   if (!video) {
//     throw new NotFoundError("Couldn't find video");
//   }

//   const thumbnail = videoThumbnails.get(videoId);
//   if (!thumbnail) {
//     throw new NotFoundError("Thumbnail not found");
//   }

//   return new Response(thumbnail.data, {
//     headers: {
//       "Content-Type": thumbnail.mediaType,
//       "Cache-Control": "no-store",
//     },
//   });
// }

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);
  const video = getVideo(cfg.db, videoId);

  if (!video) {
    throw new BadRequestError("Video Id invalid");
  }
  if (video.userID !== userID) {
    throw new UserForbiddenError("User does not own the specified video");
  }

  const formData = await req.formData();
  const thumbnail = formData.get("thumbnail");

  if (!(thumbnail instanceof File)) {
    throw new BadRequestError("Thumbnail is of incorrect type");
  }

  const MAX_UPLOAD_SIZE = 10 << 20;

  if (thumbnail.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("File size exceeds max upload size");
  }

  const mediaType = thumbnail.type;

  if (mediaType !== "image/png" && mediaType !== "image/jpg") {
    throw new BadRequestError("Image type invalid");
  }

  const data = await thumbnail.arrayBuffer();
  
  const extension = mediaTypeToExt(mediaType);
  
  const randString = randomBytes(32).toString("base64url");
  const fileName = `${randString}${extension}`;

  const filePath = getAssetDiskPath(cfg, fileName);
  await Bun.write(filePath, data);

  const fileURL = getAssetURL(cfg, fileName);
  video.thumbnailURL = fileURL;

  updateVideo(cfg.db, video);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  return respondWithJSON(200, video);
}
