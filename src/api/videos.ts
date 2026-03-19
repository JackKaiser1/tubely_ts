import { respondWithJSON } from "./json";
import { type ApiConfig } from "../config";
import { S3Client, type BunRequest } from "bun";
import { BadRequestError, UserForbiddenError } from "./errors";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import { writeFileFromPart } from "./assets";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId || typeof videoId !== "string") {
    throw new BadRequestError("Invalid video Id");
  }

  const validVideoId = validateUUID(videoId);
  const accessToken = getBearerToken(req.headers);
  const userId = validateJWT(accessToken, cfg.jwtSecret);

  const videoMetaData = getVideo(cfg.db, validVideoId);
  if (!videoMetaData) {
    throw new BadRequestError("Video Id does not match record in database");
  }

  if (videoMetaData.userID !== userId) {
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
  
  const {fileUrl, bunFile, filePath, fileName, blob} = await writeFileFromPart(cfg, videoFile);
  const s3File = cfg.s3Client.file(fileName, { bucket: cfg.s3Bucket });
  s3File.write(bunFile, { type: bunFile.type });

  videoMetaData.videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${fileName}`;
  updateVideo(cfg.db, videoMetaData);

  bunFile.delete();
  return respondWithJSON(200, null);
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

