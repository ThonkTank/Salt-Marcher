import { describe, expect, it, vi } from 'vitest'
import type {
  Browser as WdioBrowser,
  ChainablePromiseElement
} from 'webdriverio'
import {
  clickWhenInteractable,
  isStaleElementError,
  selectByVisibleTextWhenInteractable,
  type E2eElementLocator
} from '../e2e/support/e2e-interactions.js'

describe('E2E interactions', () => {
  it('waits, DOM-scrolls, resolves again, checks clickability and clicks', async () => {
    const events: string[] = []
    const first = element(events, 'first')
    const refreshed = element(events, 'refreshed')
    const locate = vi
      .fn<E2eElementLocator>()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(refreshed)
    const client = browser(events)

    await clickWhenInteractable(client, locate)

    expect(events).toEqual([
      'first:exist',
      'browser:execute',
      'first:dom-scroll',
      'refreshed:clickable',
      'refreshed:click'
    ])
    expect(locate).toHaveBeenCalledTimes(2)
  })

  it('repeats the bounded sequence exactly once for a stale element', async () => {
    const events: string[] = []
    const stale = element(events, 'stale', new Error('stale element reference'))
    const locate = vi
      .fn<E2eElementLocator>()
      .mockReturnValueOnce(element(events, 'first'))
      .mockReturnValueOnce(stale)
      .mockReturnValueOnce(element(events, 'retry-first'))
      .mockReturnValueOnce(element(events, 'retry-refreshed'))

    await clickWhenInteractable(browser(events), locate)

    expect(locate).toHaveBeenCalledTimes(4)
    expect(events.filter((event) => event === 'browser:execute')).toHaveLength(
      2
    )
  })

  it('does not repeat non-stale failures or a second stale failure', async () => {
    const nonStale = new Error('element is not clickable')
    const nonStaleLocator = vi
      .fn<E2eElementLocator>()
      .mockReturnValue(element([], 'non-stale', nonStale))
    await expect(
      clickWhenInteractable(browser([]), nonStaleLocator)
    ).rejects.toBe(nonStale)
    expect(nonStaleLocator).toHaveBeenCalledTimes(2)

    const stale = new Error('stale element reference')
    const staleLocator = vi
      .fn<E2eElementLocator>()
      .mockReturnValue(element([], 'stale', stale))
    await expect(clickWhenInteractable(browser([]), staleLocator)).rejects.toBe(
      stale
    )
    expect(staleLocator).toHaveBeenCalledTimes(4)
    expect(isStaleElementError(stale)).toBe(true)
  })

  it('selects through the DOM and confirms through a fresh element', async () => {
    const events: string[] = []
    const state = { value: '' }
    const locate = vi
      .fn<E2eElementLocator>()
      .mockImplementation(() => selectElement(events, state))

    await selectByVisibleTextWhenInteractable(
      browser(events),
      locate,
      'Expected option'
    )

    expect(state.value).toBe('expected')
    expect(locate).toHaveBeenCalledTimes(2)
    expect(events).toEqual([
      'select:exist',
      'browser:execute',
      'select:input',
      'select:change',
      'browser:wait',
      'select:value'
    ])
  })
})

function browser(events: string[]): WdioBrowser {
  return {
    execute: (
      script: (...arguments_: unknown[]) => unknown,
      ...arguments_: unknown[]
    ) => {
      events.push('browser:execute')
      return Promise.resolve(script(...arguments_))
    },
    waitUntil: (condition: () => Promise<boolean>) => {
      events.push('browser:wait')
      return condition().then((result) => {
        if (!result) throw new Error('Mock condition did not pass')
        return true
      })
    }
  } as unknown as WdioBrowser
}

function element(
  events: string[],
  name: string,
  clickError?: Error
): Promise<ChainablePromiseElement> {
  const value = {
    waitForExist: () => {
      events.push(`${name}:exist`)
      return Promise.resolve(true)
    },
    scrollIntoView: () => events.push(`${name}:dom-scroll`),
    waitForClickable: () => {
      events.push(`${name}:clickable`)
      return Promise.resolve(true)
    },
    click: () => {
      events.push(`${name}:click`)
      return clickError ? Promise.reject(clickError) : Promise.resolve()
    }
  } as unknown as ChainablePromiseElement
  return Promise.resolve(value)
}

function selectElement(
  events: string[],
  state: { value: string }
): Promise<ChainablePromiseElement> {
  const value = {
    options: [{ text: 'Expected option', value: 'expected' }],
    get value() {
      return state.value
    },
    set value(next: string) {
      state.value = next
    },
    dispatchEvent: (event: Event) => {
      events.push(`select:${event.type}`)
      return true
    },
    waitForExist: () => {
      events.push('select:exist')
      return Promise.resolve(true)
    },
    getValue: () => {
      events.push('select:value')
      return Promise.resolve(state.value)
    }
  } as unknown as ChainablePromiseElement
  return Promise.resolve(value)
}
