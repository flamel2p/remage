import { describe, expect, it, vi } from 'vitest'
import { openSelectedOutputDirectory, registerOpenOutputDirectory } from './open-output-directory'

describe('registerOpenOutputDirectory', () => {
  it('authorizes the sender before opening the selected destination', async () => {
    let handler: ((event: object) => Promise<void>) | undefined
    const assertTrustedSender = vi.fn()
    const openOutputDirectory = vi.fn().mockResolvedValue(undefined)

    registerOpenOutputDirectory(
      { handle: (_channel, registeredHandler) => { handler = registeredHandler as (event: object) => Promise<void> } },
      { assertTrustedSender: assertTrustedSender as never, openOutputDirectory }
    )

    if (!handler) throw new Error('Open handler was not registered.')
    await handler({})

    expect(assertTrustedSender).toHaveBeenCalledTimes(1)
    expect(openOutputDirectory).toHaveBeenCalledTimes(1)
  })

  it('does not open a destination when sender authorization fails', async () => {
    let handler: ((event: object) => Promise<void>) | undefined
    const openOutputDirectory = vi.fn().mockResolvedValue(undefined)
    const rejectUntrusted = (): void => {
      throw new Error('Untrusted renderer request.')
    }

    registerOpenOutputDirectory(
      { handle: (_channel, registeredHandler) => { handler = registeredHandler as (event: object) => Promise<void> } },
      { assertTrustedSender: rejectUntrusted as never, openOutputDirectory }
    )

    if (!handler) throw new Error('Open handler was not registered.')
    await expect(handler({})).rejects.toThrow('Untrusted renderer request.')
    expect(openOutputDirectory).not.toHaveBeenCalled()
  })
})

describe('openSelectedOutputDirectory', () => {
  it('opens the selected folder and hides native error details', async () => {
    const openPath = vi.fn().mockResolvedValue('')
    await openSelectedOutputDirectory('/opaque-to-renderer', openPath)
    expect(openPath).toHaveBeenCalledWith('/opaque-to-renderer')

    await expect(openSelectedOutputDirectory('/opaque-to-renderer', vi.fn().mockResolvedValue('native error with path')))
      .rejects.toThrow('Could not open the selected save destination. Choose another folder in Settings.')
  })
})
