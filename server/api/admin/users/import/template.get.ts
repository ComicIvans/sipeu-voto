import { CSV_TEMPLATE } from '../../../../utils/csvImport'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(
    event,
    'Content-Disposition',
    'attachment; filename="plantilla-usuarios-sipeu.csv"'
  )
  return `\uFEFF${CSV_TEMPLATE}\n`
})
