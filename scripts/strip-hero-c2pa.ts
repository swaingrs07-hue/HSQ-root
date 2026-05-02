/**
 * Task #144 runbook — strip C2PA "content credentials" metadata from a hero
 * MP4 stored in object storage and re-upload it as a new clean object.
 *
 * Why this exists
 * ---------------
 * The original homepage hero MP4 was exported by an editor that embedded a
 * ~6KB C2PA UUID atom (signature `d8fe c3d6 1b0e 483c 9297 5828 877e c481`)
 * right after `ftyp`. Chrome's media stack rejected the file with
 * MEDIA_ERR_SRC_NOT_SUPPORTED (code 4) on every fresh page load. The fix is
 * to re-export the file with metadata stripped (and `+faststart` so `moov`
 * sits at the front for progressive playback) and point the active
 * `hero_slides` row at the new clean object.
 *
 * What this script does (idempotent — produces a new object every run, never
 * mutates the source object):
 *   1. Downloads the source MP4 from object storage to /tmp.
 *   2. Runs `ffmpeg -map_metadata -1 -movflags +faststart -c copy` to strip
 *      ALL container/metadata atoms (incl. C2PA `uuid`) without re-encoding
 *      the H.264 video or AAC audio streams.
 *   3. Verifies the cleaned file structurally — top-level atom layout +
 *      whole-file scan for `c2pa` / `C2PA` / `jumb` markers — and aborts if
 *      any C2PA marker survives.
 *   4. Uploads the cleaned MP4 as a NEW private object under
 *      `<PRIVATE_OBJECT_DIR>/uploads/<uuid>` with `Content-Type: video/mp4`.
 *   5. Prints the new `/objects/uploads/<uuid>` path so the operator can
 *      `UPDATE hero_slides SET video_url = '<new path>' WHERE id = '<row>'`.
 *
 * Why this script (and a SQL UPDATE) were used instead of the admin Hero
 * Slides UI for Task #144
 * --------------------------------------------------------------------
 * The admin UI re-runs the upload through the browser's File API, which
 * does not strip container metadata — so the C2PA `uuid` atom would have
 * been preserved unless the operator ALSO ran ffmpeg locally first. Doing
 * the strip + upload + DB pointer flip from the server side is:
 *   - Reproducible: every step is captured here in code, not in a manual
 *     UI walkthrough that can drift.
 *   - Auditable: the original broken object is left in storage with its
 *     original path, so before/after byte comparison and atom inspection
 *     are always possible.
 *   - Atomic w.r.t. the active hero slide: the new clean object exists
 *     before the SQL UPDATE flips `hero_slides.video_url`, so there is no
 *     window where the slide points at a missing object.
 * The admin UI remains the right tool for routine new-slide uploads from
 * already-clean source files; this script is the right tool for one-shot
 * remediation of an existing broken object.
 *
 * Usage:
 *   tsx scripts/strip-hero-c2pa.ts <source-object-path>
 *
 * Example (the actual Task #144 source):
 *   tsx scripts/strip-hero-c2pa.ts \
 *     /objects/uploads/4a07bb84-6ffb-4f8a-a8f7-61b274fa4810
 *
 * Then in psql:
 *   UPDATE hero_slides
 *   SET video_url = '/objects/uploads/<NEW_UUID_FROM_OUTPUT>'
 *   WHERE id = '<active hero_slides row id>';
 *
 * Requires: ffmpeg in PATH; PRIVATE_OBJECT_DIR env var; the same object
 * storage credentials the server uses (auto-resolved via
 * server/replit_integrations/object_storage/objectStorage.ts).
 */

import { ObjectStorageService, objectStorageClient } from "../server/replit_integrations/object_storage/objectStorage";
import { randomUUID } from "crypto";
import { execSync } from "child_process";
import * as fs from "fs";

async function main() {
  const sourcePath = process.argv[2];
  if (!sourcePath || !sourcePath.startsWith("/objects/")) {
    console.error("Usage: tsx scripts/strip-hero-c2pa.ts <source-object-path>");
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
  const tmpOut = `/tmp/hero-clean-${process.pid}.mp4`;
  await new Promise<void>((resolve, reject) => {
    const r = sourceFile.createReadStream();
    const w = fs.createWriteStream(tmpIn);
    r.on("error", reject);
    w.on("error", reject);
    w.on("finish", () => resolve());
    r.pipe(w);
  });
  const inSize = fs.statSync(tmpIn).size;
  console.log(`Downloaded -> ${tmpIn} (${inSize} bytes)`);

  // 2. Strip metadata + faststart (no re-encode)
  if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
  execSync(
    `ffmpeg -hide_banner -loglevel error -i ${tmpIn} -map_metadata -1 -movflags +faststart -c copy ${tmpOut}`,
    { stdio: "inherit" },
  );
  const outSize = fs.statSync(tmpOut).size;
  console.log(`Cleaned    -> ${tmpOut} (${outSize} bytes, delta ${inSize - outSize})`);

  // 3. Structural verification
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
    console.error("FAIL: cleaned MP4 is missing moov or mdat atoms");
    process.exit(1);
  }
  if (firstNonFtypType !== "moov") {
    console.warn(`WARN: expected moov as first atom after ftyp (faststart) but got ${firstNonFtypType}`);
  }
  const bin = buf.toString("binary");
  for (const marker of ["c2pa", "C2PA", "jumb"]) {
    const idx = bin.indexOf(marker);
    if (idx >= 0) {
      console.error(`FAIL: C2PA marker '${marker}' still present at byte ${idx} — aborting upload`);
      process.exit(1);
    }
  }
  console.log("OK: no c2pa/C2PA/jumb markers anywhere in cleaned file.");

  // 4. Upload as NEW private object (do NOT overwrite the source)
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
  console.log("Next step (point the active hero slide at the clean MP4):");
  console.log(`  UPDATE hero_slides`);
  console.log(`  SET video_url = '${newPublicPath}'`);
  console.log(`  WHERE id = '<active-hero-slide-id>';`);
  console.log("============================================================");

  // Tidy up temp files
  try { fs.unlinkSync(tmpIn); } catch {}
  try { fs.unlinkSync(tmpOut); } catch {}
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
