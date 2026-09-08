import { describe, expect, it } from 'vitest'
import { parseUsersCsv } from '../../server/utils/csvImport'

describe('parseUsersCsv', () => {
  it('parses the documented template, keeping physical line numbers', () => {
    const csv = [
      'nombre,apellidos,email,comision,grupo,rol',
      'María,García López,maria@example.com,LIBE,APE,',
      '',
      'Ana,Organización,ana@example.com,,,admin',
    ].join('\n')
    const { rows, errors } = parseUsersCsv(csv)
    expect(errors).toEqual([])
    expect(rows.map((row) => [row.line, row.email, row.role])).toEqual([
      [2, 'maria@example.com', 'delegate'],
      [4, 'ana@example.com', 'admin'],
    ])
  })

  it('accepts semicolons, quoted cells and a BOM', () => {
    const csv =
      '﻿nombre;apellidos;email;comision;grupo;rol\n"Juan";"Pérez, Díaz";JUAN@Example.com;ECON;SD;\n'
    const { rows, errors } = parseUsersCsv(csv)
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({ lastName: 'Pérez, Díaz', email: 'juan@example.com' })
  })

  it('rejects unknown roles, missing affiliation, duplicates and broken quotes', () => {
    const csv = [
      'nombre,apellidos,email,comision,grupo,rol',
      'A,B,a@example.com,LIBE,APE,jefe',
      'C,D,c@example.com,,APE,',
      'E,F,e@example.com,LIBE,APE,',
      'G,H,e@example.com,LIBE,APE,',
      'I,"J,i@example.com,LIBE,APE,',
    ].join('\n')
    const { rows, errors } = parseUsersCsv(csv)
    expect(rows.map((row) => row.line)).toEqual([4])
    expect(errors.map((error) => error.line)).toEqual([2, 3, 5, 6])
    expect(errors[0]!.message).toMatch(/Rol desconocido/)
    expect(errors[1]!.message).toMatch(/comisión y grupo/)
    expect(errors[2]!.message).toMatch(/repetido/)
    expect(errors[3]!.message).toMatch(/Comillas/)
  })

  it('fails when mandatory columns are missing', () => {
    const { rows, errors } = parseUsersCsv('nombre,email\nA,a@example.com')
    expect(rows).toEqual([])
    expect(errors[0]!.message).toMatch(/obligatorias/)
  })
})
