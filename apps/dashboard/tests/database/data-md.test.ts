import { describe, expect, it } from 'vitest'
import {
  documentedForeignKeys,
  documentedCheckColumns,
  primaryKeyColumns,
  documentedUniqueColumns,
  documentedIndexes,
  readDocumentedTables,
  typePostgres
} from './data-md'

describe('lecture de docs/data.md', () => {
  const tables = readDocumentedTables()

  it('trouve les sept tables', () => {
    expect([...tables.keys()].sort()).toEqual([
      'alert_thresholds',
      'feedback',
      'roles',
      'sessions',
      'sites',
      'user_sites',
      'users'
    ])
  })

  it('lit les colonnes de alert_thresholds', () => {
    expect(tables.get('alert_thresholds')!.columns.map(c => c.name)).toEqual([
      'site_id',
      'type',
      'duration',
      'threshold'
    ])
  })

  it('lit les colonnes de roles', () => {
    expect(tables.get('roles')!.columns.map(c => c.name)).toEqual(['id', 'name'])
  })

  it('tolère la colonne « Origine », présente pour sites seule', () => {
    expect(tables.get('sites')!.columns.map(c => c.name)).toEqual([
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
    const columns = tables.get('users')!.columns
    expect(columns.find(c => c.name === 'is_active')!.nullable).toBe(false)
    expect(columns.find(c => c.name === 'last_login')!.nullable).toBe(true)
  })

  it('repère les valeurs par défaut, SERIAL compris', () => {
    expect(tables.get('roles')!.columns.find(c => c.name === 'id')!.hasDefault).toBe(true)
    expect(tables.get('roles')!.columns.find(c => c.name === 'name')!.hasDefault).toBe(false)
    expect(tables.get('users')!.columns.find(c => c.name === 'id')!.hasDefault).toBe(true)
  })

  it('traduit les types du document vers ceux de PostgreSQL', () => {
    expect(typePostgres('VARCHAR(50)')).toEqual({
      dataType: 'character varying',
      size: 50
    })
    expect(typePostgres('TIMESTAMPTZ')).toEqual({
      dataType: 'timestamp with time zone',
      size: null
    })
    expect(typePostgres('SERIAL')).toEqual({ dataType: 'integer', size: null })
    expect(typePostgres('REAL')).toEqual({ dataType: 'real', size: null })
    expect(() => typePostgres('JSONB')).toThrow(/JSONB/)
  })

  it('dérive les colonnes marquées PRIMARY KEY, table par table', () => {
    expect(primaryKeyColumns(tables.get('roles')!)).toEqual(['id'])
    expect(primaryKeyColumns(tables.get('users')!)).toEqual(['id'])
    expect(primaryKeyColumns(tables.get('sessions')!)).toEqual(['id'])
    expect(primaryKeyColumns(tables.get('sites')!)).toEqual(['id'])
    // Décrite en prose sous le tableau, pas par colonne : aucune colonne de
    // user_sites ne porte PRIMARY KEY dans le document.
    expect(primaryKeyColumns(tables.get('user_sites')!)).toEqual([])
    // Même motif pour alert_thresholds : clé composite (site_id, type).
    expect(primaryKeyColumns(tables.get('alert_thresholds')!)).toEqual([])
  })

  it('dérive les colonnes UNIQUE du document', () => {
    expect(documentedUniqueColumns(tables)).toEqual([
      ['roles', 'name'],
      ['users', 'email']
    ])
  })

  it('dérive les clés étrangères et leur ON DELETE', () => {
    expect(documentedForeignKeys(tables)).toEqual([
      { table: 'users', column: 'role_id', referencedTable: 'roles', onDelete: 'RESTRICT' },
      { table: 'sessions', column: 'user_id', referencedTable: 'users', onDelete: 'CASCADE' },
      { table: 'user_sites', column: 'user_id', referencedTable: 'users', onDelete: 'CASCADE' },
      { table: 'user_sites', column: 'site_id', referencedTable: 'sites', onDelete: 'RESTRICT' },
      {
        table: 'alert_thresholds',
        column: 'site_id',
        referencedTable: 'sites',
        onDelete: 'RESTRICT'
      },
      { table: 'feedback', column: 'user_id', referencedTable: 'users', onDelete: 'CASCADE' },
      { table: 'feedback', column: 'site_id', referencedTable: 'sites', onDelete: 'RESTRICT' }
    ])
  })

  it('dérive les colonnes portant un CHECK', () => {
    expect(documentedCheckColumns(tables)).toEqual([
      ['sites', 'capacity_kw'],
      ['sites', 'warning_threshold_kw'],
      ['feedback', 'target_type']
    ])
  })

  it('lit les index des blocs SQL, avec leur table et leur colonne', () => {
    expect(documentedIndexes()).toEqual([
      { name: 'idx_sessions_user', table: 'sessions', column: 'user_id' },
      { name: 'idx_user_sites_site', table: 'user_sites', column: 'site_id' }
    ])
  })
})
