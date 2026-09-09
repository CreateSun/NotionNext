import throttle from '@/lib/utils/throttle'

describe('throttle', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-09-09T00:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('exposes the lodash-compatible cancel method', () => {
    const throttled = throttle(jest.fn(), 100)

    expect(typeof throttled.cancel).toBe('function')
  })

  it('cancels a pending trailing invocation', () => {
    const callback = jest.fn()
    const throttled = throttle(callback, 100)

    throttled('first')
    throttled('pending')
    throttled.cancel()
    jest.advanceTimersByTime(100)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenLastCalledWith('first')
  })

  it('runs the next call immediately after cancellation', () => {
    const callback = jest.fn()
    const throttled = throttle(callback, 100)

    throttled('first')
    throttled('pending')
    throttled.cancel()
    throttled('after-cancel')

    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenLastCalledWith('after-cancel')
  })
})
