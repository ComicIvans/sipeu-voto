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
 * Decoded formats we accept; the file name is never trusted. The list matches
 * what the pickers offer and what the error message names, so the server is
 * never quietly more permissive than the interface.
 *
 * AVIF reports itself as `heif` because it shares that container, which is why
 * `compression` has to be checked too: an iPhone HEIC is the same container
 * with HEVC inside, and the prebuilt sharp binaries decode its metadata but
 * fail on the pixels. Without that split the user gets "file is damaged"
 * instead of being told to export as JPG.
 */
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif'])
const ALLOWED_HEIF_COMPRESSION = 'av1'
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

/** Returns false when there was a file to remove and removing it failed. */
export async function deleteImageFile(publicPath: string | null | undefined) {
  if (!publicPath) return true
  const filename = getImageFilename(publicPath)
  if (!filename) return true
  try {
    await unlink(join(getImagesDir(), filename))
    return true
  } catch (error) {
    // Already gone is the common case and not worth reporting.
    return (error as NodeJS.ErrnoException).code === 'ENOENT'
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
  if (metadata.format === 'heif' && metadata.compression !== ALLOWED_HEIF_COMPRESSION) {
    throw apiError(400, 'imageUnsupportedFormat')
  }
  if (!metadata.width || !metadata.height) throw apiError(400, 'imageInvalidFile')

  // The minimum is about the picture people will see, and the pipeline below
  // calls `rotate()`, which applies the EXIF orientation. Tags 5 to 8 turn the
  // image a quarter turn, so the stored dimensions arrive swapped: a phone
  // photo stored 450x800 and displayed 800x450 clears a 800x450 minimum, and
  // one stored 800x450 and displayed 450x800 does not.
  const turned = (metadata.orientation ?? 1) >= 5 && (metadata.orientation ?? 1) <= 8
  const width = turned ? metadata.height : metadata.width
  const height = turned ? metadata.width : metadata.height
  if (width < kind.minWidth || height < kind.minHeight) {
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
 * Removes a file nothing points at any more, and reports it when the removal
 * actually fails. A stray file is harmless; saying the operation failed when
 * the reference is already stored would not be. Every path that drops a file
 * goes through here, so a full disk or a read-only mount leaves a trace.
 */
export async function discardEntityImage(publicPath: string | null, context: string) {
  const removed = await deleteImageFile(publicPath)
  if (!removed) logError('image.discard', new Error('file not removed'), { context, publicPath })
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
    await discardEntityImage(publicPath, `${options.context}:rejected`)
    throw error
  }

  await discardEntityImage(previous, `${options.context}:replaced`)
  return publicPath
}

/** Clears a reference first, then removes the file it pointed at. */
export async function clearEntityImage(apply: () => Promise<string | null>, context: string) {
  const previous = await apply()
  await discardEntityImage(previous, `${context}:cleared`)
  return previous
}
