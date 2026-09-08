import { randomBytes } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, resolve } from 'node:path'
import sharp from 'sharp'
import { apiError } from './apiErrorMessages'
import { logError } from './logger'

/**
 * Every image the app stores goes through here: user photos, group logos and
 * committee covers. Files live together under `${APP_DATA_DIR}/avatars` and are
 * always re-encoded to WebP, which drops the original bytes, the metadata and
 * any surprise inside them.
 */

/**
 * Decoded formats we accept; the file name is never trusted. AVIF reports
 * itself as `heif` because it shares that container. Real HEIC from an iPhone
 * is HEVC-coded and the prebuilt sharp binaries cannot decode it, so it is not
 * offered anywhere: `sharp.format.heif` lists `.avif` only.
 */
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'gif', 'heif', 'tiff'])
const MAX_FILE_SIZE = 8 * 1024 * 1024
const MAX_INPUT_PIXELS = 60_000_000

export interface ImageKind {
  /** File name prefix, so the directory stays readable. */
  prefix: string
  width: number
  height: number
  fit: 'cover' | 'inside'
  /** Keep transparency (logos) or flatten onto a background (photos). */
  background: string | null
  minWidth: number
  minHeight: number
  /** Error key used when the source is too small for this kind. */
  tooSmallKey: 'imageTooSmallCover' | 'imageTooSmallLogo' | 'imageTooSmallAvatar'
}

export const IMAGE_KINDS = {
  /** Faces: square, cropped towards the subject, no transparency. */
  avatar: {
    prefix: 'avatar',
    width: 512,
    height: 512,
    fit: 'cover',
    background: '#ffffff',
    minWidth: 64,
    minHeight: 64,
    tooSmallKey: 'imageTooSmallAvatar',
  },
  /**
   * Logos: never cropped, never enlarged, transparency preserved. A wordmark
   * comes back wider than tall and is drawn inside a box with object-contain.
   */
  logo: {
    prefix: 'logo',
    width: 512,
    height: 512,
    fit: 'inside',
    background: null,
    minWidth: 64,
    minHeight: 64,
    tooSmallKey: 'imageTooSmallLogo',
  },
  /**
   * Covers: always exactly 16:9, cropped towards the busiest area. The minimum
   * is half the output, so the worst upscale is 2x. Accepting anything smaller
   * would mean either a blurry banner or an output that is not 16:9, and the
   * layout depends on that ratio.
   */
  cover: {
    prefix: 'cover',
    width: 1600,
    height: 900,
    fit: 'cover',
    background: '#ffffff',
    minWidth: 800,
    minHeight: 450,
    tooSmallKey: 'imageTooSmallCover',
  },
} satisfies Record<string, ImageKind>

export type ImageKindName = keyof typeof IMAGE_KINDS

export function getDataDir() {
  const configured = process.env.APP_DATA_DIR?.trim()
  if (!configured) return join(process.cwd(), 'data')
  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured)
}

export function getImagesDir() {
  return join(getDataDir(), 'avatars')
}

export function getImageFilename(publicPath: string) {
  const filename = basename(publicPath)
  if (!filename || filename === '.' || filename === '..') return null
  return filename
}

export async function deleteImageFile(publicPath: string | null | undefined) {
  if (!publicPath) return
  const filename = getImageFilename(publicPath)
  if (!filename) return
  try {
    await unlink(join(getImagesDir(), filename))
  } catch {
    // Already gone, or never written. Nothing to recover.
  }
}

/**
 * Validates and re-encodes. Animated sources keep their first frame only:
 * these are logos and banners, not videos.
 */
export async function processImage(kind: ImageKind, data: Buffer, context: string) {
  if (data.length > MAX_FILE_SIZE) throw apiError(400, 'imageTooLarge')

  const image = sharp(data, { limitInputPixels: MAX_INPUT_PIXELS })

  let metadata: sharp.Metadata
  try {
    metadata = await image.metadata()
  } catch (error) {
    logError('image.metadata', error, { context, inputBytes: data.length })
    throw apiError(400, 'imageInvalidFile')
  }

  // The decoded format decides, not the extension: a renamed SVG is caught
  // here. SVG is refused outright because rasterising untrusted vector files
  // adds parser surface we have no use for.
  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw apiError(400, 'imageUnsupportedFormat')
  }
  if (!metadata.width || !metadata.height) throw apiError(400, 'imageInvalidFile')
  if (metadata.width < kind.minWidth || metadata.height < kind.minHeight) {
    throw apiError(400, kind.tooSmallKey)
  }

  try {
    const pipeline = image.rotate().resize(kind.width, kind.height, {
      fit: kind.fit,
      position: 'attention',
      withoutEnlargement: kind.fit === 'inside',
    })
    if (kind.background) pipeline.flatten({ background: kind.background })
    return await pipeline.webp({ quality: 84 }).toBuffer()
  } catch (error) {
    logError('image.process', error, { context, inputBytes: data.length })
    throw apiError(400, 'imageInvalidFile')
  }
}

/**
 * Writes the file under a name nothing else can collide with. The random
 * suffix, rather than a timestamp, also guarantees a fresh URL on every
 * replacement, which is what makes the long cache header safe.
 */
export async function writeImageFile(kind: ImageKind, ownerId: string, output: Buffer) {
  const filename = `${kind.prefix}-${ownerId}-${randomBytes(8).toString('hex')}.webp`
  const dir = getImagesDir()

  try {
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, filename), output)
  } catch (error) {
    logError('image.write', error, { ownerId, dir })
    throw apiError(500, 'imageSaveFailed')
  }

  return `/avatars/${filename}`
}

/**
 * Writes the new file, hands the path to `apply`, and only deletes the file it
 * displaced once that reference is stored. `apply` returns the path it replaced
 * and must fail if the row is gone, so a picture is never left pointing at a
 * file that was already unlinked, and a rejected update never orphans one.
 */
export async function replaceEntityImage(options: {
  kind: ImageKind
  ownerId: string
  data: Buffer
  context: string
  apply: (publicPath: string) => Promise<string | null>
}) {
  const output = await processImage(options.kind, options.data, options.context)
  const publicPath = await writeImageFile(options.kind, options.ownerId, output)

  let previous: string | null
  try {
    previous = await options.apply(publicPath)
  } catch (error) {
    await deleteImageFile(publicPath)
    throw error
  }

  await deleteImageFile(previous)
  return publicPath
}

/** Clears a reference first, then removes the file it pointed at. */
export async function clearEntityImage(apply: () => Promise<string | null>) {
  const previous = await apply()
  await deleteImageFile(previous)
  return previous
}

/**
 * Removes the file of an entity that has just been deleted. A failure here
 * leaves a stray file, which is harmless; reporting the delete as failed when
 * the row is already gone would not be.
 */
export async function discardEntityImage(publicPath: string | null, context: string) {
  try {
    await deleteImageFile(publicPath)
  } catch (error) {
    logError('image.discard', error, { context, publicPath })
  }
}
