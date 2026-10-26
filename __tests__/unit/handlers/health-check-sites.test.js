import { jest } from '@jest/globals'

const fetch = jest.fn()
jest.unstable_mockModule('node-fetch', () => ({ default: fetch }))

const targets = ['https://first.example', 'https://second.example']
const webhook = 'https://slack.example/webhook'
let healthCheckSites

beforeEach(async () => {
  jest.resetModules()
  jest.useFakeTimers()
  jest.replaceProperty(process, 'env', {
    ...process.env,
    TARGETS: targets.join(','),
    WEBHOOK_URL: webhook
  })
  fetch.mockReset().mockResolvedValue({ ok: true })
  ;({ healthCheckSites } = await import('../../../src/handlers/health-check-sites.js'))
})

afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it('announces the targets and checks every site', async () => {
  await expect(healthCheckSites()).resolves.toEqual({ success: true })

  expect(fetch).toHaveBeenNthCalledWith(1, webhook, {
    method: 'post',
    body: JSON.stringify({
      text: `health-check-sites: On invoked, I show targets list\n${targets.join('\n')}`
    })
  })
  for (const target of targets) {
    expect(fetch).toHaveBeenCalledWith(target, {
      signal: expect.objectContaining({ aborted: false })
    })
  }
  expect(fetch).toHaveBeenCalledTimes(3)
})

it('reports a failed request to Slack and still checks the other site', async () => {
  fetch.mockImplementation(async url => {
    if (url === targets[0]) throw new Error('connection refused')
    return { ok: true }
  })

  await expect(healthCheckSites()).resolves.toEqual({ success: true })

  expect(fetch).toHaveBeenCalledWith(webhook, {
    method: 'post',
    body: JSON.stringify({
      text: `<!here> Error: url; ${targets[0]} detail; Error: connection refused`
    })
  })
  expect(fetch).toHaveBeenCalledWith(targets[1], { signal: expect.anything() })
})

it('aborts stalled requests after 11 seconds and reports them to Slack', async () => {
  fetch.mockImplementation((url, options) => {
    if (url === webhook) return Promise.resolve({ ok: true })
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('request aborted')))
    })
  })

  const result = healthCheckSites()
  await jest.advanceTimersByTimeAsync(10999)
  const requests = fetch.mock.calls.filter(([url]) => targets.includes(url))
  expect(requests).toHaveLength(2)
  for (const [, { signal }] of requests) expect(signal.aborted).toBe(false)

  await jest.advanceTimersByTimeAsync(1)
  await expect(result).resolves.toEqual({ success: true })
  for (const [url, { signal }] of requests) {
    expect(signal.aborted).toBe(true)
    expect(fetch).toHaveBeenCalledWith(webhook, {
      method: 'post',
      body: JSON.stringify({
        text: `<!here> Error: url; ${url} detail; Error: request aborted`
      })
    })
  }
})
