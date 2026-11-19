// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'
import { vi } from 'vitest'

function parseSleepDurationMs(param: string | Date | number): number {
  if (typeof param === 'number' && Number.isFinite(param)) {
    return Math.max(0, param)
  }
  if (param instanceof Date) {
    return Math.max(0, param.getTime() - Date.now())
  }
  if (typeof param === 'string') {
    const match =
      /^(\d+(?:\.\d+)?)\s*(ms|s|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)?$/i.exec(
        param.trim(),
      )
    if (match) {
      const value = Number(match[1])
      const unit = (match[2] || 'ms').toLowerCase()
      if (unit === 'ms') return value
      if (unit === 's') return value * 1000
      if (unit === 'm' || unit.startsWith('min')) return value * 60 * 1000
      if (unit === 'h' || unit.startsWith('hr') || unit.startsWith('hour')) {
        return value * 60 * 60 * 1000
      }
      if (unit === 'd' || unit.startsWith('day')) return value * 24 * 60 * 60 * 1000
    }
  }
  return 0
}

interface MockHookState {
  queue: unknown[]
  waiters: Array<(val: unknown) => void>
  disposed: boolean
}

const mockHookRegistry = new Map<string, MockHookState>()

;(globalThis as unknown as {
  __waitForWorkflowHook__?: (token: string, timeoutMs?: number) => Promise<void>
}).__waitForWorkflowHook__ = async (token: string, timeoutMs = 2000) => {
  const startAt = Date.now()
  while (Date.now() - startAt < timeoutMs) {
    const state = mockHookRegistry.get(token)
    if (state && !state.disposed && state.waiters.length > 0) {
      return
    }
    await new Promise((r) => setTimeout(r, 5))
  }
  throw new Error(`Timed out waiting for workflow hook: ${token}`)
}

function createMockHook<T = unknown>(options?: { token?: string }) {
  const token =
    options?.token || `hook_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const state: MockHookState = {
    queue: [],
    waiters: [],
    disposed: false,
  }
  mockHookRegistry.set(token, state)

  const pullNext = (): Promise<T> => {
    if (state.queue.length > 0) {
      return Promise.resolve(state.queue.shift() as T)
    }
    return new Promise<T>((resolve) => {
      state.waiters.push(resolve as (val: unknown) => void)
    })
  }

  const dispose = () => {
    state.disposed = true
    mockHookRegistry.delete(token)
  }

  return {
    token,
    getConflict: async () => null,
    dispose,
    [Symbol.dispose]: dispose,
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      return pullNext().then(onfulfilled, onrejected)
    },
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<T>> {
          if (state.disposed) {
            return { value: undefined as unknown as T, done: true }
          }
          const value = await pullNext()
          return { value, done: false }
        },
      }
    },
  }
}

async function resumeMockHook(token: string, payload: unknown) {
  const state = mockHookRegistry.get(token)
  if (!state || state.disposed) {
    throw new Error(`Hook not found for token: ${token}`)
  }
  if (state.waiters.length > 0) {
    const waiter = state.waiters.shift()!
    waiter(payload)
  } else {
    state.queue.push(payload)
  }
  return { token }
}

vi.mock('workflow', () => ({
  sleep: (param: string | Date | number) =>
    new Promise<void>((resolve) => setTimeout(resolve, parseSleepDurationMs(param))),
  createHook: createMockHook,
  defineHook: ({ schema }: { schema?: { '~standard'?: { validate: (v: unknown) => unknown } } } = {}) => ({
    create: createMockHook,
    async resume(token: string, payload: unknown) {
      if (schema?.['~standard']) {
        let res = schema['~standard'].validate(payload) as {
          issues?: Array<{ message: string }>
          value?: unknown
        }
        if (res instanceof Promise) {
          res = await res
        }
        if (res.issues) {
          throw new Error(res.issues.map((i) => i.message).join(', '))
        }
        return resumeMockHook(token, res.value)
      }
      return resumeMockHook(token, payload)
    },
  }),
}))

vi.mock('workflow/api', () => ({
  resumeHook: resumeMockHook,
  start: async (workflowFn: (...args: unknown[]) => Promise<unknown>, args: unknown[] = []) => {
    const runId = `wrun_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const returnValue = Promise.resolve().then(() => workflowFn(...args))
    returnValue.catch(() => {})
    return {
      runId,
      status: returnValue.then(
        () => 'completed' as const,
        () => 'failed' as const,
      ),
      returnValue,
    }
  },
}))
