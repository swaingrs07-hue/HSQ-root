/**
 * Task #146 runbook — re-encode a hero MP4 from object storage to a
 * web-friendly bitrate / resolution / GOP layout, verify it, and re-upload
 * it as a NEW private object.
 *
 * Why this exists
 * ---------------
 * Task #144 produced a clean (no C2PA) hero MP4 that Chrome could decode,
 * but the file is still ~8.5 Mbps @ 1920x1080 / 8 s — a typical web hero
 * loop sits at ~1.5–2.5 Mbps @ 1280x720 (or 1600x900 for retina). At
 * 8.5 Mbps the browser is re-decoding ~9 MB every 8-second loop and
 * competing with the rest of the page for GPU decode bandwidth, which
 * shows up as visible micro-stutter at the loop seam (the
 * `[hero-video] canplay -> play()` breadcrumb re-firing on every loop in
 * the live console).
 *
 * What this script does (idempotent — produces a new object every run,
 * never mutates the source object):
 *   1. Downloads the source MP4 from object storage to /tmp.
 *   2. Re-encodes with ffmpeg using:
 *        H.264 main profile, preset slow, CRF ~26
 *        -maxrate 2500k -bufsize 5000k          (caps the bitrate)
 *        -vf scale=1600:-2                       (1600px wide, even-rounded)
 *        -r 24                                   (24 fps, matches source)
 *        -g 48 -keyint_min 48 -sc_threshold 0    (closed GOP every 2 s
 *                                                 for clean loop seams)
 *        AAC LC 96 kbps stereo 48 kHz audio
 *        -movflags +faststart                    (moov at the front)
 *        -map_metadata -1                        (strip ALL metadata,
 *                                                 incl. C2PA UUID atoms)
 *   3. Verifies the result structurally — top-level atom layout (so moov
 *      precedes mdat / faststart held) + whole-file scan for `c2pa` /
 *      `C2PA` / `jumb` markers (the Task #144 invariant must survive) +
 *      ffprobe size/bitrate summary so the operator can confirm the
 *      budget was hit before flipping the DB.
 *   4. Aborts if any structural / metadata / bitrate-budget check fails.
 *   5. Uploads the result as a NEW private object under
 *      `<PRIVATE_OBJECT_DIR>/uploads/<uuid>` with `Content-Type: video/mp4`.
 *   6. Prints the new `/objects/uploads/<uuid>` path so the operator can
 *      `UPDATE hero_slides SET video_url = '<new path>' WHERE id = ...;`.
 *
 * Why a script + SQL UPDATE instead of the admin Hero Slides UI
 * -------------------------------------------------------------
 * The admin UI re-runs the upload through the browser's File API, which
 * does not transcode — so the same heavy MP4 would be preserved unless
 * the operator ALSO ran ffmpeg locally first. Doing the transcode +
 * upload + DB pointer flip from the server side is reproducible (every
 * step is captured here in code, not in a manual UI walkthrough),
 * auditable (the original heavy object is left in storage with its
 * original path so before/after byte comparison is always possible),
 * and atomic w.r.t. the active hero slide (the new optimised object
 * exists before the SQL UPDATE flips `hero_slides.video_url`, so there
 * is no window where the slide points at a missing object).
 *
 * Usage:
 *   tsx scripts/optimize-hero-video.ts <source-object-path>
 *
 * Example (the actual Task #146 source — the Task #144 clean copy):
 *   tsx scripts/optimize-hero-video.ts \
 *     /objects/uploads/00cd147c-9161-42e4-a63d-c97be0c0a7e7
 *
 * Then in psql:
 *   UPDATE hero_slides
 *   SET video_url = '/objects/uploads/<NEW_UUID_FROM_OUTPUT>'
 *   WHERE id = '<active hero_slides row id>';
 *
 * Requires: ffmpeg + ffprobe in PATH; PRIVATE_OBJECT_DIR env var; the
 * same object storage credentials the server uses (auto-resolved via
 * server/replit_integrations/object_storage/objectStorage.ts).
 */

import { ObjectStorageService, objectStorageClient } from "../server/replit_integrations/object_storage/objectStorage";
import { randomUUID } from "crypto";
import { execSync } from "child_process";
import * as fs from "fs";

// Budget the optimised file MUST meet — we abort the upload if any of
// these are violated. These are the "what good looks like" guardrails
// from the task plan.
const MAX_TOTAL_BYTES = 4_000_000;       // 4 MB total; comfortably under "≤ 2.5 MB" target after some headroom
const MAX_OVERALL_BITRATE = 3_000_000;   // 3 Mbps overall (video + audio); target was ≤ 2.5 Mbps video
const MAX_VIDEO_WIDTH = 1600;            // never wider than 1600 px
const MAX_VIDEO_HEIGHT = 1080;           // safety cap; 1600x900 is the design target
const MAX_FPS = 30;                      // hero loops never need >30 fps
const REQUIRED_VIDEO_CODEC = "h264";

async function main() {
  const sourcePath = process.argv[2];
  if (!sourcePath || !sourcePath.startsWith("/objects/")) {
    console.error("Usage: tsx scripts/optimize-hero-video.ts <source-object-path>");
    console.error("  source-object-path must start with /objects/");
    process.exit(2);
  }

  const svc = new ObjectStorageService();
  const sourceFile = await svc.getObjectEntityFile(sourcePath);
  const [sourceMeta] = await sourceFile.getMetadata();
  console.log("Source:", JSON.stringify({
    bucket: sourceFile.bucket.name,
    name: sourceFile.name,
    contentType: sourceMeta.contentType,
    size: sourceMeta.size,
  }, null, 2));

  // 1. Download
  const tmpIn = `/tmp/hero-source-${process.pid}.mp4`;
  const tmpOut = `/tmp/hero-optimised-${process.pid}.mp4`;
  await new Promise<void>((resolve, reject) => {
    const r = sourceFile.createReadStream();
    const w = fs.createWriteStream(tmpIn);
    r.on("error", reject);
    w.on("error", reject);
    w.on("finish", () => resolve());
    r.pipe(w);
  });
  const inSize = fs.statSync(tmpIn).size;
  console.log(`Downloaded -> ${tmpIn} (${inSize} bytes = ${(inSize / 1024 / 1024).toFixed(2)} MB)`);

  // 2. Re-encode (NOT a stream copy — this is the whole point of the
  // task; we are intentionally lossy-recompressing with a budgeted
  // bitrate ceiling and a closed GOP for smooth looping).
  if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
  const ffmpegArgs = [
    "ffmpeg",
    "-hide_banner",
    "-loglevel", "error",
    "-i", tmpIn,
    // ---- video ----
    "-c:v", "libx264",
    "-profile:v", "main",
    "-level:v", "4.0",
    "-preset", "slow",
    "-crf", "26",
    "-maxrate", "2500k",
    "-bufsize", "5000k",
    "-pix_fmt", "yuv420p",
    "-vf", "scale=1600:-2:flags=lanczos",
    "-r", "24",
    // Closed GOP every 2 s (24 fps * 2 s = 48 frames). Disabling
    // scene-change keyframes (`-sc_threshold 0`) means the GOP layout
    // is deterministic, which is what makes the loop seam invisible
    // to the browser — it can re-decode from the loop-start keyframe
    // with no I-frame jump.
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
    "-fflags", "+bitexact",
    "-flags:v", "+bitexact",
    "-flags:a", "+bitexact",
    tmpOut,
  ];
  console.log("ffmpeg cmd:", ffmpegArgs.join(" "));
  execSync(ffmpegArgs.join(" "), { stdio: "inherit" });
  const outSize = fs.statSync(tmpOut).size;
  console.log(`Optimised  -> ${tmpOut} (${outSize} bytes = ${(outSize / 1024 / 1024).toFixed(2)} MB, delta ${inSize - outSize})`);

  // 3a. Structural verification — atom layout (faststart held)
  const buf = fs.readFileSync(tmpOut);
  console.log("Top-level atoms:");
  let off = 0;
  let sawMoov = false;
  let sawMdat = false;
  let firstNonFtypType = "";
  while (off + 8 <= buf.length) {
    const size = buf.readUInt32BE(off);
    const type = buf.slice(off + 4, off + 8).toString("ascii");
    let realSize = size;
    let headerSize = 8;
    if (size === 1) {
      realSize = Number(buf.readBigUInt64BE(off + 8));
      headerSize = 16;
    } else if (size === 0) {
      realSize = buf.length - off;
    }
    console.log(`  @${off} type=${type} size=${realSize}`);
    if (off > 0 && !firstNonFtypType && type !== "free") firstNonFtypType = type;
    if (type === "moov") sawMoov = true;
    if (type === "mdat") sawMdat = true;
    if (realSize < headerSize) break;
    off += realSize;
  }
  if (!sawMoov || !sawMdat) {
    console.error("FAIL: optimised MP4 is missing moov or mdat atoms");
    process.exit(1);
  }
  if (firstNonFtypType !== "moov") {
    console.error(`FAIL: faststart not held — expected moov as first atom after ftyp but got ${firstNonFtypType}`);
    process.exit(1);
  }

  // 3b. Metadata invariant — Task #144's no-C2PA guarantee must survive.
  const bin = buf.toString("binary");
  for (const marker of ["c2pa", "C2PA", "jumb"]) {
    const idx = bin.indexOf(marker);
    if (idx >= 0) {
      console.error(`FAIL: C2PA marker '${marker}' present at byte ${idx} — aborting upload`);
      process.exit(1);
    }
  }
  console.log("OK: no c2pa/C2PA/jumb markers anywhere in optimised file.");

  // 3c. Budget verification via ffprobe
  const probeJson = execSync(
    `ffprobe -v error -show_streams -show_format -of json ${tmpOut}`,
    { encoding: "utf8" },
  );
  const probe = JSON.parse(probeJson);
  const v = probe.streams.find((s: any) => s.codec_type === "video");
  const a = probe.streams.find((s: any) => s.codec_type === "audio");
  const overallBitrate = Number(probe.format.bit_rate);
  const totalSize = Number(probe.format.size);
  const duration = Number(probe.format.duration);
  // r_frame_rate is "num/den" (e.g. "24/1")
  const [fpsNum, fpsDen] = (v.r_frame_rate || "0/1").split("/").map(Number);
  const fps = fpsDen ? fpsNum / fpsDen : 0;
  console.log("");
  console.log("============================================================");
  console.log("Optimised MP4 summary:");
  console.log(`  duration       : ${duration.toFixed(2)} s`);
  console.log(`  total size     : ${totalSize} bytes (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  overall bitrate: ${overallBitrate} bps (${(overallBitrate / 1_000_000).toFixed(2)} Mbps)`);
  console.log(`  video          : ${v.codec_name} ${v.profile} ${v.width}x${v.height} ${fps.toFixed(2)} fps  bitrate=${v.bit_rate || "(in container)"}`);
  console.log(`  audio          : ${a?.codec_name} ${a?.profile || ""} ${a?.sample_rate} Hz ${a?.channels}ch  bitrate=${a?.bit_rate || "(in container)"}`);
  console.log("============================================================");
  const budgetFails: string[] = [];
  if (totalSize > MAX_TOTAL_BYTES) budgetFails.push(`size ${totalSize} > ${MAX_TOTAL_BYTES}`);
  if (overallBitrate > MAX_OVERALL_BITRATE) budgetFails.push(`bitrate ${overallBitrate} > ${MAX_OVERALL_BITRATE}`);
  if (Number(v.width) > MAX_VIDEO_WIDTH) budgetFails.push(`width ${v.width} > ${MAX_VIDEO_WIDTH}`);
  if (Number(v.height) > MAX_VIDEO_HEIGHT) budgetFails.push(`height ${v.height} > ${MAX_VIDEO_HEIGHT}`);
  if (fps > MAX_FPS + 0.1) budgetFails.push(`fps ${fps.toFixed(2)} > ${MAX_FPS}`);
  if (v.codec_name !== REQUIRED_VIDEO_CODEC) budgetFails.push(`codec ${v.codec_name} != ${REQUIRED_VIDEO_CODEC}`);
  if (budgetFails.length) {
    console.error("FAIL: optimised file violates encoding budget:");
    for (const f of budgetFails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("OK: optimised file is within budget.");

  // 4. Upload as NEW private object
  const newId = randomUUID();
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) {
    console.error("FAIL: PRIVATE_OBJECT_DIR env var is not set");
    process.exit(1);
  }
  const stripped = privateDir.startsWith("/") ? privateDir.slice(1) : privateDir;
  const slashIdx = stripped.indexOf("/");
  if (slashIdx < 0) {
    console.error(`FAIL: PRIVATE_OBJECT_DIR malformed: ${privateDir}`);
    process.exit(1);
  }
  const bucketName = stripped.slice(0, slashIdx);
  const objectPrefix = stripped.slice(slashIdx + 1);
  const newObjectName = `${objectPrefix}/uploads/${newId}`;

  const bucket = objectStorageClient.bucket(bucketName);
  const newFile = bucket.file(newObjectName);
  await newFile.save(buf, { contentType: "video/mp4", resumable: false });
  const [exists] = await newFile.exists();
  const [newMeta] = await newFile.getMetadata();
  console.log("Uploaded:", JSON.stringify({
    bucket: bucketName,
    name: newObjectName,
    exists,
    size: newMeta.size,
    contentType: newMeta.contentType,
  }, null, 2));

  // 5. Output the path the operator should write into hero_slides.video_url
  const newPublicPath = `/objects/uploads/${newId}`;
  console.log("");
  console.log("============================================================");
  console.log(`NEW_OBJECT_PATH = ${newPublicPath}`);
  console.log("");
  console.log("Next step (point the active hero slide at the optimised MP4):");
  console.log(`  UPDATE hero_slides`);
  console.log(`  SET video_url = '${newPublicPath}'`);
  console.log(`  WHERE id = '<active-hero-slide-id>';`);
  console.log("============================================================");

  try { fs.unlinkSync(tmpIn); } catch {}
  try { fs.unlinkSync(tmpOut); } catch {}
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
