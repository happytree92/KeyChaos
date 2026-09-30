// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from './App'

// ─── Fake backend ─────────────────────────────────────────────────────────────

let smartpassCalls = 0
let pendingPush: ((body: object) => void) | null = null

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  smartpassCalls = 0
  pendingPush    = null
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/health') return jsonResponse({ status: 'ok', version: 'test' })
    if (url === '/api/generate/smartpass') {
      const { count } = JSON.parse(String(init?.body))
      smartpassCalls++
      return jsonResponse({
        passwords:     Array.from({ length: count }, (_, i) => `Word${smartpassCalls}x${i}#11`),
        entropy_bits:  24,
        pepper_active: false,
      })
    }
    if (url === '/api/pwdpush/push') {
      // Held open until the test resolves it, to exercise in-flight behaviour.
      return new Promise<Response>(resolve => { pendingPush = body => resolve(jsonResponse(body)) })
    }
    throw new Error(`unexpected fetch ${url}`)
  }))
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(async () => {}) },
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const cards     = () => screen.getAllByRole('listitem')
const valueOf   = (card: HTMLElement) => within(card).getByRole('button', { name: /^Password \d/ }).textContent
const optionsHint = () => screen.queryByText(/Options changed/)

async function switchToRandom() {
  render(<App />)
  await waitFor(() => expect(cards()).toHaveLength(3))
  fireEvent.click(screen.getByRole('radio', { name: 'Random' }))
  await waitFor(() => expect(valueOf(cards()[0])).toHaveLength(24))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('App — generation', () => {
  it('SmartPass option changes do not hit the API until Generate is pressed', async () => {
    render(<App />)
    await waitFor(() => expect(cards()).toHaveLength(3))
    const callsAfterLoad = smartpassCalls

    fireEvent.click(screen.getByRole('radio', { name: '4 digits' }))
    fireEvent.click(screen.getByRole('radio', { name: '5' }))
    await act(async () => {})

    expect(smartpassCalls).toBe(callsAfterLoad)
    expect(optionsHint()).not.toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Generate' })[0])
    await waitFor(() => expect(cards()).toHaveLength(5))
    expect(smartpassCalls).toBe(callsAfterLoad + 1)
    expect(optionsHint()).toBeNull()
  })

  it('Random mode regenerates as soon as an option changes', async () => {
    await switchToRandom()
    fireEvent.change(screen.getByLabelText('Length'), { target: { value: '40' } })
    await waitFor(() => expect(valueOf(cards()[0])).toHaveLength(40))
    expect(optionsHint()).toBeNull()
  })
})

describe('App — PwdPush links are never lost or mismatched', () => {
  it('keeps a shared link when options change, and asks before replacing it', async () => {
    await switchToRandom()
    const card = cards()[0]
    fireEvent.click(within(card).getByRole('button', { name: /Share via PwdPush, password 1/ }))
    await act(async () => { pendingPush!({ pushUrl: 'https://pwpush.test/p/one', expiresAt: null, viewsRemaining: 5 }) })
    await screen.findByText('https://pwpush.test/p/one')

    fireEvent.change(screen.getByLabelText('Length'), { target: { value: '40' } })
    await act(async () => {})

    expect(screen.getByText('https://pwpush.test/p/one')).toBeTruthy()
    expect(valueOf(cards()[0])).toHaveLength(24)
    expect(screen.getByText(/Shared links below will be cleared/)).toBeTruthy()
  })

  it('cannot regenerate a card while its share is in flight', async () => {
    await switchToRandom()
    const card = cards()[0]
    fireEvent.click(within(card).getByRole('button', { name: /Share via PwdPush, password 1/ }))

    const regen = within(cards()[0]).getByRole('button', { name: 'Regenerate password 1' }) as HTMLButtonElement
    expect(regen.disabled).toBe(true)
  })

  it('a regenerated card drops a late result meant for its previous value', async () => {
    await switchToRandom()
    // Card 1 is shared, then regenerated after the link arrives (fresh id)…
    fireEvent.click(within(cards()[0]).getByRole('button', { name: /Share via PwdPush, password 1/ }))
    await act(async () => { pendingPush!({ pushUrl: 'https://pwpush.test/p/old', expiresAt: null, viewsRemaining: 5 }) })
    const before = valueOf(cards()[0])
    fireEvent.click(within(cards()[0]).getByRole('button', { name: 'Regenerate password 1' }))

    expect(valueOf(cards()[0])).not.toBe(before)
    expect(screen.queryByText('https://pwpush.test/p/old')).toBeNull()
    expect(within(cards()[0]).getByRole('button', { name: /Share via PwdPush, password 1/ })).toBeTruthy()
  })
})

describe('App — keyboard copy is scoped to the results list', () => {
  it('ignores number keys outside the list and copies the matching row inside it', async () => {
    render(<App />)
    await waitFor(() => expect(cards()).toHaveLength(3))
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>

    fireEvent.keyDown(document.body, { key: '2' })
    fireEvent.keyDown(screen.getByRole('radio', { name: 'SmartPass' }), { key: '2' })
    expect(writeText).not.toHaveBeenCalled()

    const second = cards()[1]
    fireEvent.keyDown(within(second).getByRole('button', { name: /^Password 2/ }), { key: '2' })
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(valueOf(second)))
  })
})
