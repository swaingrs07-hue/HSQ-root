import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { verifyToken } from "../../auth";

/**
 * Register object storage routes for file uploads.
 *
 * This provides example routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading
 * 2. The client then uploads directly to the presigned URL
 *
 * IMPORTANT: These are example routes. Customize based on your use case:
 * - Add authentication middleware for protected uploads
 * - Add file metadata storage (save to database after upload)
 * - Add ACL policies for access control
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid"
   * }
   *
   * IMPORTANT: The client should NOT send the file to this endpoint.
   * Send JSON metadata only, then upload the file directly to uploadURL.
   */
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      // Require a valid JWT — only authenticated users may upload files.
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required to upload files" });
      }
      const payload = verifyToken(authHeader.split(" ")[1]);
      if (!payload) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * Handles paths like /objects/uploads/uuid
   * Express 5.x requires named params, so we use a regex route.
   */
  app.get(/^\/objects\/(.+)$/, async (req, res) => {
    try {
      const objectPath = req.path;
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      const [metadata] = await objectFile.getMetadata();
      const contentType = (metadata.contentType as string) || "application/octet-stream";
      const fileSize = parseInt(metadata.size as string, 10);

      const isImage = contentType.startsWith("image/");
      const isVideo = contentType.startsWith("video/");
      const cacheMaxAge = isImage ? 2592000 : 86400;

      if (isVideo && req.headers.range) {
        const range = req.headers.range;
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 2 * 1024 * 1024 - 1, fileSize - 1);
        const chunkSize = end - start + 1;

        res.status(206);
        res.set({
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": contentType,
          "Cache-Control": `public, max-age=${cacheMaxAge}, immutable`,
        });

        const stream = objectFile.createReadStream({ start, end });
        stream.on("error", (err) => {
          console.error("Video stream error:", err);
          if (!res.headersSent) res.status(500).end();
        });
        stream.pipe(res);
      } else {
        res.set({
          "Content-Type": contentType,
          "Content-Length": String(fileSize),
          "Cache-Control": `public, max-age=${cacheMaxAge}${isImage ? ", immutable" : ""}`,
        });
        if (isVideo) {
          res.set("Accept-Ranges", "bytes");
        }
        await objectStorageService.downloadObject(objectFile, res);
      }
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });

  app.get("/api/uploads/signed-url", async (req, res) => {
    try {
      const objectPath = req.query.path as string;
      if (!objectPath || !objectPath.startsWith("/objects/")) {
        return res.status(400).json({ error: "Invalid object path" });
      }
      const signedUrl = await objectStorageService.getSignedDownloadURL(objectPath, 3600);

      let contentType: string | undefined;
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
        const [metadata] = await objectFile.getMetadata();
        contentType = metadata.contentType as string;
      } catch (_) {}

      res.json({ url: signedUrl, ...(contentType ? { contentType } : {}) });
    } catch (error) {
      console.error("Error generating signed URL:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to generate signed URL" });
    }
  });

  app.get("/api/uploads/public/:id", async (req, res) => {
    try {
      const objectPath = `/objects/uploads/${req.params.id}`;
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving public upload:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

