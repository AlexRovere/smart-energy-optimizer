import { describe, expect, it } from 'vitest'
import { roleLabel } from '../../app/utils/roles'

describe('roleLabel', () => {
  it.each([
    ['ADMIN', 'Administrateur'],
    ['OPERATOR', 'Opérateur'],
    ['VIEWER', 'Lecteur'],
  ])('traduit %s', (role, label) => {
    expect(roleLabel(role)).toBe(label)
  })

  it('rend tel quel un rôle inconnu plutôt que de le masquer', () => {
    expect(roleLabel('AUDITOR')).toBe('AUDITOR')
  })

  it('rend une chaîne vide sans compte', () => {
    expect(roleLabel(undefined)).toBe('')
  })
})
