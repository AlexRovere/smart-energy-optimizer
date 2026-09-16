import { describe, expect, it } from 'vitest'
import { lireTablesDocumentees, typePostgres } from './data-md'

describe('lecture de docs/data.md', () => {
  const tables = lireTablesDocumentees()

  it('trouve les cinq tables', () => {
    expect([...tables.keys()].sort()).toEqual([
      'roles',
      'sessions',
      'sites',
      'user_sites',
      'users'
    ])
  })

  it('lit les colonnes de roles', () => {
    expect(tables.get('roles')!.colonnes.map(c => c.nom)).toEqual(['id', 'name'])
  })

  it('tolère la colonne « Origine », présente pour sites seule', () => {
    expect(tables.get('sites')!.colonnes.map(c => c.nom)).toEqual([
      'id',
      'name',
      'type',
      'location',
      'capacity_kw',
      'status',
      'present_in_source',
      'warning_threshold_kw',
      'created_at',
      'updated_at'
    ])
  })

  it('ne confond pas NOT NULL avec NULL', () => {
    const colonnes = tables.get('users')!.colonnes
    expect(colonnes.find(c => c.nom === 'is_active')!.nullable).toBe(false)
    expect(colonnes.find(c => c.nom === 'last_login')!.nullable).toBe(true)
  })

  it('repère les valeurs par défaut, SERIAL compris', () => {
    expect(tables.get('roles')!.colonnes.find(c => c.nom === 'id')!.aUnDefaut).toBe(true)
    expect(tables.get('roles')!.colonnes.find(c => c.nom === 'name')!.aUnDefaut).toBe(false)
    expect(tables.get('users')!.colonnes.find(c => c.nom === 'id')!.aUnDefaut).toBe(true)
  })

  it('traduit les types du document vers ceux de PostgreSQL', () => {
    expect(typePostgres('VARCHAR(50)')).toEqual({
      dataType: 'character varying',
      longueur: 50
    })
    expect(typePostgres('TIMESTAMPTZ')).toEqual({
      dataType: 'timestamp with time zone',
      longueur: null
    })
    expect(typePostgres('SERIAL')).toEqual({ dataType: 'integer', longueur: null })
    expect(() => typePostgres('JSONB')).toThrow(/JSONB/)
  })
})
