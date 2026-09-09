#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const BASE = path.join(ROOT, 'docs/research/x-creators/data')
const REPORT_DIR = path.join(BASE, 'phase-2/reports')
const handles = [
  'gefei55',
  'tualatrix',
  'indie_maker_fox',
  'yupi996',
  'seclink'
]
const editorial = {
  gefei55: {
    core: '哥飞的核心业务不是单一工具，而是“免费 SEO/出海教育内容 → Web.Cafe 社区 → 付费问答、社群与工具生态”的知识社区。内容、社区与付费服务之间已经形成较完整的信任转化路径。',
    products: [
      '- **Web.Cafe：** 提供帖子、问答、标签和社区互动，首页存在明确的付费问答与解锁入口。',
      '- **获客路径：** 大量免费出海建站教程承担搜索流量与用户教育，再由社区、问答和工具生态承接高意向用户。',
      '- **商业化判断：** 公开页面可见单次问答费用，但没有统一会员价，因此不据此推算社群收入。'
    ],
    analysis: [
      '- **内容资产：** 长期免费教程既能通过搜索持续获客，也能降低用户进入付费社区前的信任成本。',
      '- **转化设计：** 创作者经验、社区成员案例与付费问答构成多层次信任证据。',
      '- **差异化：** 从“教流量”延伸到社区和工具推荐，比单纯销售课程更具持续互动性。'
    ],
    boundaries: [
      '- 社群会员费、问答分成和工具收入没有统一披露，不对收入规模作外推。'
    ]
  },
  tualatrix: {
    core: '图拉鼎走的是“个人技术品牌 + 多款高完成度 Apple 平台工具”的独立工作室路线。Tutu Studio 统一承载产品矩阵，长期技术积累与产品审美是其核心竞争力。',
    products: [
      '- **Tutu Studio：** 统一承载 PopTranslate、MarkMark、PasteNow、Manico 等效率工具。',
      '- **产品定位：** 围绕翻译、内容归档、剪贴板管理和应用切换，服务重视效率与体验的 Apple 用户。',
      '- **商业化判断：** 官网未展示统一价格，具体收费结构应以各产品页或 App Store 实时信息为准。'
    ],
    analysis: [
      '- **专业壁垒：** 长期 Apple 生态开发经验形成技术、交互与审美的复合优势。',
      '- **品牌复用：** 多款产品面向相近用户，工作室品牌能够降低新品冷启动成本。',
      '- **差异化：** 对中文排版、本地化和系统级效率工具的关注，区别于通用 AI 套壳产品。'
    ],
    boundaries: ['- 具体价格、平台和内购方式可能变化，需以实时商店页面为准。']
  },
  indie_maker_fox: {
    core: 'Fox 已形成“开发模板 + 社群 + 自有 AI 产品案例”的独立开发业务组合。MkSaaS 是当前最清晰的直接收费产品，内容与实际开发工作高度一致。',
    products: [
      '- **MkSaaS：** Next.js AI SaaS 模板，采集时官网显示 $139 Lifetime，可构建无限 SaaS 网站。',
      '- **产品能力：** 预集成 AI、认证、支付、国际化、Newsletter、Dashboard、博客、文档和 SEO 等常用模块。',
      '- **业务组合：** TanStarter 与 MkImage 表明其不仅销售模板，也在用同一技术栈运营实际产品。'
    ],
    analysis: [
      '- **内容转化：** 日常开发经验能够自然连接到模板购买需求。',
      '- **定价策略：** 终身买断降低购买决策复杂度，适合希望快速启动项目的独立开发者。',
      '- **产品验证：** 同时运营模板与成品，有利于用真实业务反向验证模板能力。'
    ],
    boundaries: [
      '- $139 为采集时页面价格，促销与定价可能调整。',
      '- 未核实销量、退款率和各产品收入，不把页面案例视为全部经营结果。'
    ]
  },
  yupi996: {
    core: '程序员鱼皮的商业闭环是“高频 AI/编程内容 → 编程导航免费学习入口 → 年度 VIP 项目课程、导师答疑与社群”。产品与内容受众高度重叠，是本批样本中证据较完整的知识产品案例。',
    products: [
      '- **编程导航：** 提供编程路线、项目教程、学习资源与问答社区。',
      '- **年度 VIP：** 采集时页面显示 ¥379/年，权益包括企业级项目教程、导师答疑、VIP 群、直播回看以及简历与求职支持。',
      '- **转化路径：** 免费内容负责触达与建立信任，年度会员把课程、服务和社群打包变现。'
    ],
    analysis: [
      '- **内容分发：** 兼具短内容爆发与系统课程沉淀，能够覆盖从兴趣到深入学习的完整路径。',
      '- **产品价值：** 会员权益不只包含录播课，还包含导师、社群和求职服务。',
      '- **信任结构：** 创作者经历、免费教程与付费项目共同降低用户决策成本。'
    ],
    boundaries: [
      '- ¥379/年为采集时公开价格，促销和权益可能调整。',
      '- 未核实会员规模与收入，不能用粉丝量直接估算付费转化。'
    ]
  },
  seclink: {
    core: 'Y11 主页指向 JobLeap/Boli 网申求职雷达，产品以招聘信息聚合为入口，并延伸至职位订阅、简历优化、面试押题和模拟面试，覆盖求职链条的多个关键节点。',
    products: [
      '- **JobLeap/Boli：** 官网称聚合 200 万+ 名企大厂招聘信息，覆盖校招、实习与社招。',
      '- **功能组合：** 职位订阅、简历优化、面试押题、模拟面试与小程序共同提升复访和服务深度。',
      '- **商业化判断：** 产品具备求职服务变现空间，但首页没有公开价格或会员方案，暂不判断具体收入来源。'
    ],
    analysis: [
      '- **需求频率：** 招聘信息具备高频、强时效属性，适合通过订阅形成持续使用。',
      '- **链条延伸：** 从职位列表扩展到简历与面试工具，能够覆盖更多求职决策环节。',
      '- **内容机会：** AI 数据与应用研究可为智能求职功能提供技术叙事，但仍需加强内容与产品的直接连接。'
    ],
    boundaries: [
      '- 公开页面未展示价格，会员、企业合作或广告模式都需要更多证据。'
    ]
  }
}

function clean(text = '') {
  return text
    .replace(/https?:\/\/t\.co\/\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function clip(text, length = 145) {
  const value = clean(text)
  return value.length > length ? value.slice(0, length - 1) + '…' : value
}

function tableCell(text = '') {
  return clean(String(text)).replace(/\|/g, '\\|')
}

function section(markdown, heading) {
  const match = markdown.match(
    new RegExp('## ' + heading + '\\n+([\\s\\S]*?)(?=\\n## |$)')
  )
  return match?.[1]?.trim() || ''
}

function contentSignal(text) {
  if (/上线|更新|产品|功能|版本|构建|项目/i.test(text)) return '产品进展'
  if (/如何|方法|教程|步骤|经验|建议/i.test(text)) return '实战方法'
  if (/收入|订单|用户|增长|流量|SEO|变现/i.test(text)) return '增长案例'
  if (/AI|GPT|Claude|模型|Agent|编程|代码/i.test(text)) return '技术洞察'
  return '行业或个人观察'
}

async function main() {
  const profiles = JSON.parse(
    await fs.readFile(path.join(BASE, 'phase-1/profiles.json'), 'utf8')
  )
  const profileByHandle = new Map(
    profiles.accounts.map(account => [account.username, account])
  )

  for (const handle of handles) {
    const filename = path.join(REPORT_DIR, handle + '.md')
    const markdown = await fs.readFile(filename, 'utf8')
    const account = profileByHandle.get(handle)
    const recent = JSON.parse(
      await fs.readFile(
        path.join(BASE, 'phase-2/raw', handle + '.recent.raw.json'),
        'utf8'
      )
    )
    const title = markdown.match(/^# (.+)$/m)?.[1] || handle
    const copy = editorial[handle]
    const posts = recent.data || []
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
      '# ' + title,
      '',
      '## 核心判断',
      '',
      '> ' + copy.core,
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
        account.profile.public_metrics.followers_count.toLocaleString('zh-CN') +
        ' |',
      '',
      '## 产品与商业化观察',
      '',
      ...copy.products,
      '',
      '## 近期内容表现',
      '',
      '| 日期 | 内容切入 | 互动表现 | 内容信号 |',
      '| --- | --- | --- | --- |'
    ]
    for (const post of posts) {
      const metrics = post.public_metrics || {}
      lines.push(
        '| ' +
          post.created_at.slice(0, 10) +
          ' | ' +
          tableCell(clip(post.text)) +
          ' | 赞 ' +
          (metrics.like_count || 0).toLocaleString('zh-CN') +
          ' · 转发 ' +
          (metrics.retweet_count || 0).toLocaleString('zh-CN') +
          ' · 回复 ' +
          (metrics.reply_count || 0).toLocaleString('zh-CN') +
          ' | ' +
          contentSignal(post.text) +
          ' |'
      )
    }
    if (!posts.length) lines.push('| — | 暂无近期原创帖样本 | — | — |')
    lines.push(
      '',
      '> 内容样本为采集时点最近最多 5 条原创帖，用于观察当前选题与表达方式，不代表长期内容占比。',
      '',
      '## 出海视角研判',
      '',
      ...copy.analysis,
      strongestPost
        ? '- **受众反馈：** 近期互动较高的内容切入是“' +
            clip(strongestPost.text, 110) +
            '”。这反映了当前受众的讨论兴趣；是否适合承接产品转化，仍需结合选题与业务的相关性判断。'
        : '- **受众反馈：** 当前样本不足，后续应继续观察内容与产品转化的连接方式。',
      '',
      '## 信息边界',
      '',
      ...copy.boundaries,
      '- 粉丝量与互动数据均为采集时快照，适合观察相对表现，不直接等同于收入或转化率。',
      ''
    )
    await fs.writeFile(filename, lines.join('\n'))
  }
  console.log('刷新 ' + handles.length + ' 份试生产报告。')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
