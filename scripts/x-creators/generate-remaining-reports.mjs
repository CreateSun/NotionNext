#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const BASE = path.join(ROOT, 'docs/research/x-creators/data')
const REPORT_DIR = path.join(BASE, 'phase-3/reports')
const PILOTS = new Set([
  'gefei55',
  'tualatrix',
  'indie_maker_fox',
  'yupi996',
  'seclink'
])
const THEMES = [
  ['AI 与工具', /AI|GPT|Claude|模型|Agent|提示词|智能体/gi],
  ['产品与创业', /产品|创业|用户|增长|收入|商业|独立开发|SaaS/gi],
  ['出海与流量', /出海|SEO|流量|海外|英文|Google|网站/gi],
  ['编程与技术', /代码|编程|开发|程序员|开源|GitHub|工程|技术/gi],
  ['投资与商业观察', /投资|股票|市场|公司|美股|经济/gi],
  ['个人经验与生活', /生活|孩子|家庭|旅行|读书|工作|经验/gi]
]

function clean(text = '') {
  return text
    .replace(/https?:\/\/t\.co\/\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function clip(text, length = 180) {
  const value = clean(text)
  return value.length > length ? value.slice(0, length - 1) + '…' : value
}

function tableCell(text = '') {
  return clean(String(text)).replace(/\|/g, '\\|')
}

function formatMetric(value = 0) {
  return Number(value).toLocaleString('zh-CN')
}

function themesFor(text) {
  return THEMES.map(([name, pattern]) => [
    name,
    (text.match(pattern) || []).length
  ])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name)
}

async function main() {
  const profiles = JSON.parse(
    await fs.readFile(path.join(BASE, 'phase-1/profiles.json'), 'utf8')
  )
  const pinned = JSON.parse(
    await fs.readFile(path.join(BASE, 'phase-3/raw/pinned.raw.json'), 'utf8')
  )
  const pinnedById = new Map((pinned.data || []).map(post => [post.id, post]))
  const browserRetry = JSON.parse(
    await fs.readFile(
      path.join(BASE, 'browser-retry/browser-retry.raw.json'),
      'utf8'
    )
  )
  const retryByAccount = new Map()
  const ignoredRetryPairs = new Set([
    'yihui_indie|https://skillry.dev/',
    'luobogooooo|https://bento.me/luobogor'
  ])
  for (const page of browserRetry.pages) {
    if (
      page.errorPage ||
      !page.finalUrl ||
      page.finalUrl.startsWith('chrome-error:') ||
      (page.textExcerpt || '').length < 80 ||
      ignoredRetryPairs.has(page.username + '|' + page.url)
    )
      continue
    const pages = retryByAccount.get(page.username) || []
    pages.push({
      requestedUrl: page.url,
      finalUrl: page.finalUrl,
      status: 200,
      title: page.title,
      description: clip(page.textExcerpt, 240),
      pricingSnippets: [],
      source: 'browser-retry'
    })
    retryByAccount.set(page.username, pages)
  }
  const accounts = profiles.accounts.filter(
    account => account.selected && !PILOTS.has(account.username)
  )
  await fs.mkdir(REPORT_DIR, { recursive: true })
  const index = []

  for (const account of accounts) {
    const recent = JSON.parse(
      await fs.readFile(
        path.join(BASE, 'phase-3/raw', account.username + '.recent.raw.json'),
        'utf8'
      )
    )
    const web = JSON.parse(
      await fs.readFile(
        path.join(BASE, 'phase-3/web', account.username + '.web.json'),
        'utf8'
      )
    )
    const posts = recent.data || []
    const pinnedPost = pinnedById.get(account.profile.pinned_tweet_id)
    const retryPages = retryByAccount.get(account.username) || []
    const recoveredUrls = new Set(retryPages.map(page => page.requestedUrl))
    const goodPages = [
      ...web.pages.filter(page => page.status >= 200 && page.status < 400),
      ...retryPages
    ].filter(
      (page, index, pages) =>
        pages.findIndex(candidate => candidate.finalUrl === page.finalUrl) ===
        index
    )
    const badPages = web.pages.filter(
      page =>
        !(page.status >= 200 && page.status < 400) &&
        !recoveredUrls.has(page.requestedUrl)
    )
    const pricing = goodPages
      .flatMap(page =>
        (page.pricingSnippets || []).map(text => ({
          url: page.finalUrl,
          text: clip(text, 240)
        }))
      )
      .slice(0, 5)
    const themes = themesFor(
      posts.map(post => post.text).join(' ') + ' ' + (pinnedPost?.text || '')
    )
    const productNames = goodPages
      .slice(0, 2)
      .map(page => page.title || new URL(page.finalUrl).hostname)
    const primaryThemes = themes.join('、') || '个人专业表达'
    const creatorType = account.categories.includes('独立开发者')
      ? '独立开发者'
      : account.categories.includes('出海')
        ? '出海从业者'
        : account.categories[0] || '创作者'
    const summary = goodPages.length
      ? account.profile.name +
        '是一位聚焦 ' +
        primaryThemes +
        '的' +
        creatorType +
        '，公开入口已连接至 ' +
        productNames.join('、') +
        '。从出海业务视角看，其价值在于把专业内容、个人信任与站外产品入口组合起来；' +
        (pricing.length
          ? '公开页面已出现商业化线索，但实际收入结构仍需结合实时产品页判断。'
          : '现阶段更适合关注产品定位与流量承接，具体收入模式尚未完整公开。')
      : '从内容积累与专业定位看，' +
        account.profile.name +
        '是一位颇具实力的' +
        creatorType +
        '，长期围绕 ' +
        primaryThemes +
        '展开。现阶段可公开确认的产品信息有限，更多产品数据暂时无法获取。'
    const strongestPost = [...posts].sort((a, b) => {
      const score = post => {
        const metrics = post.public_metrics || {}
        return (
          (metrics.like_count || 0) +
          (metrics.retweet_count || 0) * 2 +
          (metrics.reply_count || 0)
        )
      }
      return score(b) - score(a)
    })[0]
    const lines = [
      '# ' +
        account.profile.name +
        '（@' +
        account.username +
        '）产品与内容分析',
      '',
      '## 核心判断',
      '',
      '> ' + summary,
      '',
      '## 账号概览',
      '',
      '| 维度 | 观察 |',
      '| --- | --- |',
      '| 创作者类型 | ' + tableCell(account.categories.join('、')) + ' |',
      '| 主页定位 | ' +
        tableCell(
          clip(account.profile.description, 320) || '主页未补充详细介绍'
        ) +
        ' |',
      '| 采集时粉丝量 | ' +
        formatMetric(account.profile.public_metrics.followers_count) +
        ' |',
      '| 近期内容主题 | ' + tableCell(primaryThemes) + ' |',
      '',
      '## 产品与站外资产',
      ''
    ]
    if (goodPages.length) {
      lines.push('| 产品或入口 | 公开定位 | 商业观察 |', '| --- | --- | --- |')
      for (const page of goodPages) {
        const label = page.title || new URL(page.finalUrl).hostname
        const positioning = page.description
          ? clip(page.description, 180)
          : '公开页面可访问，具体定位以页面实时信息为准。'
        const commercial = (page.pricingSnippets || []).length
          ? '页面出现定价或付费线索，适合作为转化入口。'
          : '承担品牌、内容或产品承接作用，具体收费方案未完整公开。'
        lines.push(
          '| [' +
            tableCell(label) +
            '](' +
            page.finalUrl +
            ') | ' +
            tableCell(positioning) +
            ' | ' +
            commercial +
            ' |'
        )
      }
    } else
      lines.push(
        '目前看是一位颇具实力的' +
          creatorType +
          '。现阶段可公开确认的产品信息有限，更多产品数据暂时无法获取。'
      )
    lines.push('', '## 商业化观察', '')
    if (pricing.length) {
      lines.push(
        '- 公开页面出现以下定价或付费线索，可用于判断产品设计，但不等同于实际收入：'
      )
      for (const item of pricing)
        lines.push('  - ' + item.text + '（[来源](' + item.url + ')）')
    } else
      lines.push(
        '- 暂未看到足够清晰的公开价格。更可能的转化方式需要结合产品内页、销售流程或后续访谈确认，不对收入规模作外推。'
      )
    lines.push(
      '',
      '## 近期内容表现',
      '',
      '| 日期 | 内容切入 | 互动表现 | 出海视角信号 |',
      '| --- | --- | --- | --- |'
    )
    for (const post of posts) {
      const metrics = post.public_metrics || {}
      const postThemes =
        themesFor(post.text).slice(0, 2).join('、') || '个人表达'
      lines.push(
        '| ' +
          post.created_at.slice(0, 10) +
          ' | ' +
          tableCell(clip(post.text, 150)) +
          ' | 赞 ' +
          formatMetric(metrics.like_count) +
          ' · 转发 ' +
          formatMetric(metrics.retweet_count) +
          ' · 回复 ' +
          formatMetric(metrics.reply_count) +
          ' | ' +
          tableCell(postThemes) +
          ' |'
      )
    }
    if (!posts.length) lines.push('| — | 暂无近期原创内容样本 | — | — |')
    lines.push(
      '',
      '> 内容样本为采集时点最近最多 5 条原创帖，用于观察当前选题与表达方式，不代表长期内容占比。',
      '',
      '## 长期主张与置顶内容',
      ''
    )
    if (pinnedPost) lines.push('> ' + clip(pinnedPost.text, 600))
    else if (account.profile.pinned_tweet_id)
      lines.push(
        '主页保留了置顶内容入口，但当前帖子已不可读取。本报告不对缺失内容作推断。'
      )
    else lines.push('主页当前没有设置可读取的置顶内容。')
    lines.push(
      '',
      '## 出海视角研判',
      '',
      '- **专业定位：** 内容集中在' +
        primaryThemes +
        '，有利于形成清晰的受众认知与持续关注。',
      goodPages.length
        ? '- **流量承接：** 已有 ' +
            goodPages.length +
            ' 个可验证站外入口，具备从社媒内容到产品、服务或自有内容资产的承接路径。'
        : '- **流量承接：** 当前主要价值体现在内容与个人品牌，站外产品数据恢复后再评估转化链路。',
      strongestPost
        ? '- **受众反馈：** 近期互动较高的内容切入是“' +
            tableCell(clip(strongestPost.text, 80)) +
            '”。这反映了当前受众的讨论兴趣；是否适合承接产品转化，仍需结合选题与业务的相关性判断。'
        : '- **受众反馈：** 当前内容样本有限，尚不足以判断最有效的获客主题。',
      pinnedPost
        ? '- **长期资产：** 置顶内容补充了长期主张或重点项目，有助于新访客快速建立认知。'
        : '- **长期资产：** 可以进一步用置顶内容明确代表产品、核心案例或订阅入口。',
      '',
      '## 信息边界',
      '',
      '- 粉丝量与互动数据均为采集时快照，适合观察相对表现，不直接等同于收入或转化率。',
      pricing.length
        ? '- 定价可能随促销和产品迭代变化，合作或购买前仍应以实时页面为准。'
        : '- 公开信息不足以确认完整收费结构，报告仅呈现可验证的产品与内容信号。',
      ''
    )
    await fs.writeFile(
      path.join(REPORT_DIR, account.username + '.md'),
      lines.join('\n')
    )
    index.push({
      username: account.username,
      name: account.profile.name,
      categories: account.categories,
      themes,
      followers: account.profile.public_metrics.followers_count,
      summary,
      goodPageCount: goodPages.length,
      browserRecoveredPageCount: retryPages.length,
      pricingSignalCount: pricing.length
    })
  }
  await fs.writeFile(
    path.join(BASE, 'phase-3/report-index.json'),
    JSON.stringify(index, null, 2) + '\n'
  )
  console.log('生成 ' + index.length + ' 份 Phase 3 报告。')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
