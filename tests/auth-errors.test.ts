import { describe, expect, it } from 'vitest'
import {
  AUTH_ERROR_MESSAGES,
  callbackErrorMessage,
  mapAuthError,
} from '@/lib/auth/errors'

describe('callbackErrorMessage', () => {
  it('tells the user an expired link must be requested again', () => {
    expect(callbackErrorMessage('expired')).toBe(
      'El enlace expiró o ya fue usado. Solicita uno nuevo.',
    )
    expect(callbackErrorMessage('expired')).toBe(
      AUTH_ERROR_MESSAGES.linkExpired,
    )
  })

  it('uses the generic copy for invalid, missing and unknown callback failures', () => {
    expect(callbackErrorMessage('invalid')).toBe(
      'No pudimos validar el enlace. Intenta de nuevo.',
    )
    expect(callbackErrorMessage('callback')).toBe(
      AUTH_ERROR_MESSAGES.linkInvalid,
    )
    expect(callbackErrorMessage('missing')).toBe(
      AUTH_ERROR_MESSAGES.linkInvalid,
    )
  })

  it('returns null when there is no error key', () => {
    expect(callbackErrorMessage(null)).toBeNull()
    expect(callbackErrorMessage(undefined)).toBeNull()
    expect(callbackErrorMessage('')).toBeNull()
    expect(callbackErrorMessage('something-else')).toBeNull()
  })
})

describe('mapAuthError', () => {
  it('maps invalid credentials', () => {
    expect(mapAuthError({ message: 'Invalid login credentials' })).toBe(
      'Correo o contraseña incorrectos.',
    )
    expect(mapAuthError({ code: 'invalid_credentials', message: 'x' })).toBe(
      'Correo o contraseña incorrectos.',
    )
  })

  it('maps unconfirmed email', () => {
    expect(mapAuthError({ message: 'Email not confirmed' })).toBe(
      'Confirma tu correo electrónico antes de iniciar sesión.',
    )
    expect(mapAuthError({ code: 'email_not_confirmed', message: 'x' })).toBe(
      'Confirma tu correo electrónico antes de iniciar sesión.',
    )
  })

  it('maps an already registered user', () => {
    expect(mapAuthError({ message: 'User already registered' })).toBe(
      'Ya existe una cuenta con este correo electrónico.',
    )
    expect(mapAuthError({ code: 'user_already_exists', message: 'x' })).toBe(
      'Ya existe una cuenta con este correo electrónico.',
    )
  })

  it('maps rate limits', () => {
    expect(
      mapAuthError({ message: 'Email rate limit exceeded', status: 429 }),
    ).toBe('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.')
    expect(
      mapAuthError({ code: 'over_request_rate_limit', message: 'x' }),
    ).toBe('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.')
  })

  it('maps disabled providers and otp sign ups', () => {
    expect(
      mapAuthError({
        message: 'Unsupported provider: provider is not enabled',
      }),
    ).toBe('Este método de acceso no está habilitado por ahora.')
    expect(mapAuthError({ code: 'provider_disabled', message: 'x' })).toBe(
      'Este método de acceso no está habilitado por ahora.',
    )
    expect(mapAuthError({ message: 'Signups not allowed for otp' })).toBe(
      'Este método de acceso no está habilitado por ahora.',
    )
    expect(
      mapAuthError({ code: 'phone_provider_disabled', message: 'x' }),
    ).toBe('Este método de acceso no está habilitado por ahora.')
  })

  it('maps weak passwords and invalid or expired tokens', () => {
    expect(mapAuthError({ code: 'weak_password', message: 'x' })).toBe(
      'La contraseña es demasiado débil. Usa al menos 8 caracteres.',
    )
    expect(mapAuthError({ code: 'otp_expired', message: 'x' })).toBe(
      'El código expiró o no es válido. Solicita uno nuevo.',
    )
    expect(mapAuthError({ message: 'Token has expired or is invalid' })).toBe(
      'El código expiró o no es válido. Solicita uno nuevo.',
    )
  })

  it('never leaks the raw message for unknown errors', () => {
    expect(mapAuthError({ message: 'Database error saving new user' })).toBe(
      'No pudimos completar la solicitud. Inténtalo de nuevo.',
    )
    expect(mapAuthError(null)).toBe(
      'No pudimos completar la solicitud. Inténtalo de nuevo.',
    )
  })
})
