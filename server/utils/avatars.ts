import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, resolve } from 'node:path'
import sharp from 'sharp'
import { apiError } from './apiErrorMessages'
import { logError } from './logger'

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.heic'])
const MAX_FILE_SIZE = 8 * 1024 * 1024
const AVATAR_SIZE = 512

export function getDataDir() {
  const configured = process.env.APP_DATA_DIR?.trim()
  if (!configured) return join(process.cwd(), 'data')
  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured)
}

export function getAvatarsDir() {
  return join(getDataDir(), 'avatars')
}

export function getAvatarFilename(publicPath: string) {
  const filename = basename(publicPath)
  if (!filename || filename === '.' || filename === '..') return null
  return filename
}

export async function deleteAvatarFile(publicPath: string | null | undefined) {
  if (!publicPath) return
  const filename = getAvatarFilename(publicPath)
  if (!filename) return
  try {
    await unlink(join(getAvatarsDir(), filename))
  } catch {
    // File may already be gone
  }
}

export async function saveAvatarImage(userId: string, data: Buffer, originalFilename: string) {
  if (data.length > MAX_FILE_SIZE) throw apiError(400, 'avatarTooLarge')

  const ext = extname(originalFilename).toLowerCase()
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) throw apiError(400, 'avatarInvalidFile')

  let output: Buffer
  try {
    output = await sharp(data, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'attention' })
      .webp({ quality: 84 })
      .toBuffer()
  } catch (error) {
    logError('avatar.process', error, { userId, inputBytes: data.length })
    throw apiError(400, 'avatarInvalidFile')
  }

  const filename = `${userId}-${Date.now()}.webp`
  const dir = getAvatarsDir()

  try {
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, filename), output)
  } catch (error) {
    logError('avatar.write', error, { userId, dir })
    throw apiError(500, 'avatarSaveFailed')
  }

  return `/avatars/${filename}`
}
