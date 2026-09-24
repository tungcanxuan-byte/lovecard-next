import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/** Local fallback directory, served by src/app/uploads/[...key]/route.ts. */
export const LOCAL_UPLOADS = path.join(process.cwd(), ".data/uploads");

let s3: S3Client | null = null;
const s3Config = () => {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET, S3_PUBLIC_URL } = process.env;
  if (!S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET || !S3_PUBLIC_URL) return null;
  return { endpoint: S3_ENDPOINT, bucket: S3_BUCKET, accessKey: S3_ACCESS_KEY, secret: S3_SECRET, publicUrl: S3_PUBLIC_URL };
};

/**
 * Stores a file and returns its public URL: S3-compatible storage (Cloudflare R2) when S3_* is set,
 * otherwise .data/uploads on local disk.
 */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<string> {
  const cfg = s3Config();
  if (cfg) {
    s3 ??= new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: cfg.endpoint,
      credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secret },
    });
    await s3.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return `${cfg.publicUrl.replace(/\/$/, "")}/${key}`;
  }
  const file = path.join(LOCAL_UPLOADS, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
  return `/uploads/${key}`;
}

export async function readLocalObject(key: string): Promise<Buffer | null> {
  const file = path.resolve(LOCAL_UPLOADS, key);
  if (!file.startsWith(LOCAL_UPLOADS + path.sep)) return null;
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}
