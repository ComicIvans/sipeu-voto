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
export const CSV_MAX_ROWS = 500
export const CSV_MAX_BYTES = 1024 * 1024

export const CSV_TEMPLATE = [
  CSV_TEMPLATE_HEADERS.join(','),
  'María,García López,maria.garcia@example.com,LIBE,APE,',
  'Juan,Pérez Díaz,juan.perez@example.com,ECON,SD,participante',
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

/** Splits one physical line. Returns null when a quote is left open. */
function parseLine(line: string, delimiter: string): string[] | null {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else if (!inQuotes && current.length > 0) {
        return null
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
  if (inQuotes) return null
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

const ROLE_VALUES: Record<string, 'admin' | 'delegate'> = {
  '': 'delegate',
  participante: 'delegate',
  delegate: 'delegate',
  delegado: 'delegate',
  delegada: 'delegate',
  admin: 'admin',
  administrador: 'admin',
  administradora: 'admin',
  organizacion: 'admin',
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
    .default('')
    .transform((value, ctx) => {
      const key = value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      const role = ROLE_VALUES[key]
      if (!role) {
        ctx.addIssue({ code: 'custom', message: `Rol desconocido: "${value}" (usa admin o vacío)` })
        return z.NEVER
      }
      return role
    }),
})

export function parseUsersCsv(content: string): { rows: CsvRow[]; errors: CsvRowError[] } {
  const text = content.replace(/^\uFEFF/, '')
  if (Buffer.byteLength(text, 'utf8') > CSV_MAX_BYTES) {
    return { rows: [], errors: [{ line: 0, message: 'El archivo supera 1 MB.' }] }
  }

  const physicalLines = text.split(/\r?\n/)
  const headerIndex = physicalLines.findIndex((line) => line.trim().length > 0)
  if (headerIndex === -1) {
    return { rows: [], errors: [{ line: 0, message: 'El archivo está vacío.' }] }
  }

  const delimiter = detectDelimiter(physicalLines[headerIndex]!)
  const headerCells = parseLine(physicalLines[headerIndex]!, delimiter)
  if (!headerCells) {
    return { rows: [], errors: [{ line: headerIndex + 1, message: 'Cabecera mal formada.' }] }
  }
  const columnMap = headerCells.map((header) => HEADER_ALIASES[normalizeHeader(header)] ?? null)

  const missing = (['firstName', 'lastName', 'email'] as const).filter(
    (field) => !columnMap.includes(field)
  )
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        {
          line: headerIndex + 1,
          message: 'Faltan columnas obligatorias: nombre, apellidos, email.',
        },
      ],
    }
  }

  const rows: CsvRow[] = []
  const errors: CsvRowError[] = []
  const seenEmails = new Set<string>()
  let dataRows = 0

  for (let index = headerIndex + 1; index < physicalLines.length; index += 1) {
    const line = physicalLines[index]!
    if (line.trim().length === 0) continue
    const lineNumber = index + 1
    dataRows += 1
    if (dataRows > CSV_MAX_ROWS) {
      errors.push({ line: lineNumber, message: `Máximo ${CSV_MAX_ROWS} filas por archivo.` })
      break
    }

    const cells = parseLine(line, delimiter)
    if (!cells) {
      errors.push({ line: lineNumber, message: 'Comillas sin cerrar o mal colocadas.' })
      continue
    }
    if (cells.length > columnMap.length) {
      errors.push({ line: lineNumber, message: 'La fila tiene más columnas que la cabecera.' })
      continue
    }

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
      continue
    }

    if (parsed.data.role === 'delegate' && (!parsed.data.committee || !parsed.data.group)) {
      errors.push({ line: lineNumber, message: 'Los participantes necesitan comisión y grupo.' })
      continue
    }

    if (seenEmails.has(parsed.data.email)) {
      errors.push({
        line: lineNumber,
        message: `Correo repetido en el archivo: ${parsed.data.email}`,
      })
      continue
    }
    seenEmails.add(parsed.data.email)

    rows.push({ line: lineNumber, ...parsed.data })
  }

  return { rows, errors }
}
