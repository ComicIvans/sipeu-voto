import { z } from 'zod'
import { emailSchema } from '../validation/common'

export const CSV_TEMPLATE_HEADERS = [
  'nombre',
  'apellidos',
  'email',
  'comision',
  'grupo',
  'rol',
] as const

export const CSV_TEMPLATE = [
  CSV_TEMPLATE_HEADERS.join(','),
  'María,García López,maria.garcia@example.com,LIBE,APE,',
  'Juan,Pérez Díaz,juan.perez@example.com,ECON,SD,',
  'Ana,Organización,ana@example.com,,,admin',
].join('\n')

export interface CsvRow {
  line: number
  firstName: string
  lastName: string
  email: string
  committee: string
  group: string
  role: 'admin' | 'delegate'
}

export interface CsvRowError {
  line: number
  message: string
}

function detectDelimiter(headerLine: string) {
  const counts = [',', ';', '\t'].map((delimiter) => ({
    delimiter,
    count: headerLine.split(delimiter).length,
  }))
  return counts.sort((a, b) => b.count - a.count)[0]?.delimiter ?? ','
}

function parseLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

function normalizeHeader(header: string) {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '')
}

const HEADER_ALIASES: Record<string, keyof Omit<CsvRow, 'line'>> = {
  nombre: 'firstName',
  firstname: 'firstName',
  apellidos: 'lastName',
  apellido: 'lastName',
  lastname: 'lastName',
  email: 'email',
  correo: 'email',
  comision: 'committee',
  committee: 'committee',
  grupo: 'group',
  grupoparlamentario: 'group',
  group: 'group',
  rol: 'role',
  role: 'role',
}

const rowSchema = z.object({
  firstName: z.string().trim().min(1, 'Nombre obligatorio').max(100),
  lastName: z.string().trim().min(1, 'Apellidos obligatorios').max(150),
  email: emailSchema,
  committee: z.string().trim().max(120).default(''),
  group: z.string().trim().max(120).default(''),
  role: z
    .string()
    .trim()
    .toLowerCase()
    .default('')
    .transform((value) => (value === 'admin' || value === 'administrador' ? 'admin' : 'delegate')),
})

export function parseUsersCsv(content: string): { rows: CsvRow[]; errors: CsvRowError[] } {
  const text = content.replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0)
    return { rows: [], errors: [{ line: 0, message: 'El archivo está vacío.' }] }

  const delimiter = detectDelimiter(lines[0]!)
  const headers = parseLine(lines[0]!, delimiter).map(normalizeHeader)
  const columnMap = headers.map((header) => HEADER_ALIASES[header] ?? null)

  const missing = (['firstName', 'lastName', 'email'] as const).filter(
    (field) => !columnMap.includes(field)
  )
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ line: 1, message: 'Faltan columnas obligatorias: nombre, apellidos, email.' }],
    }
  }

  const rows: CsvRow[] = []
  const errors: CsvRowError[] = []
  const seenEmails = new Set<string>()

  lines.slice(1).forEach((line, index) => {
    const lineNumber = index + 2
    const cells = parseLine(line, delimiter)
    const raw: Record<string, string> = {}
    columnMap.forEach((field, cellIndex) => {
      if (field) raw[field] = cells[cellIndex] ?? ''
    })

    const parsed = rowSchema.safeParse(raw)
    if (!parsed.success) {
      errors.push({
        line: lineNumber,
        message: parsed.error.issues[0]?.message ?? 'Fila no válida.',
      })
      return
    }

    if (seenEmails.has(parsed.data.email)) {
      errors.push({
        line: lineNumber,
        message: `Correo repetido en el archivo: ${parsed.data.email}`,
      })
      return
    }
    seenEmails.add(parsed.data.email)

    rows.push({ line: lineNumber, ...parsed.data })
  })

  return { rows, errors }
}
