import sharp from "sharp";
import fs from "fs-extra";
import * as path from "path";
import { typedKeys } from "@shared/utils/index";

sharp.cache({ files: 0 });

/**
 * 在當前執行環境中，取得 sharp 支援的圖片格式清單
 */
const getSupportedFormats = () => {
  const formatKeys = typedKeys(sharp.format);
  return formatKeys.filter((format) => sharp.format[format].input.buffer || sharp.format[format].input.file);
};

/**
 * 取得 sharp 支援的圖片副檔名清單
 */
const getSupportedExtensions = () => {
  const formats = getSupportedFormats();
  const exts = formats.filter((v) => typeof v === "string").map((v) => v.toLowerCase());

  if (exts.includes("jpeg")) exts.push("jpg");
  if (exts.includes("jpg")) exts.push("jpeg");
  if (exts.includes("tiff")) exts.push("tif");
  if (exts.includes("tif")) exts.push("tiff");

  const set = new Set(exts.map((v) => `.${v}`));
  set.delete(".raw"); // 排除 raw 格式，因為其實際上不是圖片格式
  return set;
};

/**
 * 當前環境支援的圖片副檔名集合
 */
const supportedExtensions = getSupportedExtensions();

/**
 * 圖片的元資料
 * 註：為修復 icc, exif 等資料可能導致序列化錯誤的問題，改為只保留必要的欄位
 */
type ImageMetadata = { filePath: string; fileName: string } & Pick<
  sharp.Metadata,
  "width" | "height" | "format" | "space" | "channels" | "hasAlpha"
>;

/**
 * 打開單一圖片檔案，並回傳其 metadata，若非圖片或無法讀取則回傳 null
 */
async function openImage(filePath: string): Promise<ImageMetadata | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (!supportedExtensions.has(ext)) return null;

  try {
    const metadata = await sharp(filePath).metadata();

    return {
      filePath,
      fileName: path.basename(filePath),
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      space: metadata.space,
      channels: metadata.channels,
      hasAlpha: metadata.hasAlpha,
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return null;
  }
}

type ProgressCallback = (message: string, percent: number) => void;

/**
 * 打開多個圖片檔案,並回傳其 metadata 陣列,非圖片或無法讀取的檔案會被忽略
 */
async function openImages(filePaths: string[], onProgress?: ProgressCallback): Promise<ImageMetadata[]>;
/**
 * 打開資料夾中的所有圖片檔案,並回傳其 metadata 陣列
 */
async function openImages(fileFolder: string, onProgress?: ProgressCallback): Promise<ImageMetadata[]>;
async function openImages(input: string | string[], onProgress?: ProgressCallback): Promise<ImageMetadata[]> {
  let filePaths: string[];
  onProgress?.("正在讀取圖片...", 0);

  if (typeof input === "string") {
    if (!fs.existsSync(input) || !fs.statSync(input).isDirectory()) {
      onProgress?.("指定的資料夾不存在或不是資料夾", 100);
      return [];
    }

    const files = fs.readdirSync(input);
    filePaths = files.map((file) => path.join(input, file));
  } else {
    filePaths = input;
  }

  const total = filePaths.length;
  let completed = 0;

  const metadataPromises = filePaths.map(async (filePath) => {
    const result = await openImage(filePath);
    completed++;
    const progress = Math.floor((completed / total) * 100 - 1);
    onProgress?.(`正在讀取圖片 (${completed}/${total})`, progress);
    return result;
  });

  const metadataResults = await Promise.all(metadataPromises);

  onProgress?.("圖片讀取完成", 100);
  return metadataResults.filter((metadata) => metadata !== null);
}

/**
 * 給定一個 sharp.Sharp 物件，將其轉換為指定格式的 base64 字串
 */
async function sharpToBase64(image: sharp.Sharp, format: "png" | "jpeg" | "webp" = "png"): Promise<string> {
  let buffer: Buffer;

  if (format === "webp") {
    buffer = await image.webp().toBuffer();
  } else if (format === "jpeg") {
    buffer = await image.jpeg().toBuffer();
  } else {
    buffer = await image.png().toBuffer();
  }

  return buffer.toString("base64");
}

// 根據 720x480 (SD) 的總像素點數來定義縮圖的門檻。
const PIXELS_THRESHOLD_1K: number = 720 * 480; // 345600

/**
 * 給定一個檔案路徑(假設已經確認是圖片)，若其解析度超過 720x480 (SD)，則壓縮後回傳 base64 字串，否則原圖轉 base64 回傳
 */
async function generateThumbnail(filePath: string): Promise<string | null> {
  const metadata = await openImage(filePath);
  if (!metadata) return null;

  const image = sharp(filePath);

  if (metadata.width && metadata.height && metadata.width * metadata.height > PIXELS_THRESHOLD_1K) {
    const { width, height } = metadata;

    const originalTotalPixels = width * height;
    const scaleFactor = Math.sqrt(PIXELS_THRESHOLD_1K / originalTotalPixels);
    const targetWidth = Math.floor(width * scaleFactor);

    return sharpToBase64(image.resize({ width: targetWidth }), "webp");
  } else {
    return sharpToBase64(image, "webp");
  }
}

export { openImage, openImages, generateThumbnail };
export type { ImageMetadata };
