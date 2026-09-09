#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const PROJECT_ROOT = process.cwd()
const DEFAULT_SOURCE = path.join(
  PROJECT_ROOT,
  'docs/research/x-creators/README.md'
)
const DEFAULT_OUTPUT_DIR = path.join(
  PROJECT_ROOT,
  'docs/research/x-creators/data/phase-1'
)
const X_USERS_ENDPOINT = 'https://api.x.com/2/users/by'
const ACTUAL_PROFILE_READ_COST_USD = 0.69
const USER_FIELDS = [
  'id',
  'name',
  'username',
  'description',
  'url',
  'entities',
  'public_metrics',
  'pinned_tweet_id',
  'created_at',
  'verified'
]
const TARGET_SECTIONS = new Map([
  ['创业者领域', '创业者'],
  ['SaaS 和 APP 产品领域', 'SaaS 和 APP 产品'],
  ['出海领域', '出海'],
  ['独立开发者领域', '独立开发者'],
  ['副业领域', '副业']
])
const EXPECTED_COUNTS = new Map([
  ['创业者', 21],
  ['SaaS 和 APP 产品', 20],
  ['独立开发者', 16],
  ['出海', 9],
  ['副业', 7]
])

function parseArgs(argv) {
  const options = {
    execute: false,
    source: DEFAULT_SOURCE,
    outputDir: DEFAULT_OUTPUT_DIR,
    responseFile: null
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--execute') options.execute = true
    else if (argument === '--source')
      options.source = path.resolve(argv[++index])
    else if (argument === '--output-dir')
      options.outputDir = path.resolve(argv[++index])
    else if (argument === '--response-file')
      options.responseFile = path.resolve(argv[++index])
    else if (argument === '--help' || argument === '-h') {
      printHelp()
      process.exit(0)
    } else throw new Error(`未知参数：${argument}`)
  }
  if (options.execute && options.responseFile)
    throw new Error('--execute 与 --response-file 不能同时使用')
  return options
}

function printHelp() {
  console.log(`中文 X 创作者主页筛选

用法：
  node scripts/x-creators/screen-profiles.mjs
  node scripts/x-creators/screen-profiles.mjs --execute
  node scripts/x-creators/screen-profiles.mjs --response-file fixture.json

默认模式只解析和校验账号，不访问 X API，也不产生 API 费用。
--execute 会读取 .env.local 中的 X_BEARER_TOKEN，并调用一次官方用户批量查询。
`)
}

async function loadLocalEnv() {
  for (const filename of ['.env.local', '.env']) {
    const filepath = path.join(PROJECT_ROOT, filename)
    let content
    try {
      content = await fs.readFile(filepath, 'utf8')
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

function extractAccounts(markdown) {
  const records = []
  let currentCategory = null
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^####\s+(.+?)\s*$/)
    if (heading) {
      currentCategory =
        [...TARGET_SECTIONS].find(([title]) =>
          heading[1].endsWith(title)
        )?.[1] ?? null
      continue
    }
    if (!currentCategory) continue
    const account = line.match(/^\s*1\.\s+.*?([^@\s]+)@([A-Za-z0-9_]+)\s*$/)
    if (!account) continue
    records.push({
      displayName: account[1],
      username: account[2].toLowerCase(),
      sourceUsername: account[2],
      category: currentCategory
    })
  }

  const accounts = new Map()
  for (const record of records) {
    const existing = accounts.get(record.username) ?? {
      username: record.username,
      sourceUsernames: [],
      displayNames: [],
      categories: []
    }
    if (!existing.sourceUsernames.includes(record.sourceUsername))
      existing.sourceUsernames.push(record.sourceUsername)
    if (!existing.displayNames.includes(record.displayName))
      existing.displayNames.push(record.displayName)
    if (!existing.categories.includes(record.category))
      existing.categories.push(record.category)
    accounts.set(record.username, existing)
  }
  validateAccountSet(records, accounts)
  return { records, accounts: [...accounts.values()] }
}

function validateAccountSet(records, accounts) {
  if (records.length !== 73)
    throw new Error(`原始账号应为 73 条，实际解析到 ${records.length} 条`)
  if (accounts.size !== 68)
    throw new Error(`唯一账号应为 68 个，实际解析到 ${accounts.size} 个`)
  for (const [category, expected] of EXPECTED_COUNTS) {
    const actual = records.filter(record => record.category === category).length
    if (actual !== expected)
      throw new Error(`${category}应为 ${expected} 条，实际解析到 ${actual} 条`)
  }
}

function normalizeUrl(value) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}

function isExternalUrl(value) {
  const normalized = normalizeUrl(value)
  if (!normalized) return false
  const hostname = new URL(normalized).hostname.toLowerCase()
  return !(
    hostname === 'x.com' ||
    hostname.endsWith('.x.com') ||
    hostname === 'twitter.com' ||
    hostname.endsWith('.twitter.com') ||
    hostname === 't.co' ||
    hostname.endsWith('.t.co')
  )
}

function collectUrlCandidates(profile) {
  const candidates = []
  const addEntityUrls = (items, source) => {
    for (const item of items ?? []) {
      const originalUrl = normalizeUrl(item.url)
      const expandedUrl = normalizeUrl(item.expanded_url) ?? originalUrl
      if (!expandedUrl) continue
      candidates.push({
        source,
        originalUrl,
        expandedUrl,
        displayUrl: item.display_url ?? null
      })
    }
  }
  addEntityUrls(profile.entities?.url?.urls, 'entities.url.urls')
  addEntityUrls(
    profile.entities?.description?.urls,
    'entities.description.urls'
  )
  const directUrl = normalizeUrl(profile.url)
  if (
    directUrl &&
    !candidates.some(
      item => item.originalUrl === directUrl || item.expandedUrl === directUrl
    )
  ) {
    candidates.push({
      source: 'url',
      originalUrl: directUrl,
      expandedUrl: directUrl,
      displayUrl: null
    })
  }
  for (const match of profile.description?.matchAll(/https?:\/\/[^\s<>()]+/g) ??
    []) {
    const descriptionUrl = normalizeUrl(
      match[0].replace(/[.,;!?，。；！？]+$/, '')
    )
    if (
      descriptionUrl &&
      !candidates.some(
        item =>
          item.originalUrl === descriptionUrl ||
          item.expandedUrl === descriptionUrl
      )
    ) {
      candidates.push({
        source: 'description',
        originalUrl: descriptionUrl,
        expandedUrl: descriptionUrl,
        displayUrl: null
      })
    }
  }
  return candidates.map(candidate => ({
    ...candidate,
    isExternal: isExternalUrl(candidate.expandedUrl)
  }))
}

async function fetchProfiles(usernames, bearerToken) {
  const url = new URL(X_USERS_ENDPOINT)
  url.searchParams.set('usernames', usernames.join(','))
  url.searchParams.set('user.fields', USER_FIELDS.join(','))
  let response
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` }
    })
  } catch (error) {
    const cause = error.cause
    const detail = [cause?.code, cause?.message].filter(Boolean).join(': ')
    throw new Error(`X API 网络请求失败${detail ? `（${detail}）` : ''}`)
  }
  const rawText = await response.text()
  const payload = rawText ? JSON.parse(rawText) : null
  if (!response.ok)
    throw new Error(
      `X API 请求失败（HTTP ${response.status}）：${JSON.stringify(payload)}`
    )
  return { payload, rawText }
}

function buildResult(accountSet, payload, source) {
  const profiles = new Map(
    (payload.data ?? []).map(profile => [
      profile.username.toLowerCase(),
      profile
    ])
  )
  const errors = new Map(
    (payload.errors ?? []).map(error => [
      String(error.value ?? '').toLowerCase(),
      error
    ])
  )
  const accounts = accountSet.map(account => {
    const profile = profiles.get(account.username)
    if (!profile)
      return {
        ...account,
        status: '账号不可用',
        error: errors.get(account.username) ?? null,
        profile: null,
        urls: [],
        selected: false
      }
    const urls = collectUrlCandidates(profile)
    return {
      ...account,
      status: urls.some(item => item.isExternal) ? '待采集' : '无外部链接',
      error: null,
      profile,
      urls,
      selected: urls.some(item => item.isExternal)
    }
  })
  const selectedCount = accounts.filter(account => account.selected).length
  const postReadUpperBoundUsd = Number((selectedCount * 0.03).toFixed(2))
  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      source,
      criteria:
        'url 或 description 中存在非 x.com/twitter.com 的有效 HTTP(S) 外部链接',
      originalRecordCount: 73,
      uniqueAccountCount: 68,
      returnedProfileCount: profiles.size,
      selectedCount,
      unavailableCount: accounts.filter(
        account => account.status === '账号不可用'
      ).length,
      profileReadEstimateUsd: 0.68,
      profileReadActualUsd: ACTUAL_PROFILE_READ_COST_USD,
      postReadUpperBoundUsd,
      totalUpperBoundUsd: Number(
        (ACTUAL_PROFILE_READ_COST_USD + postReadUpperBoundUsd).toFixed(2)
      )
    },
    accounts
  }
}

function renderMarkdown(result) {
  const { metadata, accounts } = result
  const money = value => `$${value.toFixed(2)}`
  const lines = [
    '# Phase 1：中文 X 创作者主页筛选结果',
    '',
    `- 生成时间：${metadata.generatedAt}`,
    `- 数据来源：${metadata.source}`,
    `- 原始记录：${metadata.originalRecordCount}`,
    `- 唯一账号：${metadata.uniqueAccountCount}`,
    `- API 返回账号：${metadata.returnedProfileCount}`,
    `- 入选账号：${metadata.selectedCount}`,
    `- 不可用账号：${metadata.unavailableCount}`,
    `- 主页读取估算：${money(metadata.profileReadEstimateUsd)}`,
    `- X Developer Console 实际费用：${money(metadata.profileReadActualUsd)}`,
    `- 后续帖子读取上限：${money(metadata.postReadUpperBoundUsd)}`,
    `- 按实际主页费用计算的项目费用上限：${money(metadata.totalUpperBoundUsd)}`,
    '',
    '| 账号 | 原始领域 | 状态 | 外部链接 |',
    '| --- | --- | --- | --- |'
  ]
  for (const account of accounts) {
    const links =
      account.urls
        .filter(item => item.isExternal)
        .map(item => item.expandedUrl)
        .join('<br>') || '—'
    lines.push(
      `| @${account.username} | ${account.categories.join('、')} | ${account.status} | ${links} |`
    )
  }
  lines.push(
    '',
    '> “主页挂链接”仅表示进入后续分析队列，不代表已经确认拥有产品或产生收入。',
    ''
  )
  return lines.join('\n')
}

async function writePreflight(outputDir, records, accounts) {
  await fs.mkdir(outputDir, { recursive: true })
  const payload = {
    generatedAt: new Date().toISOString(),
    mode: 'preflight',
    apiCalled: false,
    currentRunCostUsd: 0,
    plannedProfileReadCostUsd: 0.68,
    rawRecordCount: records.length,
    uniqueAccountCount: accounts.length,
    duplicateAccountCount: accounts.filter(
      account => account.categories.length > 1
    ).length,
    accounts: [...accounts].sort((a, b) => a.username.localeCompare(b.username))
  }
  const lines = [
    '# Phase 1 主页筛选预检',
    '',
    `- 生成时间：${payload.generatedAt}`,
    `- 原始记录：${payload.rawRecordCount}`,
    `- 唯一账号：${payload.uniqueAccountCount}`,
    `- 跨领域账号：${payload.duplicateAccountCount}`,
    '- 本次 API 费用：$0（未访问 X API）',
    '- 计划主页读取费用：$0.68',
    '',
    '## 账号与领域',
    '',
    '| 账号 | 原始领域 |',
    '| --- | --- |',
    ...payload.accounts.map(
      account => `| @${account.username} | ${account.categories.join('、')} |`
    ),
    ''
  ]
  await Promise.all([
    fs.writeFile(
      path.join(outputDir, 'preflight.json'),
      `${JSON.stringify(payload, null, 2)}\n`
    ),
    fs.writeFile(path.join(outputDir, 'preflight.md'), lines.join('\n'))
  ])
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const markdown = await fs.readFile(options.source, 'utf8')
  const { records, accounts } = extractAccounts(markdown)
  const duplicateAccounts = accounts.filter(
    account => account.categories.length > 1
  )
  console.log(
    `预检通过：${records.length} 条记录，${accounts.length} 个唯一账号，${duplicateAccounts.length} 个跨领域账号。`
  )
  if (!options.execute && !options.responseFile) {
    await writePreflight(options.outputDir, records, accounts)
    console.log(
      '未调用 X API；本次运行费用为 $0。确认控制台限额后使用 --execute。'
    )
    return
  }

  let payload
  let rawText
  let source
  if (options.responseFile) {
    rawText = await fs.readFile(options.responseFile, 'utf8')
    payload = JSON.parse(rawText)
    source = options.responseFile.endsWith('x-api-users-by.raw.json')
      ? 'X API v2 GET /2/users/by（本地原始响应重建）'
      : `fixture:${path.relative(PROJECT_ROOT, options.responseFile)}`
  } else {
    await loadLocalEnv()
    const token = process.env.X_BEARER_TOKEN
    if (!token)
      throw new Error('未找到 X_BEARER_TOKEN；请配置项目根目录 .env.local')
    const response = await fetchProfiles(
      accounts.map(account => account.username),
      token
    )
    payload = response.payload
    rawText = response.rawText
    source = 'X API v2 GET /2/users/by'
  }

  const result = buildResult(accounts, payload, source)
  await fs.mkdir(options.outputDir, { recursive: true })
  await Promise.all([
    fs.writeFile(
      path.join(options.outputDir, 'x-api-users-by.raw.json'),
      rawText
    ),
    fs.writeFile(
      path.join(options.outputDir, 'profiles.json'),
      `${JSON.stringify(result, null, 2)}\n`
    ),
    fs.writeFile(
      path.join(options.outputDir, 'screening.md'),
      renderMarkdown(result)
    )
  ])
  console.log(
    `筛选完成：入选 ${result.metadata.selectedCount} 人，项目费用上限 $${result.metadata.totalUpperBoundUsd.toFixed(2)}。`
  )
  console.log(`结果目录：${path.relative(PROJECT_ROOT, options.outputDir)}`)
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
