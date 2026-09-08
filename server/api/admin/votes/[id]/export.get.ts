import { apiError } from '../../../../utils/apiErrorMessages'
import { getVoteWithResults } from '../../../../utils/voteResults'
import { VOTE_STATUS_LABELS } from '~~/shared/utils/voteStatus'
import { slugify } from '~~/shared/utils/names'

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function csvRow(...cells: unknown[]) {
  return cells.map(csvCell).join(',')
}

/** Full result of one vote as CSV: metadata, totals, groups and every ballot. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const vote = await getVoteWithResults(id, { includeHidden: true })
  if (!vote) throw apiError(404, 'voteNotFound')

  const optionLabel = new Map(vote.options.map((option) => [option.id, option.label]))
  const lines: string[] = []

  lines.push(csvRow('Votación', vote.name))
  lines.push(csvRow('Ámbito', vote.committee?.name ?? 'Pleno'))
  lines.push(csvRow('Estado', VOTE_STATUS_LABELS[vote.status]))
  lines.push(csvRow('Apertura', vote.startedAt ?? ''))
  lines.push(csvRow('Cierre', vote.endedAt ?? ''))
  lines.push(csvRow('Cambio de voto permitido', vote.allowChange ? 'sí' : 'no'))
  lines.push(csvRow('Mayoría mínima', vote.minimumVotes ?? ''))
  lines.push(csvRow('Máximo de ganadoras', vote.maxWinners ?? ''))
  lines.push(csvRow('Participación', `${vote.participation.voted}/${vote.participation.eligible}`))
  const labelsOf = (ids: string[]) => ids.map((id) => optionLabel.get(id) ?? id).join(' | ')
  lines.push(
    csvRow(
      'Resultado',
      labelsOf(vote.winnerIds) || (vote.tie ? 'Empate sin resolver' : 'Sin ganadora')
    )
  )
  lines.push(csvRow('Empate pendiente de resolver', labelsOf(vote.tiedOptionIds)))
  lines.push('')

  // "Ganadora" only marks options that definitely won: an option still tied for
  // the remaining seats is reported in its own column, never as a winner.
  lines.push(csvRow('Opción', 'Votos', 'Puede ganar', 'Ganadora', 'Empatada'))
  for (const option of vote.options) {
    const total = vote.totals.find((entry) => entry.optionId === option.id)?.count ?? 0
    lines.push(
      csvRow(
        option.label,
        total,
        option.canWin ? 'sí' : 'no',
        vote.winnerIds.includes(option.id) ? 'sí' : 'no',
        vote.tiedOptionIds.includes(option.id) ? 'sí' : 'no'
      )
    )
  }
  lines.push('')

  lines.push(csvRow('Grupo', 'Siglas', 'Han votado', 'Censo', ...vote.options.map((o) => o.label)))
  for (const entry of vote.byGroup) {
    lines.push(
      csvRow(
        entry.group?.name ?? 'Sin grupo',
        entry.group?.abbreviation ?? '',
        entry.voted,
        entry.eligible,
        ...vote.options.map((option) => entry.counts[option.id] ?? 0)
      )
    )
  }
  lines.push('')

  lines.push(csvRow('Persona', 'Grupo', 'Comisión', 'Voto', 'Hora'))
  for (const voter of vote.byUser) {
    lines.push(
      csvRow(
        voter.name,
        voter.group?.abbreviation ?? '',
        voter.committee?.name ?? '',
        voter.optionId ? (optionLabel.get(voter.optionId) ?? '') : '',
        voter.votedAt ?? ''
      )
    )
  }
  for (const pending of vote.pendingUsers) {
    lines.push(
      csvRow(
        pending.name,
        pending.group?.abbreviation ?? '',
        pending.committee?.name ?? '',
        'Pendiente',
        ''
      )
    )
  }

  const filename = `votacion-${slugify(vote.name) || vote.id}.csv`
  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  return `\uFEFF${lines.join('\n')}\n`
})
