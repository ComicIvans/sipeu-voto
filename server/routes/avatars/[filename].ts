import { readFile, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { getAvatarFilename, getAvatarsDir } from '../../utils/avatars'
import { apiError } from '../../utils/apiErrorMessages'

export default defineEventHandler(async (event) => {
  const param = getRouterParam(event, 'filename')
  const filename = param ? getAvatarFilename(param) : null

  if (!filename || extname(filename).toLowerCase() !== '.webp') {
    throw apiError(404, 'avatarNotFound')
  }

  try {
    const absolutePath = join(getAvatarsDir(), filename)
    const [file, fileStat] = await Promise.all([readFile(absolutePath), stat(absolutePath)])
    const etag = `"${fileStat.size}-${fileStat.mtimeMs}"`

    if (getRequestHeader(event, 'if-none-match') === etag) {
      setResponseStatus(event, 304)
      return null
    }

    setResponseHeader(event, 'Content-Type', 'image/webp')
    setResponseHeader(event, 'Cache-Control', 'public, max-age=86400, immutable')
    setResponseHeader(event, 'ETag', etag)
    return file
  } catch {
    throw apiError(404, 'avatarNotFound')
  }
})
