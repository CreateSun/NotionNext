#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const PROFILE_FILE = path.join(
  ROOT,
  'docs/research/x-creators/data/phase-1/profiles.json'
)
const OUTPUT_DIR = path.join(ROOT, 'docs/research/x-creators/data/phase-3/web')
const PILOTS = new Set([
  'gefei55',
  'tualatrix',
  'indie_maker_fox',
  'yupi996',
  'seclink'
])

function decode(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
}

function plain(html) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

function matchOne(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return plain(match[1])
  }
  return ''
}

function analyze(html) {
  const title = matchOne(html, [
    /<title[^>]*>([\s\S]*?)<\/title>/i,
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)/i
  ])
  const description = matchOne(html, [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)/i
  ])
  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map(match => plain(match[1]))
    .filter(Boolean)
    .slice(0, 30)
  const text = plain(html).slice(0, 30000)
  const pricingSnippets = [
    ...text.matchAll(
      /.{0,100}(?:US\$|HK\$|\$\s?\d|¥\s?\d|￥\s?\d|\d+\s?元|pricing|price|订阅|会员|终身|买断|付费).{0,160}/gi
    )
  ]
    .map(match => match[0].trim())
    .slice(0, 20)
  return { title, description, headings, pricingSnippets }
}

async function fetchPage(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; XCreatorResearch/1.0)',
        accept: 'text/html,application/xhtml+xml'
      }
    })
    const contentType = response.headers.get('content-type') || ''
    if (
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml+xml')
    )
      return {
        requestedUrl: url,
        finalUrl: response.url,
        status: response.status,
        contentType,
        error: '非 HTML 页面'
      }
    const html = await response.text()
    return {
      requestedUrl: url,
      finalUrl: response.url,
      status: response.status,
      contentType,
      capturedAt: new Date().toISOString(),
      ...analyze(html)
    }
  } catch (error) {
    return {
      requestedUrl: url,
      finalUrl: null,
      status: null,
      capturedAt: new Date().toISOString(),
      error: error.name === 'AbortError' ? '请求超时' : error.message
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length)
  let cursor = 0
  async function run() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}

async function main() {
  const profiles = JSON.parse(await fs.readFile(PROFILE_FILE, 'utf8'))
  const accounts = profiles.accounts.filter(
    account => account.selected && !PILOTS.has(account.username)
  )
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  const results = await mapLimit(accounts, 4, async (account, index) => {
    const urls = [
      ...new Set(
        account.urls
          .filter(item => item.isExternal)
          .map(item => item.expandedUrl)
      )
    ].slice(0, 3)
    const pages = []
    for (const url of urls) pages.push(await fetchPage(url))
    const result = {
      username: account.username,
      capturedAt: new Date().toISOString(),
      pages
    }
    await fs.writeFile(
      path.join(OUTPUT_DIR, account.username + '.web.json'),
      JSON.stringify(result, null, 2) + '\n'
    )
    console.log(
      '[' +
        (index + 1) +
        '/' +
        accounts.length +
        '] @' +
        account.username +
        ': ' +
        pages.filter(page => page.status >= 200 && page.status < 400).length +
        '/' +
        pages.length +
        ' 可访问'
    )
    return result
  })
  const manifest = {
    generatedAt: new Date().toISOString(),
    accountCount: results.length,
    pageCount: results.reduce((sum, result) => sum + result.pages.length, 0),
    successfulPageCount: results.reduce(
      (sum, result) =>
        sum +
        result.pages.filter(page => page.status >= 200 && page.status < 400)
          .length,
      0
    ),
    files: results.map(result => result.username + '.web.json')
  }
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  )
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
