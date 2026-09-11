/* Media storage — Cloudflare R2 over its S3-compatible API.
 *
 * WHY THE S3 SDK AND NOT A BINDING. The Habihub CRM this was cloned from ran
 * on Cloudflare Workers, where R2 is reached through a Worker binding
 * (`env.MEDIA`) that exists only inside workerd. This app deploys on Vercel,
 * so the bucket is reached the way the other Vercel CRMs (Mook, Klaichan,
 * Ruk) reach theirs: an R2 API token with Object Read & Write on this one
 * bucket, presented over the S3 protocol. Region is always "auto" and the
 * endpoint is the account's R2 host, never an AWS one.
 *
 * THIS IS THE ONLY MODULE THAT TALKS TO THE BUCKET. Callers (listing media,
 * project photos, avatars, the /media delivery route) see put / get / delete
 * on a key, nothing about buckets or clients — so the storage backend can be
 * swapped in one file, exactly as it just was.
 *
 * Server-only: the credentials must never reach the browser. Uploads travel
 * through a server action rather than a presigned URL straight from the
 * browser, which keeps R2 CORS unconfigured. The cost of that choice on
 * Vercel is the platform's 4.5 MB request-body ceiling on serverless
 * functions — see README "Media uploads".
 */

import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let client: S3Client | undefined;

function r2(): S3Client {
  if (client) return client;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must all be set — media storage is unavailable."
    );
  }
  client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

function bucket(): string {
  const name = process.env.R2_BUCKET;
  if (!name) throw new Error("R2_BUCKET is not set — media storage is unavailable.");
  return name;
}

/** Store one object. Overwrites silently — media keys are minted with a
    timestamp (or are one-per-user for avatars), so a collision is a rewrite
    of the same logical file, never a clobbered stranger. */
export async function putMedia(
  key: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string
): Promise<void> {
  await r2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body instanceof ArrayBuffer ? new Uint8Array(body) : body,
      ContentType: contentType,
    })
  );
}

/** Delete one object. Deleting a key that is already gone is a no-op on S3,
    which is the behaviour every caller wants — an orphan-cleanup that throws
    on "already clean" would fail the write it was tidying up after. */
export async function deleteMedia(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** What the delivery route needs to stream one object back: the bytes plus
    the HTTP metadata that was stored with them. */
export interface MediaObject {
  body: ReadableStream<Uint8Array>;
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  contentLength?: number;
  etag?: string;
}

/** Fetch one object, or null when the key does not exist. Any other failure
    (credentials, network, a bucket that is not there) propagates — that is a
    configuration problem, not a missing file, and must not turn into a 404. */
export async function getMedia(key: string): Promise<MediaObject | null> {
  try {
    const res = await r2().send(
      new GetObjectCommand({ Bucket: bucket(), Key: key })
    );
    if (!res.Body) return null;
    return {
      body: res.Body.transformToWebStream(),
      contentType: res.ContentType,
      contentLanguage: res.ContentLanguage,
      contentDisposition: res.ContentDisposition,
      contentEncoding: res.ContentEncoding,
      contentLength: res.ContentLength,
      etag: res.ETag,
    };
  } catch (err) {
    if (err instanceof NoSuchKey) return null;
    throw err;
  }
}
