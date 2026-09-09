#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const BASE = path.join(ROOT, 'docs/research/x-creators/data')
const SITE_URL = 'https://www.createsun.work'
const OVERVIEW_SLUG = 'tweets-influencer-analyze'
const ARTICLE_BASE_URL = SITE_URL + '/article/'
const OVERVIEW_URL = ARTICLE_BASE_URL + OVERVIEW_SLUG
const PILOTS = new Set([
  'gefei55',
  'tualatrix',
  'indie_maker_fox',
  'yupi996',
  'seclink'
])

function stripTitle(markdown) {
  return markdown.replace(/^# .+?\n+/, '')
}

function firstParagraph(markdown) {
  const match = markdown.match(/## (?:核心判断|结论)\n+([^#]+?)(?:\n\n|$)/)
  return (match?.[1] || '')
    .replace(/^>\s*/, '')
    .replace(/\n/g, ' ')
    .trim()
    .slice(0, 240)
}

function escapeTableCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

async function main() {
  const profiles = JSON.parse(
    await fs.readFile(path.join(BASE, 'phase-1/profiles.json'), 'utf8')
  )
  const accounts = profiles.accounts.filter(account => account.selected)
  const reportIndex = JSON.parse(
    await fs.readFile(path.join(BASE, 'phase-3/report-index.json'), 'utf8')
  )
  const reportMeta = new Map(reportIndex.map(item => [item.username, item]))
  const productAnalysis = JSON.parse(
    await fs.readFile(path.join(BASE, 'product-analysis-summary.json'), 'utf8')
  )
  const pages = []
  for (const account of accounts) {
    const phase = PILOTS.has(account.username) ? 'phase-2' : 'phase-3'
    const filename = path.join(BASE, phase, 'reports', account.username + '.md')
    const markdown = await fs.readFile(filename, 'utf8')
    const summary = firstParagraph(markdown)
    const slug = OVERVIEW_SLUG + '/' + account.username.toLowerCase()
    const content =
      '> [返回总览](' + OVERVIEW_URL + ')\n\n' +
      stripTitle(markdown)
    pages.push({
      username: account.username,
      title:
        account.profile.name + '（@' + account.username + '）产品与内容分析',
      slug,
      summary,
      properties: {
        title:
          account.profile.name + '（@' + account.username + '）产品与内容分析',
        type: 'Post',
        category: '知行合一',
        tags: ['AI', '思考'],
        status: 'Invisible',
        slug,
        'date:date:start': '2026-09-09',
        'date:date:is_datetime': 0,
        summary,
        icon: '🔍'
      },
      content,
      categories: account.categories,
      followers: account.profile.public_metrics.followers_count,
      needsReview: reportMeta.get(account.username)?.needsReview ?? false
    })
  }
  const additionHandle = 'ruguodev'
  const additionProfile = JSON.parse(
    await fs.readFile(
      path.join(BASE, 'additions', additionHandle, 'profile.raw.json'),
      'utf8'
    )
  ).data
  const additionMarkdown = await fs.readFile(
    path.join(BASE, 'additions', additionHandle, 'report.md'),
    'utf8'
  )
  const additionSummary = firstParagraph(additionMarkdown)
  const additionSlug = OVERVIEW_SLUG + '/' + additionHandle
  pages.push({
    username: additionHandle,
    title: additionProfile.name + '（@' + additionHandle + '）产品与内容分析',
    slug: additionSlug,
    summary: additionSummary,
    properties: {
      title: additionProfile.name + '（@' + additionHandle + '）产品与内容分析',
      type: 'Post',
      category: '知行合一',
      tags: ['AI', '思考'],
      status: 'Invisible',
      slug: additionSlug,
      'date:date:start': '2026-09-09',
      'date:date:is_datetime': 0,
      summary: additionSummary,
      icon: '🔍'
    },
    content:
      '> [返回总览](' + OVERVIEW_URL + ')\n\n' +
      stripTitle(additionMarkdown),
    categories: ['SaaS 和 APP 产品', '独立开发者'],
    followers: additionProfile.public_metrics.followers_count,
    needsReview: true
  })
  const allAccounts = [
    ...accounts,
    { categories: ['SaaS 和 APP 产品', '独立开发者'] }
  ]
  const categoryCounts = Object.entries(
    allAccounts
      .flatMap(account => account.categories)
      .reduce(
        (counts, category) => ({
          ...counts,
          [category]: (counts[category] || 0) + 1
        }),
        {}
      )
  ).sort((a, b) => b[1] - a[1])
  const pageHandles = new Set(pages.map(page => page.username))
  const missingAnalysis = pages
    .filter(page => !productAnalysis[page.username]?.trim())
    .map(page => page.username)
  const unknownAnalysis = Object.keys(productAnalysis).filter(
    username => !pageHandles.has(username)
  )
  if (missingAnalysis.length || unknownAnalysis.length) {
    throw new Error(
      '报告总结映射不完整：缺少 ' +
        (missingAnalysis.join(', ') || '无') +
        '；多余 ' +
        (unknownAnalysis.join(', ') || '无')
    )
  }
  const reportSummaryTable = [
    '## 报告总结',
    '',
    '| 分类 | 博主名 | 产品分析 |',
    '| --- | --- | --- |',
    ...pages.map(page => {
      const bloggerName = page.title.replace(/产品与内容分析$/, '')
      return (
        '| ' +
        escapeTableCell(page.categories.join('、')) +
        ' | [' +
        escapeTableCell(bloggerName) +
        '](' +
        ARTICLE_BASE_URL +
        page.slug +
        ') | ' +
        escapeTableCell(productAnalysis[page.username]) +
        ' |'
      )
    })
  ].join('\n')
  const sections = categoryCounts
    .map(
      ([category, count]) =>
        '## ' +
        category +
        '（' +
        count +
        '）\n\n' +
        pages
          .filter(page => page.categories.includes(category))
          .map(
            page =>
              '- [' +
              page.title +
              '](' + ARTICLE_BASE_URL +
              page.slug +
              ')'
          )
          .join('\n')
    )
    .join('\n\n')
  const overviewContent = [
    '> 本研究基于 2026-09-09 的 X API 主页、近期原创帖、置顶帖和公开产品页面。原始博主列表取自 [AI_Jasonyu 发布的 X 帖子](https://x.com/AI_Jasonyu/status/2030166779096658161)中的数据；53 人来自原始 68 个唯一账号的主页外链筛选，另加入用户指定的 @ruguodev，共 54 人；分类存在交叉，因此分类合计会超过 54。',
    '',
    '## 核心观察',
    '',
    '- 最常见的商业闭环是：免费内容建立信任，站外产品、会员、社群、模板或服务完成承接。',
    '- 明确公开价格只在页面证据足够时记录；没有可靠价格的账号统一标为待核实，不根据粉丝数估算收入。',
    '- 最近原创帖每人最多 5 条，只用于观察当前内容打法，不代表长期内容比例。',
    '- 5 人试生产中确认了 MkSaaS $139 终身买断和编程导航 VIP ¥379/年；其他付费方式以各报告证据边界为准。',
    '',
    '## 研究覆盖',
    '',
    '- 54 个入选账号，覆盖 258 条近期原创内容样本。',
    '- 36 条可用置顶内容用于补充创作者长期主张与重点项目。',
    '- 首轮检查 84 个站外页面；随后使用内嵌浏览器复查未完整加载的入口，并将 20 个相关页面补充进个人报告。',
    '- @ruguodev 的个人主页与 3 个产品入口均已纳入分析。',
    '',
    reportSummaryTable,
    '',
    sections,
    '',
    '## 方法与限制',
    '',
    '- 报告只呈现对读者有用的公开信息，不展示内部采集文件、错误日志或本地路径。',
    '- 页面价格、产品功能和账号粉丝数均可能随时间变化。',
    '- 当前内容处于编辑审阅阶段，公开发布前仍会进行最终校对。'
  ].join('\n')
  const overview = {
    title: '中文 X 创作者产品与内容分析',
    slug: OVERVIEW_SLUG,
    summary: '54 位中文 X 创作者的产品、付费方式、内容赛道、优势和差异化研究。',
    properties: {
      title: '中文 X 创作者产品与内容分析',
      type: 'Post',
      category: '知行合一',
      tags: ['AI', '思考'],
      status: 'Published',
      slug: OVERVIEW_SLUG,
      'date:date:start': '2026-09-09',
      'date:date:is_datetime': 0,
      summary:
        '54 位中文 X 创作者的产品、付费方式、内容赛道、优势和差异化研究。',
      icon: '🗺️'
    },
    content: overviewContent
  }
  const slugs = [overview.slug, ...pages.map(page => page.slug)]
  if (new Set(slugs).size !== slugs.length) throw new Error('Slug 存在重复')
  await fs.writeFile(
    path.join(BASE, 'publishing-bundle.json'),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), overview, pages },
      null,
      2
    ) + '\n'
  )
  await fs.writeFile(
    path.join(BASE, 'overview.md'),
    '# ' + overview.title + '\n\n' + overview.content + '\n'
  )
  console.log('生成 1 个总览和 ' + pages.length + ' 个个人页面。')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
