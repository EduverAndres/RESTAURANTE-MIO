import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GeolocationNotice } from '@/components/map/geolocation-notice'
import {
  geolocationFailureMessage,
  INSECURE_GPS_MESSAGE,
  NO_GPS_MESSAGE,
  type GeolocationFailure,
} from '@/lib/geo/geolocation-availability'

const REASONS: GeolocationFailure[] = [
  'unsupported',
  'insecure',
  'denied',
  'unavailable',
  'timeout',
]

describe('GeolocationNotice', () => {
  it.each(REASONS)('announces the %s case with its own copy', (reason) => {
    render(<GeolocationNotice reason={reason} />)
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent(geolocationFailureMessage(reason))
    expect(notice).toHaveAttribute('data-reason', reason)
  })

  it('shows the no-GPS message when the device has none or it was denied', () => {
    for (const reason of ['unsupported', 'denied'] as const) {
      const { unmount } = render(<GeolocationNotice reason={reason} />)
      expect(screen.getByRole('status')).toHaveTextContent(NO_GPS_MESSAGE)
      unmount()
    }
  })

  it('explains the insecure connection instead of blaming the device', () => {
    render(<GeolocationNotice reason="insecure" />)
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent(INSECURE_GPS_MESSAGE)
    expect(notice).not.toHaveTextContent(NO_GPS_MESSAGE)
  })
})
