import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

// public/sw.js is a classic worker script: no bundler, no exports. Rather than
// duplicating its logic in a testable twin (which would drift), the real file
// is evaluated here against a fake `self`.

const SOURCE = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')

interface FakeClient {
  url: string
  visibilityState: 'visible' | 'hidden'
  postMessage: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
}

function client(
  url: string,
  visibilityState: 'visible' | 'hidden',
): FakeClient {
  return { url, visibilityState, postMessage: vi.fn(), focus: vi.fn() }
}

function loadWorker(clients: FakeClient[]) {
  const listeners = new Map<string, (event: unknown) => void>()
  const showNotification = vi.fn(() => Promise.resolve())
  const self = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners.set(type, handler)
    },
    skipWaiting: () => Promise.resolve(),
    registration: { showNotification },
    clients: {
      matchAll: vi.fn(() => Promise.resolve(clients)),
      claim: () => Promise.resolve(),
      openWindow: vi.fn(() => Promise.resolve(null)),
    },
  }
  const caches = {
    open: () => Promise.resolve({ add: () => Promise.resolve() }),
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true),
    match: () => Promise.resolve(undefined),
  }
  new Function('self', 'caches', SOURCE)(self, caches)
  return { listeners, showNotification, self }
}

async function push(clients: FakeClient[], payload: unknown | null) {
  const worker = loadWorker(clients)
  const handler = worker.listeners.get('push')
  expect(handler).toBeTypeOf('function')

  const waiting: Promise<unknown>[] = []
  handler?.({
    data:
      payload === null
        ? null
        : {
            json: () => {
              if (payload === 'broken') throw new Error('not json')
              return payload
            },
          },
    waitUntil: (promise: Promise<unknown>) => waiting.push(promise),
  })
  await Promise.all(waiting)
  return worker
}

const ORDER_PUSH = {
  title: 'Pedido listo',
  body: 'Tu pedido #AB12 está listo.',
  url: '/orders/abc',
  tag: 'order-abc',
}

describe('service worker push', () => {
  it('shows the notification when no window is open', async () => {
    const worker = await push([], ORDER_PUSH)
    expect(worker.showNotification).toHaveBeenCalledTimes(1)
    expect(worker.showNotification).toHaveBeenCalledWith(
      'Pedido listo',
      expect.objectContaining({
        tag: 'order-abc',
        data: { url: '/orders/abc' },
      }),
    )
  })

  it('shows the notification when the open window is on another page', async () => {
    const worker = await push(
      [client('https://app.test/account', 'visible')],
      ORDER_PUSH,
    )
    expect(worker.showNotification).toHaveBeenCalledTimes(1)
  })

  it('shows the notification when the matching tab is hidden', async () => {
    const worker = await push(
      [client('https://app.test/orders/abc', 'hidden')],
      ORDER_PUSH,
    )
    expect(worker.showNotification).toHaveBeenCalledTimes(1)
  })

  it('suppresses the notification when a visible tab shows that order', async () => {
    const open = client('https://app.test/orders/abc', 'visible')
    const worker = await push([open], ORDER_PUSH)
    expect(worker.showNotification).not.toHaveBeenCalled()
  })

  it('ignores query strings and trailing slashes when matching', async () => {
    const open = client('https://app.test/orders/abc/?id=tx_1', 'visible')
    const worker = await push([open], ORDER_PUSH)
    expect(worker.showNotification).not.toHaveBeenCalled()
  })

  it('suppresses the merchant push only on the dashboard itself', async () => {
    const dashboard = {
      title: 'Nuevo pedido #AB12',
      body: 'Revisa el panel.',
      url: '/dashboard',
      tag: 'new-order',
    }

    const onBoard = await push(
      [client('https://app.test/dashboard', 'visible')],
      dashboard,
    )
    expect(onBoard.showNotification).not.toHaveBeenCalled()

    const elsewhere = await push(
      [client('https://app.test/dashboard/menu', 'visible')],
      dashboard,
    )
    expect(elsewhere.showNotification).toHaveBeenCalledTimes(1)
  })

  it('tells the matching tab about the suppressed push', async () => {
    const open = client('https://app.test/orders/abc', 'visible')
    await push([open], ORDER_PUSH)
    expect(open.postMessage).toHaveBeenCalledWith({
      type: 'push-suppressed',
      payload: ORDER_PUSH,
    })
  })

  it('does not message tabs when the notification was shown', async () => {
    const open = client('https://app.test/account', 'visible')
    await push([open], ORDER_PUSH)
    expect(open.postMessage).not.toHaveBeenCalled()
  })

  it('ignores a push with no data or unreadable data', async () => {
    const empty = await push([], null)
    expect(empty.showNotification).not.toHaveBeenCalled()

    const broken = await push([], 'broken')
    expect(broken.showNotification).not.toHaveBeenCalled()
  })
})
