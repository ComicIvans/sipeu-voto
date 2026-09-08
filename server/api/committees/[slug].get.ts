import { apiError } from '../../utils/apiErrorMessages'
import {
  findCommitteeBySlug,
  listVisibleVoteIds,
  toPublicCommittee,
} from '../../utils/publicQueries'
import { getOptionalUser } from '../../utils/requireAuth'
import { getSetting, PLENARY_COVER_KEY } from '../../utils/settings'
import { getVoteSummary } from '../../utils/voteResults'
import { PLENARY_SLUG } from '~~/shared/constants/routes'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw apiError(400, 'requiredId')

  const isPlenary = slug === PLENARY_SLUG
  const committee = isPlenary ? null : await findCommitteeBySlug(slug)
  if (!isPlenary && !committee) throw apiError(404, 'committeeNotFound')

  const viewer = await getOptionalUser(event)
  const includeHidden = viewer?.role === 'admin'
  const voteIds = await listVisibleVoteIds(committee?.id ?? null)
  const summaries = await Promise.all(voteIds.map((id) => getVoteSummary(id, { includeHidden })))

  return {
    data: {
      committee: committee
        ? toPublicCommittee(committee)
        : { id: null, name: 'Pleno', slug: PLENARY_SLUG, order: 0 },
      // Kept beside the committee, not inside it: `PublicCommittee` travels in
      // every vote payload and nothing there renders an image.
      cover: isPlenary ? await getSetting(PLENARY_COVER_KEY) : (committee?.cover ?? null),
      isPlenary,
      votes: summaries.filter((vote) => vote !== null),
    },
  }
})
