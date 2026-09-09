#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const PROJECT_ROOT = process.cwd()
const PROFILE_FILE = path.join(
  PROJECT_ROOT,
  'docs/research/x-creators/data/phase-1/profiles.json'
)
const OUTPUT_DIR = path.join(
  PROJECT_ROOT,
  'docs/research/x-creators/data/phase-2/raw'
)
const PILOT_HANDLES = [
  'gefei55',
  'tualatrix',
  'indie_maker_fox',
  'yupi996',
  'seclink'
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

async function loadLocalEnv() {
  for (const filename of ['.env.local', '.env']) {
    let content
    try {
      content = await fs.readFile(path.join(PROJECT_ROOT, filename), 'utf8')
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
        headers: { Authorization: `Bearer ${token}` }
      })
      break
    } catch (error) {
      const cause = error.cause
      const detail = [cause?.code, cause?.message].filter(Boolean).join(': ')
      if (attempt === 3)
        throw new Error(`X API 网络请求失败${detail ? `（${detail}）` : ''}`)
      await new Promise(resolve => setTimeout(resolve, attempt * 500))
    }
  }
  const rawText = await response.text()
  const payload = rawText ? JSON.parse(rawText) : null
  if (!response.ok)
    throw new Error(
      `X API 请求失败（HTTP ${response.status}）：${JSON.stringify(payload)}`
    )
  return { payload, rawText }
}

async function main() {
  await loadLocalEnv()
  const token = process.env.X_BEARER_TOKEN
  if (!token)
    throw new Error('未找到 X_BEARER_TOKEN；请配置项目根目录 .env.local')

  const profileResult = JSON.parse(await fs.readFile(PROFILE_FILE, 'utf8'))
  const profileByHandle = new Map(
    profileResult.accounts.map(account => [account.username, account])
  )
  const pilots = PILOT_HANDLES.map(handle => {
    const account = profileByHandle.get(handle)
    if (!account?.profile?.id)
      throw new Error(`缺少试生产账号 @${handle} 的用户 ID`)
    return account
  })
  await fs.mkdir(OUTPUT_DIR, { recursive: true })

  for (const account of pilots) {
    const url = new URL(
      `https://api.x.com/2/users/${account.profile.id}/tweets`
    )
    url.searchParams.set('max_results', '5')
    url.searchParams.set('exclude', 'retweets,replies')
    url.searchParams.set('tweet.fields', TWEET_FIELDS.join(','))
    const response = await requestJson(url, token)
    await fs.writeFile(
      path.join(OUTPUT_DIR, `${account.username}.recent.raw.json`),
      response.rawText
    )
    console.log(
      `@${account.username}: 最近原创帖 ${response.payload.meta?.result_count ?? response.payload.data?.length ?? 0} 条`
    )
  }

  const pinnedIds = [
    ...new Set(
      pilots.map(account => account.profile.pinned_tweet_id).filter(Boolean)
    )
  ]
  if (pinnedIds.length) {
    const url = new URL('https://api.x.com/2/tweets')
    url.searchParams.set('ids', pinnedIds.join(','))
    url.searchParams.set('tweet.fields', TWEET_FIELDS.join(','))
    const response = await requestJson(url, token)
    await fs.writeFile(
      path.join(OUTPUT_DIR, 'pinned.raw.json'),
      response.rawText
    )
    console.log(
      `置顶帖：请求 ${pinnedIds.length} 条，返回 ${response.payload.data?.length ?? 0} 条`
    )
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: 'X API v2',
    handles: PILOT_HANDLES,
    recentPostRequestCount: pilots.length,
    requestedRecentPostsPerUser: 5,
    pinnedTweetIds: pinnedIds,
    rawFiles: [
      ...PILOT_HANDLES.map(handle => `${handle}.recent.raw.json`),
      ...(pinnedIds.length ? ['pinned.raw.json'] : [])
    ]
  }
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  )
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
