import { respondWithJSON } from "./json";
import { type ApiConfig } from "../config";
import { S3Client, type BunRequest } from "bun";
import { BadRequestError, UserForbiddenError } from "./errors";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import { mediaTypeToExt, getAssetDiskPath, getAssetURL } from "./assets";
import { getVideoAspectRatio } from "./video-meta";
import { randomBytes } from "node:crypto";
import { processVideoForFastStart } from "./video-meta";
import { dbVideoToSignedVideo } from "./signed-url";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId || typeof videoId !== "string") {
    throw new BadRequestError("Invalid video Id");
  }

  const validVideoId = validateUUID(videoId);
  const accessToken = getBearerToken(req.headers);
  const userId = validateJWT(accessToken, cfg.jwtSecret);

  const unsignedVideo = getVideo(cfg.db, validVideoId);
  if (!unsignedVideo) {
    throw new BadRequestError("Video Id does not match record in database");
  }

  if (unsignedVideo.userID !== userId) {
    throw new UserForbiddenError("User is not owner of video");
  }

  const formData = await req.formData();

  const videoFile = formData.get("video");
  if (!(videoFile instanceof File)) {
    throw new BadRequestError("Video is of incorrect type");
  }

  const MAX_UPLOAD_SIZE = 1 << 30;
  if (videoFile.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("Video exceeds file size limit");
  }

  if (videoFile.type !== "video/mp4") {
    throw new BadRequestError("Video is not mp4");
  }
  
  const { bunFile, filePath, fileName } = await writeFileFromPart(cfg, videoFile);
  const aspectRatio = await getVideoAspectRatio(filePath);

  const key = `${aspectRatio}/${fileName}`;
  const s3File = cfg.s3Client.file(key, { bucket: cfg.s3Bucket });
  s3File.write(bunFile, { type: bunFile.type });


  unsignedVideo.videoURL = `${key}`;
  updateVideo(cfg.db, unsignedVideo);

  bunFile.delete();
  
  const signedVideo = dbVideoToSignedVideo(cfg, unsignedVideo);
  return respondWithJSON(200, signedVideo);
}

function validateUUID(id: string) {
  const idParts = id.split("-");

  if (idParts.length !== 5
      || idParts[0].length !== 8 
      || idParts[1].length !== 4
      || idParts[2].length !== 4
      || idParts[3].length !== 4
      || idParts[4].length !== 12
  ) {
    throw new BadRequestError("video Id is not valid UUID");
  }

  return id;
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
  
  await Bun.write(filePath, blob);
  const tempBunFile = Bun.file(filePath);
  const processedFilePath = await processVideoForFastStart(filePath);

  tempBunFile.delete();

  return {
    fileUrl: getAssetURL(cfg, fileName),
    bunFile: Bun.file(processedFilePath),
    filePath: processedFilePath,
    fileName: fileName,
  };
}





