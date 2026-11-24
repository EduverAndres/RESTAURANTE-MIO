// Whether a request comes from an automated client, judged by its
// User-Agent. Pure: takes a string, imports nothing.
//
// Used where a request should be served but not counted (a click on a
// sponsored placement). It is a filter for statistics, never a security
// control: the header is the client's to choose, and a bot that lies about
// itself only inflates a click count that is informative, not billed.

const AUTOMATED = new RegExp(
  [
    'bot\\b',
    'bot/',
    'crawl',
    'spider',
    'slurp',
    'mediapartners',
    'facebookexternalhit',
    'whatsapp',
    'telegram',
    'embedly',
    'preview',
    'headless',
    'lighthouse',
    'pagespeed',
    'curl/',
    'wget/',
    'python-requests',
    'python-urllib',
    'httpclient',
    'okhttp',
    'axios/',
    'node-fetch',
    'go-http-client',
    'monitor',
    'uptime',
  ].join('|'),
  'i',
)

/** True for crawlers, link previews, scripts and empty user agents. */
export function isAutomatedUserAgent(userAgent: string | null): boolean {
  if (!userAgent || userAgent.trim().length === 0) return true
  return AUTOMATED.test(userAgent)
}
