#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const PROFILE_FILE = path.join(
  ROOT,
  'docs/research/x-creators/data/phase-1/profiles.json'
)
const OUTPUT_DIR = path.join(ROOT, 'docs/research/x-creators/data/phase-3/raw')
const PILOTS = new Set([
  'gefei55',
  'tualatrix',
  'indie_maker_fox',
  'yupi996',
  'seclink'
])
const FIELDS = [
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

async function requestJson(url, token) {
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
        throw new Error('网络请求失败' + (detail ? '（' + detail + '）' : ''))
      await new Promise(resolve => setTimeout(resolve, attempt * 750))
    }
  }
  const rawText = await response.text()
  const payload = rawText ? JSON.parse(rawText) : null
  if (!response.ok)
    throw new Error('HTTP ' + response.status + '：' + JSON.stringify(payload))
  return { payload, rawText }
}

async function readValidJson(filename) {
  try {
    return JSON.parse(await fs.readFile(filename, 'utf8'))
  } catch {
    return null
  }
}

async function main() {
  await loadEnv()
  const token = process.env.X_BEARER_TOKEN
  if (!token)
    throw new Error('未找到 X_BEARER_TOKEN；请配置项目根目录 .env.local')
  const profiles = JSON.parse(await fs.readFile(PROFILE_FILE, 'utf8'))
  const accounts = profiles.accounts.filter(
    account => account.selected && !PILOTS.has(account.username)
  )
  if (accounts.length !== 48)
    throw new Error('剩余账号应为 48 个，实际为 ' + accounts.length + ' 个')
  await fs.mkdir(OUTPUT_DIR, { recursive: true })

  const failures = []
  let recentPostCount = 0
  for (const [index, account] of accounts.entries()) {
    const filename = path.join(
      OUTPUT_DIR,
      account.username + '.recent.raw.json'
    )
    const saved = await readValidJson(filename)
    if (saved) {
      recentPostCount += saved.meta?.result_count ?? saved.data?.length ?? 0
      console.log(
        '[' + (index + 1) + '/48] @' + account.username + ': 已保存，跳过'
      )
      continue
    }
    const url = new URL(
      'https://api.x.com/2/users/' + account.profile.id + '/tweets'
    )
    url.searchParams.set('max_results', '5')
    url.searchParams.set('exclude', 'retweets,replies')
    url.searchParams.set('tweet.fields', FIELDS.join(','))
    try {
      const result = await requestJson(url, token)
      await fs.writeFile(filename, result.rawText)
      const count =
        result.payload.meta?.result_count ?? result.payload.data?.length ?? 0
      recentPostCount += count
      console.log(
        '[' + (index + 1) + '/48] @' + account.username + ': ' + count + ' 条'
      )
    } catch (error) {
      failures.push({
        username: account.username,
        stage: 'recent',
        error: error.message
      })
      console.error(
        '[' +
          (index + 1) +
          '/48] @' +
          account.username +
          ': 失败：' +
          error.message
      )
    }
  }

  const pinnedIds = [
    ...new Set(
      accounts.map(account => account.profile.pinned_tweet_id).filter(Boolean)
    )
  ]
  const pinnedFile = path.join(OUTPUT_DIR, 'pinned.raw.json')
  if (pinnedIds.length && !(await readValidJson(pinnedFile))) {
    try {
      const url = new URL('https://api.x.com/2/tweets')
      url.searchParams.set('ids', pinnedIds.join(','))
      url.searchParams.set('tweet.fields', FIELDS.join(','))
      const result = await requestJson(url, token)
      await fs.writeFile(pinnedFile, result.rawText)
      console.log(
        '置顶帖：请求 ' +
          pinnedIds.length +
          ' 条，返回 ' +
          (result.payload.data?.length ?? 0) +
          ' 条'
      )
    } catch (error) {
      failures.push({ stage: 'pinned', error: error.message })
      console.error('置顶帖失败：' + error.message)
    }
  }

  const rawFiles = []
  for (const account of accounts) {
    if (
      await readValidJson(
        path.join(OUTPUT_DIR, account.username + '.recent.raw.json')
      )
    )
      rawFiles.push(account.username + '.recent.raw.json')
  }
  if (await readValidJson(pinnedFile)) rawFiles.push('pinned.raw.json')
  const manifest = {
    generatedAt: new Date().toISOString(),
    source: 'X API v2',
    handles: accounts.map(account => account.username),
    requestedRecentPostsPerUser: 5,
    recentRawFileCount: rawFiles.filter(name =>
      name.endsWith('.recent.raw.json')
    ).length,
    recentPostCount,
    pinnedTweetIds: pinnedIds,
    rawFiles,
    failures
  }
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  )
  if (failures.length)
    throw new Error(
      failures.length + ' 个采集阶段失败；可安全重跑，已有原始文件会跳过'
    )
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
