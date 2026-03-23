import { S3Client } from "bun";
import  { type ApiConfig, cfg } from "../config";
import type { Video } from "../db/videos";
import { NotFoundError } from "./errors";


export function generatePresignedURL(cfg: ApiConfig, key: string, expireTime: number) {
    return cfg.s3Client.presign(key, { expiresIn: expireTime });
}

export function dbVideoToSignedVideo(cfg: ApiConfig, video: Video) {
    const key = video.videoURL;
    if (!key) {
        return video;
    }

    video.videoURL = generatePresignedURL(cfg, key, 3600);

    return video;
}