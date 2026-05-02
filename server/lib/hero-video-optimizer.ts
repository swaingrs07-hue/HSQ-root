/**
 * Server-side hero-video auto-optimizer.
 *
 * Wires the same ffmpeg pipeline that `scripts/optimize-hero-video.ts` runs
 * on demand into the admin "Add / Edit Hero Slide" save flow, so admins
 * never accidentally point the active hero slide at a heavy MP4 again.
 *
 * Why this exists
 * ---------------
 * The admin UI uploads the file directly to GCS via a presigned PUT URL
 * (no Express body), then `POST /api/hero-slides` saves the resulting
 * `/objects/uploads/<uuid>` path into `hero_slides.video_url`. Without
 * this module, a heavy 8.5 Mbps / 1920x1080 MP4 would land in production
 * and reproduce the loop-seam stutter that Tasks #143 / #144 / #146 spent
 * three rounds chasing. With this module the `POST` handler downloads the
 * just-uploaded MP4, transcodes it to a budgeted web-friendly copy
 * (≤ 2.5 Mbps video, 1600x900, 24 fps, closed GOP every 2 s, faststart,
 * no C2PA / `jumb` / `uuid` atoms), uploads the result as a NEW private
 * object, and rewrites `videoUrl` to point at the optimised copy before
 * the DB insert. The original heavy upload is left in storage as an
 * audit / rollback copy — never mutated.
 *
 * Failure mode
 * ------------
 * If anything in the pipeline fails (ffmpeg missing, network error,
 * structural / budget verification fails), the function THROWS — callers
 * decide whether to fall back to the un-optimised path or surface the
 * failure to the admin. The route handlers in this codebase fall back
 * (the upload should never be lost), and log the failure so it's
 * triageable.
 */

import { ObjectStorageService, objectStorageClient } from "../replit_integrations/object_storage/objectStorage";
import { randomUUID } from "crypto";
import { execSync } from "child_process";
import * as fs from "fs";

// Budget the optimised file MUST meet — we abort the upload if any of
// these are violated. These are the hard task-level acceptance gates;
// see replit.md "Hero Video Encoding Checklist". Mirrored verbatim by
// `scripts/optimize-hero-video.ts`.
const MAX_TOTAL_BYTES = 2_500_000;       // 2.5 MB total file
const MAX_VIDEO_BITRATE = 2_500_000;     // 2.5 Mbps video stream
const MAX_OVERALL_BITRATE = 2_700_000;   // 2.7 Mbps overall (video + 96 kbps AAC + container)
const MAX_VIDEO_WIDTH = 1600;
const MAX_VIDEO_HEIGHT = 1080;
const REQUIRED_FPS = 24;                  // exact, with ±0.1 tolerance for rate-conversion drift
const REQUIRED_VIDEO_CODEC = "h264";

// Note: there is intentionally no source-skip heuristic. Every MP4
// is unconditionally re-encoded — see the long comment in step 1b
// of `optimizeHeroVideoObject` for why partial probe-based skipping
// is unsafe (closed-GOP cadence is not robustly observable from
// ffprobe and the only way to guarantee a deterministic compliant
// output is to produce it ourselves).

export interface OptimizeResult {
  /** Original `/objects/uploads/<uuid>` path (untouched in storage). */
  sourcePath: string;
  /** New `/objects/uploads/<uuid>` path pointing at the optimised copy. */
  optimisedPath: string;
  /** Bytes before / after — for log lines. */
  sourceBytes: number;
  optimisedBytes: number;
}

/**
 * Pull `objectPath` from object storage, transcode to a web-friendly MP4,
 * and upload the result as a NEW private object. Returns the new path
 * (or the source path if the file already meets the budget).
 *
 * Only handles MP4 — call sites should detect WebM / non-video uploads
 * BEFORE invoking this function (WebM is already efficient and we don't
 * want to re-encode it). For a path that does not exist or whose content
 * type is not `video/mp4`, this throws.
 */
export async function optimizeHeroVideoObject(objectPath: string): Promise<OptimizeResult> {
  if (!objectPath.startsWith("/objects/")) {
    throw new Error(`Invalid object path (must start with /objects/): ${objectPath}`);
  }

  const svc = new ObjectStorageService();
  const sourceFile = await svc.getObjectEntityFile(objectPath);
  const [sourceMeta] = await sourceFile.getMetadata();
  const sourceBytes = Number(sourceMeta.size || 0);
  const sourceContentType = (sourceMeta.contentType as string) || "";
  if (!sourceContentType.startsWith("video/mp4")) {
    throw new Error(`Source content-type is not video/mp4 (was: ${sourceContentType || "<unset>"})`);
  }

  const tmpIn = `/tmp/hero-source-${process.pid}-${randomUUID()}.mp4`;
  const tmpOut = `/tmp/hero-optimised-${process.pid}-${randomUUID()}.mp4`;
  try {
    // 1. Download — we ALWAYS download because the skip decision is gated
    // on a structural + C2PA scan of the bytes, not on metadata alone. A
    // 200 KB MP4 can still be HEVC, can still carry a C2PA `jumb` box,
    // can still have its moov at the end of the file.
    await new Promise<void>((resolve, reject) => {
      const r = sourceFile.createReadStream();
      const w = fs.createWriteStream(tmpIn);
      r.on("error", reject);
      w.on("error", reject);
      w.on("finish", () => resolve());
      r.pipe(w);
    });

    // 1b. NO source-skip pass for MP4 inputs.
    //
    // Earlier rounds of this module had a skip-fast-pass: if the
    // source already met an N-of-checklist subset (codec/dims/bitrate
    // + structural scan), we'd reuse it as-is. The reviewer flagged
    // this as too permissive — to safely skip we'd need to verify
    // EVERY checklist item including exact-24-fps, stream-level
    // video bitrate, profile/level/pix_fmt, AND closed-GOP cadence.
    // Closed-GOP cadence is not robustly observable from ffprobe's
    // default output (would need per-frame `-show_frames` parsing,
    // which doesn't even guarantee deterministic GOP layout for the
    // bytes we'd actually serve back). So we always re-encode MP4 —
    // it's the only way to guarantee a deterministic compliant
    // output. Cost: ~10–20 s of CPU per admin save (admin uploads
    // are rare and authenticated).
    //
    // 2. Re-encode
    if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    const ffmpegCmd = [
      "ffmpeg",
      "-hide_banner",
      "-loglevel", "error",
      "-i", tmpIn,
      // ---- video ----
      "-c:v", "libx264",
      "-profile:v", "main",
      "-level:v", "4.0",
      "-preset", "medium",            // server-side runs synchronously inside the admin save, so favour speed over the last few % size win
      "-crf", "26",
      "-maxrate", "2200k",            // gives ~300 kbps headroom under the 2.5 Mbps stream-level cap so the verifier never trips
      "-bufsize", "4400k",
      "-pix_fmt", "yuv420p",
      "-vf", "scale='min(1600,iw)':-2:flags=lanczos",
      "-r", "24",
      "-g", "48",
      "-keyint_min", "48",
      "-sc_threshold", "0",
      // ---- audio ----
      "-c:a", "aac",
      "-b:a", "96k",
      "-ar", "48000",
      "-ac", "2",
      // ---- container ----
      "-movflags", "+faststart",
      "-map_metadata", "-1",
      tmpOut,
    ].join(" ");
    execSync(ffmpegCmd, { stdio: ["ignore", "pipe", "pipe"] });

    // Hard cap on the optimised buffer size — we only ever expect a few
    // megabytes for a hero loop. Anything larger means ffmpeg blew past
    // the budget and we abort before pulling it into memory.
    const outStat = fs.statSync(tmpOut);
    if (outStat.size > MAX_TOTAL_BYTES * 4) {
      throw new Error(`optimised file size ${outStat.size} exceeds hard cap (${MAX_TOTAL_BYTES * 4})`);
    }
    const buf = fs.readFileSync(tmpOut);

    // 3a-b. Structural + no-C2PA scan — held to the same byte-level
    // invariant the docs promise (faststart, no `uuid` atom, no
    // `c2pa`/`C2PA`/`jumb` markers anywhere).
    const cleanCheck = isMp4Clean(buf);
    if (!cleanCheck.ok) {
      throw new Error(`optimised MP4 failed structural scan: ${cleanCheck.reason}`);
    }

    // 3c. Budget verification — strict, stream-level. Both the overall
    // file bitrate AND the video stream bitrate must sit under the cap.
    const probeJson = execSync(
      `ffprobe -v error -show_streams -show_format -of json ${tmpOut}`,
      { encoding: "utf8" },
    );
    const probe = JSON.parse(probeJson);
    const v = probe.streams?.find((s: any) => s.codec_type === "video");
    if (!v) throw new Error("optimised MP4 has no video stream");
    const overallBitrate = Number(probe.format?.bit_rate || 0);
    const totalSize = Number(probe.format?.size || buf.length);
    const videoBitrate = Number(v.bit_rate || 0);
    const [fpsNum, fpsDen] = (v.r_frame_rate || "0/1").split("/").map(Number);
    const fps = fpsDen ? fpsNum / fpsDen : 0;
    const fails: string[] = [];
    if (totalSize > MAX_TOTAL_BYTES) fails.push(`size ${totalSize} > ${MAX_TOTAL_BYTES}`);
    if (overallBitrate > MAX_OVERALL_BITRATE) fails.push(`overall bitrate ${overallBitrate} > ${MAX_OVERALL_BITRATE}`);
    if (videoBitrate > MAX_VIDEO_BITRATE) fails.push(`video stream bitrate ${videoBitrate} > ${MAX_VIDEO_BITRATE}`);
    if (videoBitrate <= 0) fails.push("video stream bitrate missing from ffprobe output");
    if (Number(v.width) > MAX_VIDEO_WIDTH) fails.push(`width ${v.width} > ${MAX_VIDEO_WIDTH}`);
    if (Number(v.height) > MAX_VIDEO_HEIGHT) fails.push(`height ${v.height} > ${MAX_VIDEO_HEIGHT}`);
    if (Math.abs(fps - REQUIRED_FPS) > 0.1) fails.push(`fps ${fps.toFixed(2)} != ${REQUIRED_FPS} (±0.1)`);
    if (v.codec_name !== REQUIRED_VIDEO_CODEC) fails.push(`codec ${v.codec_name} != ${REQUIRED_VIDEO_CODEC}`);
    if (fails.length) {
      throw new Error(`optimised file out of budget: ${fails.join("; ")}`);
    }

    // 4. Upload as NEW private object
    const newId = randomUUID();
    const privateDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR env var is not set");
    const stripped = privateDir.startsWith("/") ? privateDir.slice(1) : privateDir;
    const slashIdx = stripped.indexOf("/");
    if (slashIdx < 0) throw new Error(`PRIVATE_OBJECT_DIR malformed: ${privateDir}`);
    const bucketName = stripped.slice(0, slashIdx);
    const objectPrefix = stripped.slice(slashIdx + 1);
    const newObjectName = `${objectPrefix}/uploads/${newId}`;
    const bucket = objectStorageClient.bucket(bucketName);
    const newFile = bucket.file(newObjectName);
    await newFile.save(buf, { contentType: "video/mp4", resumable: false });

    return {
      sourcePath: objectPath,
      optimisedPath: `/objects/uploads/${newId}`,
      sourceBytes,
      optimisedBytes: buf.length,
    };
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

/**
 * Walk the top-level MP4 atom layout and confirm the byte-level
 * invariants we require for hero-loop playback:
 *   - both `moov` and `mdat` are present
 *   - faststart is held (`moov` is the first non-`ftyp` / non-`free` atom)
 *   - NO top-level `uuid` atom anywhere (C2PA's content-credentials
 *     box uses a `uuid` atom containing the C2PA brand UUID, and
 *     Chrome refuses some such files with MEDIA_ERR_SRC_NOT_SUPPORTED;
 *     we reject ALL `uuid` atoms because nothing we encode legitimately
 *     emits one)
 *   - no `c2pa` / `C2PA` / `jumb` markers anywhere in the byte stream
 *     (defence-in-depth alongside the structural `uuid` rejection)
 * Returns `{ ok: true }` when clean, `{ ok: false, reason }` otherwise.
 */
function isMp4Clean(buf: Buffer): { ok: true } | { ok: false; reason: string } {
  let off = 0;
  let sawMoov = false;
  let sawMdat = false;
  let firstNonFtypType = "";
  let sawUuid = false;
  let uuidOffset = -1;
  while (off + 8 <= buf.length) {
    const size = buf.readUInt32BE(off);
    const type = buf.slice(off + 4, off + 8).toString("ascii");
    let realSize = size;
    let headerSize = 8;
    if (size === 1) {
      if (off + 16 > buf.length) break;
      realSize = Number(buf.readBigUInt64BE(off + 8));
      headerSize = 16;
    } else if (size === 0) {
      realSize = buf.length - off;
    }
    if (off > 0 && !firstNonFtypType && type !== "free") firstNonFtypType = type;
    if (type === "moov") sawMoov = true;
    if (type === "mdat") sawMdat = true;
    if (type === "uuid" && !sawUuid) { sawUuid = true; uuidOffset = off; }
    if (realSize < headerSize) break;
    off += realSize;
  }
  if (!sawMoov || !sawMdat) return { ok: false, reason: "missing moov or mdat atom" };
  if (firstNonFtypType !== "moov") {
    return { ok: false, reason: `faststart not held — expected moov as first atom after ftyp, got ${firstNonFtypType}` };
  }
  if (sawUuid) {
    return { ok: false, reason: `top-level 'uuid' atom present at byte ${uuidOffset} (C2PA / extension metadata — must be stripped)` };
  }
  const bin = buf.toString("binary");
  for (const marker of ["c2pa", "C2PA", "jumb"]) {
    const idx = bin.indexOf(marker);
    if (idx >= 0) return { ok: false, reason: `C2PA marker '${marker}' present at byte ${idx}` };
  }
  return { ok: true };
}

/**
 * Best-effort wrapper for use inside route handlers. If optimisation
 * succeeds, returns the new path. If it fails for ANY reason (ffmpeg
 * missing, network error, budget violation), logs the failure and
 * returns the original path so the admin's upload is never lost.
 *
 * Detects the source content-type via object-storage metadata FIRST so
 * non-MP4 uploads (WebM is the common case — already efficient codec)
 * are cleanly short-circuited with a `[hero-optimize] skipped (<type>)`
 * log line, NOT routed through the catch-block error log.
 */
export async function safeOptimizeHeroVideoIfMp4(
  videoUrl: string,
): Promise<string> {
  // Only handle our own object-storage uploads.
  if (!videoUrl || !videoUrl.startsWith("/objects/uploads/")) return videoUrl;

  // Cheap content-type lookup against the object metadata BEFORE we
  // start the ffmpeg pipeline. Anything other than video/mp4 is a clean
  // skip — log at info level, not as a failure.
  try {
    const svc = new ObjectStorageService();
    const file = await svc.getObjectEntityFile(videoUrl);
    const [meta] = await file.getMetadata();
    const ct = (meta.contentType || "").toLowerCase();
    if (!ct.startsWith("video/mp4")) {
      console.log(`[hero-optimize] skipped (content-type=${ct || "<unset>"}) ${videoUrl}`);
      return videoUrl;
    }
  } catch (err) {
    // Couldn't read metadata — fall through and let optimizeHeroVideoObject
    // attempt the full pipeline; if it also fails the catch below preserves
    // the admin's upload.
    console.warn(`[hero-optimize] could not read metadata for ${videoUrl} — proceeding with full pipeline`);
  }

  try {
    const t0 = Date.now();
    const result = await optimizeHeroVideoObject(videoUrl);
    const dtMs = Date.now() - t0;
    const before = (result.sourceBytes / 1024 / 1024).toFixed(2);
    const after = (result.optimisedBytes / 1024 / 1024).toFixed(2);
    const pct = result.sourceBytes
      ? Math.round((1 - result.optimisedBytes / result.sourceBytes) * 100)
      : 0;
    console.log(
      `[hero-optimize] ${videoUrl} -> ${result.optimisedPath} (${before}MB -> ${after}MB, ${pct}% smaller, ${dtMs}ms)`,
    );
    return result.optimisedPath;
  } catch (err) {
    console.error(
      `[hero-optimize] FAILED for ${videoUrl} — keeping original. Reason:`,
      err,
    );
    return videoUrl;
  }
}
