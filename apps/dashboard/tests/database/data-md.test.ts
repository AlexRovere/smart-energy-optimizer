import { describe, expect, it } from 'vitest'
import {
  clesEtrangeresDocumentees,
  colonnesAvecCheckDocumentees,
  colonnesClePrimaire,
  colonnesUniquesDocumentees,
  indexDocumentes,
  lireTablesDocumentees,
  typePostgres
} from './data-md'

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

  it('dérive les colonnes marquées PRIMARY KEY, table par table', () => {
    expect(colonnesClePrimaire(tables.get('roles')!)).toEqual(['id'])
    expect(colonnesClePrimaire(tables.get('users')!)).toEqual(['id'])
    expect(colonnesClePrimaire(tables.get('sessions')!)).toEqual(['id'])
    expect(colonnesClePrimaire(tables.get('sites')!)).toEqual(['id'])
    // Décrite en prose sous le tableau, pas par colonne : aucune colonne de
    // user_sites ne porte PRIMARY KEY dans le document.
    expect(colonnesClePrimaire(tables.get('user_sites')!)).toEqual([])
  })

  it('dérive les colonnes UNIQUE du document', () => {
    expect(colonnesUniquesDocumentees(tables)).toEqual([
      ['roles', 'name'],
      ['users', 'email']
    ])
  })

  it('dérive les clés étrangères et leur ON DELETE', () => {
    expect(clesEtrangeresDocumentees(tables)).toEqual([
      { table: 'users', colonne: 'role_id', tableReferencee: 'roles', onDelete: 'RESTRICT' },
      { table: 'sessions', colonne: 'user_id', tableReferencee: 'users', onDelete: 'CASCADE' },
      { table: 'user_sites', colonne: 'user_id', tableReferencee: 'users', onDelete: 'CASCADE' },
      { table: 'user_sites', colonne: 'site_id', tableReferencee: 'sites', onDelete: 'RESTRICT' }
    ])
  })

  it('dérive les colonnes portant un CHECK', () => {
    expect(colonnesAvecCheckDocumentees(tables)).toEqual([
      ['sites', 'capacity_kw'],
      ['sites', 'warning_threshold_kw']
    ])
  })

  it('lit les index des blocs SQL, avec leur table et leur colonne', () => {
    expect(indexDocumentes()).toEqual([
      { nom: 'idx_sessions_user', table: 'sessions', colonne: 'user_id' },
      { nom: 'idx_user_sites_site', table: 'user_sites', colonne: 'site_id' }
    ])
  })
})
