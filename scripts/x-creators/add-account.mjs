#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const handle = (process.argv[2] || '').replace(/^@/, '').toLowerCase()
const BASE = path.join(ROOT, 'docs/research/x-creators/data/additions', handle)
const USER_FIELDS = [
  'id',
  'name',
  'username',
  'description',
  'url',
  'location',
  'created_at',
  'public_metrics',
  'entities',
  'profile_image_url',
  'pinned_tweet_id',
  'verified',
  'verified_type'
]
const TWEET_FIELDS = [
  'id',
  'text',
  'created_at',
  'public_metrics',
  'entities',
  'attachments',
  'article',
  'conversation_id'
]

async function loadEnv() {
  for (const filename of ['.env.local', '.env']) {
    let content
    try {
      content = await fs.readFile(path.join(ROOT, filename), 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!match || process.env[match[1]]) continue
      let value = match[2]
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      )
        value = value.slice(1, -1)
      process.env[match[1]] = value
    }
  }
}

async function exists(filename) {
  try {
    await fs.access(filename)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

async function requestRawJson(url, token, filename) {
  if (await exists(filename)) {
    console.log('跳过已存在的原始响应：' + path.relative(ROOT, filename))
    return JSON.parse(await fs.readFile(filename, 'utf8'))
  }
  let response
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await fetch(url, {
        headers: { Authorization: 'Bearer ' + token }
      })
      break
    } catch (error) {
      const detail = [error.cause?.code, error.cause?.message]
        .filter(Boolean)
        .join(': ')
      if (attempt === 3)
        throw new Error(
          'X API 网络请求失败' + (detail ? '（' + detail + '）' : '')
        )
      await new Promise(resolve => setTimeout(resolve, attempt * 750))
    }
  }
  const rawText = await response.text()
  let payload
  try {
    payload = rawText ? JSON.parse(rawText) : null
  } catch {
    throw new Error('X API 返回非 JSON 内容（HTTP ' + response.status + '）')
  }
  if (!response.ok)
    throw new Error(
      'X API HTTP ' + response.status + '：' + JSON.stringify(payload)
    )
  await fs.writeFile(filename, rawText.trimEnd() + '\n')
  console.log('保存原始响应：' + path.relative(ROOT, filename))
  return payload
}

function externalUrls(user) {
  const urls = [
    ...(user.entities?.url?.urls || []),
    ...(user.entities?.description?.urls || [])
  ]
    .map(item => item.expanded_url || item.unwound_url || item.url)
    .filter(Boolean)
  return [...new Set(urls)].filter(value => {
    try {
      const hostname = new URL(value).hostname
        .replace(/^www\./, '')
        .toLowerCase()
      return !['x.com', 'twitter.com'].includes(hostname)
    } catch {
      return false
    }
  })
}

function cleanHtml(value) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function meta(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) || []
  for (const tag of tags) {
    if (
      !new RegExp('(name|property)=["\\\']' + name + '["\\\']', 'i').test(tag)
    )
      continue
    const match = tag.match(/content=["']([^"']*)["']/i)
    if (match) return cleanHtml(match[1])
  }
  return null
}

async function captureUrl(url) {
  const capturedAt = new Date().toISOString()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; XCreatorResearch/1.0; +https://www.createsun.work/)'
      }
    })
    const contentType = response.headers.get('content-type') || ''
    const html = /html|text\//i.test(contentType) ? await response.text() : ''
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    return {
      sourceUrl: url,
      finalUrl: response.url,
      capturedAt,
      status: response.status,
      ok: response.ok,
      contentType,
      title: titleMatch ? cleanHtml(titleMatch[1]) : null,
      description: meta(html, 'description') || meta(html, 'og:description'),
      textExcerpt: cleanHtml(html).slice(0, 6000)
    }
  } catch (error) {
    return {
      sourceUrl: url,
      capturedAt,
      ok: false,
      error: error.name + ': ' + error.message
    }
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  if (!/^[a-z0-9_]{1,15}$/.test(handle))
    throw new Error('用法：node scripts/x-creators/add-account.mjs <handle>')
  await loadEnv()
  const token = process.env.X_BEARER_TOKEN
  if (!token) throw new Error('缺少 X_BEARER_TOKEN')
  await fs.mkdir(BASE, { recursive: true })

  const profileParams = new URLSearchParams({
    'user.fields': USER_FIELDS.join(',')
  })
  const profile = await requestRawJson(
    'https://api.x.com/2/users/by/username/' + handle + '?' + profileParams,
    token,
    path.join(BASE, 'profile.raw.json')
  )
  if (!profile?.data?.id) throw new Error('X API 未返回用户资料')

  const recentParams = new URLSearchParams({
    max_results: '5',
    exclude: 'retweets,replies',
    'tweet.fields': TWEET_FIELDS.join(',')
  })
  await requestRawJson(
    'https://api.x.com/2/users/' + profile.data.id + '/tweets?' + recentParams,
    token,
    path.join(BASE, 'recent.raw.json')
  )

  if (profile.data.pinned_tweet_id) {
    const pinnedParams = new URLSearchParams({
      ids: profile.data.pinned_tweet_id,
      'tweet.fields': TWEET_FIELDS.join(',')
    })
    await requestRawJson(
      'https://api.x.com/2/tweets?' + pinnedParams,
      token,
      path.join(BASE, 'pinned.raw.json')
    )
  }

  const webFile = path.join(BASE, 'web.json')
  if (!(await exists(webFile))) {
    const urls = externalUrls(profile.data)
    const pages = []
    for (const url of urls) pages.push(await captureUrl(url))
    await fs.writeFile(
      webFile,
      JSON.stringify(
        { handle, capturedAt: new Date().toISOString(), urls, pages },
        null,
        2
      ) + '\n'
    )
    console.log('保存网站证据：' + path.relative(ROOT, webFile))
  } else {
    console.log('跳过已存在的网站证据：' + path.relative(ROOT, webFile))
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
