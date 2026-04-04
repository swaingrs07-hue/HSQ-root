import { useState, useCallback } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import type { UppyFile, UploadResult } from "@uppy/core";
import DashboardModal from "@uppy/react/dashboard-modal";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";
import AwsS3 from "@uppy/aws-s3";
import { Button } from "@/components/ui/button";

function compressImageFile(
  file: File,
  maxSizeBytes: number,
  maxDimension: number = 3840,
): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
      resolve(file);
      return;
    }

    if (file.size <= maxSizeBytes) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      const scaleFactor = Math.sqrt(maxSizeBytes / file.size);
      const sizeBasedMax = Math.max(
        Math.round(Math.max(width, height) * Math.min(scaleFactor * 1.5, 1)),
        1920,
      );
      const effectiveMax = Math.min(maxDimension, sizeBasedMax);

      if (width > effectiveMax || height > effectiveMax) {
        const ratio = Math.min(effectiveMax / width, effectiveMax / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      const supportsWebp = canvas.toDataURL("image/webp").startsWith("data:image/webp");
      const outputMime = supportsWebp ? "image/webp" : "image/jpeg";
      const outputExt = supportsWebp ? ".webp" : ".jpg";

      const tryQuality = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Compression failed"));
              return;
            }
            if (blob.size <= maxSizeBytes || quality <= 0.4) {
              const baseName = file.name.replace(/\.[^/.]+$/, "");
              resolve(
                new File([blob], `${baseName}${outputExt}`, {
                  type: outputMime,
                  lastModified: Date.now(),
                }),
              );
            } else {
              tryQuality(quality - 0.05);
            }
          },
          outputMime,
          quality,
        );
      };
      tryQuality(0.92);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: (
    file: UppyFile<Record<string, unknown>, Record<string, unknown>>,
  ) => Promise<{
    method: "PUT";
    url: string;
    headers?: Record<string, string>;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>,
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
}

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760,
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);

  const wrappedGetUploadParameters = useCallback(
    async (
      file: UppyFile<Record<string, unknown>, Record<string, unknown>>,
    ) => {
      return onGetUploadParameters(file);
    },
    [onGetUploadParameters],
  );

  const [uppy] = useState(() => {
    const instance = new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize: maxFileSize * 3,
      },
      autoProceed: false,
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: wrappedGetUploadParameters,
      })
      .on("complete", (result) => {
        onComplete?.(result);
      });

    instance.addPreProcessor(async (fileIDs: string[]) => {
      for (const fileID of fileIDs) {
        const uppyFile = instance.getFile(fileID);
        if (!uppyFile || !uppyFile.data) continue;

        const originalFile =
          uppyFile.data instanceof File
            ? uppyFile.data
            : new File([uppyFile.data], uppyFile.name, {
                type: uppyFile.type || "application/octet-stream",
              });

        if (
          !originalFile.type.startsWith("image/") ||
          originalFile.size <= maxFileSize
        ) {
          continue;
        }

        try {
          instance.setFileState(fileID, {
            progress: { uploadStarted: Date.now(), uploadComplete: false, percentage: 0 } as any,
          });

          const compressed = await compressImageFile(
            originalFile,
            maxFileSize,
          );

          instance.setFileState(fileID, {
            data: compressed,
            size: compressed.size,
            name: compressed.name,
            type: compressed.type,
            progress: { uploadStarted: null, uploadComplete: false, percentage: 0 } as any,
          });
        } catch (err) {
          console.warn(
            `Image compression failed for ${uppyFile.name}, uploading original`,
            err,
          );
        }
      }
    });

    return instance;
  });

  return (
    <div>
      <Button
        onClick={() => setShowModal(true)}
        className={buttonClassName}
        data-testid="button-upload-files"
      >
        {children}
      </Button>

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => setShowModal(false)}
        proudlyDisplayPoweredByUppy={false}
      />
    </div>
  );
}
