import { describe, expect, it } from 'vitest'
import { messageDeConnexion } from '../../app/utils/messageDeConnexion'

describe('messageDeConnexion', () => {
  it('dit la même chose pour un compte inconnu et un mot de passe faux', () => {
    expect(messageDeConnexion(401)).toBe('Identifiants invalides.')
  })

  it('annonce le délai quand les tentatives sont épuisées', () => {
    expect(messageDeConnexion(429, 900)).toBe(
      'Trop de tentatives. Réessayez dans 15 minutes.'
    )
  })

  it('arrondit le délai à la minute supérieure, jamais à zéro', () => {
    expect(messageDeConnexion(429, 30)).toBe(
      'Trop de tentatives. Réessayez dans 1 minute.'
    )
  })

  it('reste sobre quand le délai est absent', () => {
    expect(messageDeConnexion(429)).toBe('Trop de tentatives. Réessayez plus tard.')
  })

  it('renvoie à la saisie pour une entrée refusée', () => {
    expect(messageDeConnexion(422)).toBe('Vérifiez votre adresse et votre mot de passe.')
  })

  it('ne masque pas une panne derrière un refus', () => {
    expect(messageDeConnexion(503)).toBe('Service indisponible. Réessayez dans un instant.')
  })
})
