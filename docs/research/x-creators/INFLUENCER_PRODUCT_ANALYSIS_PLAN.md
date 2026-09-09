# 中文 X 创作者产品分析执行计划

## 1. 项目目标

从中文 X 创作者名单中的以下五个领域筛选正在运营产品的用户，分析他们的产品、付费方式、内容赛道、优势和差异化，并发布到 Notion“闲裁彩山”和 NotionNext：

- 副业
- 独立开发者
- 出海
- SaaS 和 APP 产品
- 创业者

最终交付包括：

1. 一篇总览文章，说明为什么开展这次分析、使用了什么方法、发现了什么，并提供全部用户报告入口。
2. 每位入选用户一篇独立分析报告。
3. NotionNext 发布路径：
   - 总览：`/tweets-influencer-analyze`
   - 用户报告：`/tweets-influencer-analyze/{handle}`

总览文章暂定标题：

> 看看大家都在做什么产品：中文 X 创作者产品观察

## 2. 已确认的账号范围

原始长文位于 [`README.md`](./README.md)。从指定五个领域提取到 73 条记录：

| 领域             | 原始记录数 |
| ---------------- | ---------: |
| 创业者           |         21 |
| SaaS 和 APP 产品 |         20 |
| 独立开发者       |         16 |
| 出海             |          9 |
| 副业             |          7 |
| **合计**         |     **73** |

Handle 统一转为小写后得到 **68 个唯一账号**。以下 5 个账号跨领域重复出现，只生成一份报告，但保留全部领域标签：

- `@yan5xu`
- `@tualatrix`
- `@seclink`
- `@journeymanchina`
- `@austinit`

### 2.1 唯一账号清单

```text
@9yearfish
@ai_jasonyu
@astronaut_1216
@austinit
@axtonliu
@benshandebiao
@chuhaiqu
@coderjefflee
@cydiar404
@daluoseo
@dev_afei
@expatlevi
@fankaishuoai
@fenng
@financeyf5
@fkysly
@gefei55
@gosailglobal
@guishou_56
@hongjun60
@hongyuancao
@hwwaanng
@iamtonyzhu
@idoubicc
@indie_maker_fox
@ityouknows
@jefferytatsuya
@jesselaunz
@jinsfavorites
@journeymanchina
@junyu
@kasong2048
@lewangx
@lidangzzz
@liuyi0922
@livid
@luinlee
@luobogooooo
@luoleiorg
@lxfater
@lyc_zh
@nateleex
@nextify2024
@nishuang
@owenyoungzh
@plidezus
@pluvio9yte
@randyloop
@readyfor2025
@santiagoyoungus
@seclink
@servasyy_ai
@shengxj1
@tinyfool
@tualatrix
@turingou
@tuturetom
@valley101_qian
@virushuo
@waylybaye
@weijunext
@xdash
@xiaohuiai666
@xiongchun007
@yan5xu
@yihui_indie
@yupi996
@zhixianio
```

## 3. 入选标准

第一阶段只读取 68 个账号的主页资料。满足以下任一条件即进入后续分析：

1. X 主页的 `url` 字段包含有效外部链接。
2. 简介 `description` 中包含有效外部链接。

优先从官方 API 的结构化字段提取：

```text
url
description
entities.url.urls[].expanded_url
entities.description.urls[].expanded_url
```

处理规则：

- 展开 `t.co`，保存最终 URL 和原始 URL。
- 排除只指向 `x.com` 或 `twitter.com` 账号主页的链接。
- 产品官网、个人主页、Linktree 类导航页、GitHub、Notion 和独立内容站都视为有效外部链接。
- “主页挂链接”只表示进入分析队列，不代表已经确认其拥有产品。
- 如果页面分析后没有发现产品或付费证据，报告中明确写“未发现”，不强行补全。

## 4. 数据来源与采集顺序

### 4.1 X 官方 API

官方 API 只承担必要的结构化数据读取：

1. 批量读取 68 个账号的主页资料。
2. 只为入选账号读取最近 5 条原创帖子。
3. 只为入选账号读取置顶推文。

主页查询需包含：

```text
id
name
username
description
url
entities
public_metrics
pinned_tweet_id
created_at
verified
```

帖子查询使用：

```http
GET /2/users/{user_id}/tweets
```

目标参数：

```text
exclude=retweets,replies
tweet.fields=id,text,created_at,public_metrics,entities,attachments,article,conversation_id
```

如果端点要求 `max_results` 不小于 5，则请求最低允许数量，但分析时只采用最近 5 条符合条件的原创帖子。

置顶推文处理方式：

- 在主页查询阶段只读取 `pinned_tweet_id`，不展开未入选账号的置顶帖。
- 入选后合并所有 `pinned_tweet_id`，批量查询帖子。
- 如果置顶帖已包含在最近 5 条中，只分析一次。

原始数据保存规则：

- 每次 X API 成功响应均以独立的 `*.raw.json` 文件原样保存，不覆盖为清洗后结构。
- 清洗、筛选、状态和预算等派生字段保存到另外的 JSON 或 Markdown 文件。
- Phase 1 用户批量响应保存为 `data/phase-1/x-api-users-by.raw.json`。
- Phase 2 近期帖子按账号保存为 `data/phase-2/raw/{handle}.recent.raw.json`，置顶帖批量响应保存为 `data/phase-2/raw/pinned.raw.json`。
- 原始响应文件不包含本地 Bearer Token 或请求认证头。

### 4.2 主页及产品网站

每位入选用户默认最多读取 5 个相关页面：

1. 主页或个人导航页
2. 产品或 Features 页面
3. Pricing 页面
4. About 页面
5. 必要时读取 Docs、Membership 或 Checkout 说明页

如果主页是导航页，只进入最相关的 1–3 个产品链接。

禁止行为：

- 不注册或登录网站。
- 不提交表单。
- 不购买或订阅。
- 不进入实际支付操作。
- 不绕过验证码、登录墙或访问限制。
- 不采集私有数据。

### 4.3 X Article 和公开降级来源

如果帖子包含 X Article：

1. 优先使用官方 API 返回的 `article` 字段。
2. 如果官方只返回元数据，再使用免费公开兼容接口展开已知 Article URL。
3. 第三方数据必须保留原始 X URL、采集来源和采集时间。
4. 第三方接口不能作为账号完整时间线的唯一来源。

## 5. 产品分析字段

每个识别出的产品记录以下信息：

| 字段       | 说明                                       |
| ---------- | ------------------------------------------ |
| 产品名称   | 官网或产品页面使用的正式名称               |
| 产品方向   | SaaS、APP、AI 工具、内容、社群、服务等     |
| 目标用户   | 产品主要服务对象                           |
| 核心问题   | 产品解决的主要问题                         |
| 官网       | 产品的直接链接                             |
| 是否付费   | 是、否或未发现                             |
| 付费方式   | 订阅、买断、会员、广告、咨询、佣金等       |
| 公开价格   | 页面公开时记录，不自行推测                 |
| 免费策略   | 免费版、试用、Freemium、开源等             |
| 产品归属   | 创始、运营、任职、投资、合作、推广或不明确 |
| 归属置信度 | 高、中或低                                 |
| 证据       | 官网、价格页或本人声明                     |

判定约束：

- 存在支付按钮不等于已经产生收入。
- 推荐某个产品不等于产品属于该博主。
- 没有公开价格不等于免费。
- 没有收入数据时不估计收入规模和收入占比。

## 6. 人物报告模板

每位用户的子页面使用统一结构：

```markdown
# 用户名（@handle）

## 一句话定位

## 1. 产品

- 产品名称
- 产品方向
- 目标用户
- 核心价值
- 官网

## 2. 付费模式

- 是否付费
- 公开价格
- 订阅 / 买断 / 会员 / 服务 / 广告
- 免费与付费边界

## 3. 赛道

- 主赛道
- 细分方向
- 面向人群

## 4. 内容打法

- 最近 5 条原创内容的主题
- 常用内容形式
- 获客路径
- 内容如何导向产品

## 5. 优势

- 专业或资源优势
- 内容优势
- 产品优势
- 分发优势

## 6. 差异化

- 与同赛道其他人的区别
- 独特方法、身份或产品形态
- 可持续壁垒

## 7. 代表推文

- 置顶推文
- 最近 5 条原创推文
- 每条内容的简短判断

## 8. 商业闭环

内容 → 信任 → 产品 → 付费

## 9. 结论

- 值得关注的原因
- 可以借鉴的打法
- 当前证据不足之处

## 资料来源
```

写作时区分三类表述：

- **事实**：公开页面可以直接证明。
- **原话**：来自可回溯的帖子或网站。
- **分析**：根据多个证据形成的归纳。

## 7. 总览文章结构

总览页面包含：

1. 为什么开展这次分析。
2. 为什么选择这五个领域。
3. 如何定义“主页挂链接”和“正在运营产品”。
4. 数据采集、清洗和核验方法。
5. 原始记录数、去重账号数和最终入选人数。
6. 产品方向分布。
7. 付费方式分布。
8. 代表性的内容获客路径。
9. 创作者的共性打法和差异。
10. 研究限制和数据更新时间。
11. 用户报告列表。

用户列表建议包含：

| 用户 | 原始领域 | 产品 | 付费方式 | 一句话定位 | 报告 |
| ---- | -------- | ---- | -------- | ---------- | ---- |

## 8. Notion 和 NotionNext 发布方案

目标 Notion 空间或数据库：**闲裁彩山**。

目标 Slug：

```text
tweets-influencer-analyze
tweets-influencer-analyze/{handle}
```

示例：

```text
/tweets-influencer-analyze
/tweets-influencer-analyze/gefei55
/tweets-influencer-analyze/austinit
```

当前仓库已支持多级 Slug，三级及以上路径由 `pages/[prefix]/[slug]/[...suffix].js` 解析。

发布前必须先读取“闲裁彩山”的实际数据库 Schema，确认属性名称和允许值，不能假定字段一定叫作：

```text
Slug
Status
Type
Category
Tags
```

建议发布顺序：

1. 所有报告先创建为 Draft。
2. 验证内容、引用、Slug 和页面关系。
3. 创建总览页面并添加全部子页面入口。
4. 在每个子页面添加返回总览页的链接。
5. 统一切换为 Published。
6. 在 NotionNext 中逐一验证公开路径。

### Notion 连接状态

截至 2026-09-09，Notion 连接已可用，并已读取“闲裁彩山”的实际数据源 Schema。

- 数据源：`collection://15113421-7623-81b2-a625-000b72c017db`
- 属性：`title`、`type`、`category`、`tags`、`status`、`slug`、`date`、`summary`、`icon`、`password`
- `status`：`Published`、`Invisible`、`Draft`
- `type`：`Post`、`Page`、`Notice`、`Menu`、`SubMenu`、`Config`
- `category`：`技术分享`、`工具推荐`、`知行合一`、`心情随笔`

本批次报告使用 `type=Post`、`status=Draft` 创建；`category` 和 `tags` 只使用 Schema 已允许的值，不在发布期间修改数据库 Schema。

## 9. 费用预算

### 9.1 固定筛选成本

按当前公开价格估算：

```text
68 个用户资料 × $0.01 = $0.68
```

### 9.2 入选用户的帖子成本

设最终入选人数为 `N`：

```text
最近 5 条帖子：N × 5 × $0.005
置顶推文上限：N × 1 × $0.005
预计总费用上限：$0.68 + N × $0.03
```

| 入选人数 | 预计总费用上限 |
| -------: | -------------: |
|       20 |          $1.28 |
|       30 |          $1.58 |
|       40 |          $1.88 |
|       50 |          $2.18 |
|       68 |          $2.72 |

实际费用可能略低，原因包括：

- 部分账号没有置顶推文。
- 置顶推文可能与最近 5 条重复。
- 部分账号不足 5 条符合条件的原创帖。
- 同一 UTC 日重复读取同一资源通常会去重计费。

执行前建议在 X Developer Console 设置：

```text
Spending Limit: $3
Auto-recharge: Off
```

所有价格以执行时 X Developer Console 的实时价格为准。

## 10. 执行阶段与检查点

### Phase 0：准备

- [x] 从五个领域提取账号。
- [x] 73 条记录去重为 68 个唯一账号。
- [x] 确认 NotionNext 支持目标多级 Slug。
- [x] 连接 Notion 并读取目标数据库 Schema。
- [x] 确认 X API Spending Limit 不高于 $3，Auto-recharge 已关闭。

### Phase 1：主页筛选

- [x] 批量读取 68 个账号的主页资料。
- [x] 展开主页和简介中的 URL。
- [x] 排除纯 X 站内链接。
- [x] 生成入选名单和未入选名单。
- [x] 按入选人数重新计算后续帖子费用。

**检查点：** 在产生 Post Read 费用前，先报告最终入选人数、名单和精确预算。

2026-09-09 检查点结果：

- 正常返回 66 个账号，2 个账号不可用（`@lyc_zh`、`@expatlevi`）。
- 53 个账号存在有效外部链接并进入后续分析队列。
- 13 个正常返回的账号没有有效外部链接，按本轮标准不入选。
- 主页读取预算：`$0.68`；X Developer Console 实际费用：`$0.69`。
- 后续帖子读取费用上限：`53 × $0.03 = $1.59`。
- 按实际主页费用计算的项目总费用上限：`$0.69 + $1.59 = $2.28`。
- 完整结果：`docs/research/x-creators/data/phase-1/screening.md`。
- 进入 Phase 3 前，用户确认 X Developer Console 累计实际费用为 `$0.80`；剩余 48 人帖子读取上限 `$1.44`，预计累计不超过 `$2.24`。

### Phase 2：5 人试生产

- [x] 选择具有不同产品形态的 5 个用户。
- [x] 抓取网站、Pricing 和 About 等页面。
- [x] 获取最近 5 条原创帖和置顶帖。
- [x] 生成 5 份完整报告。
- [x] 检查产品归属、付费判断、引用和表达风格。

试生产样本：@gefei55、@tualatrix、@indie_maker_fox、@yupi996、@seclink。近期原创帖共返回 24 条；4 个置顶 ID 中返回 3 条，@seclink 的置顶帖返回 Not Found。原始响应位于 data/phase-2/raw/，报告位于 data/phase-2/reports/。

**检查点：** 先验证模板质量和错误类型，再扩大到全部入选用户。

### Phase 3：批量分析

- [x] 以 3–4 路并发处理剩余用户。
- [x] 保存每位用户的原始证据、采集时间和来源。
- [x] 生成统一结构的报告初稿。
- [x] 将失败账号标记为“待重试”或“需人工核验”。
- [x] 对产品归属和付费方式做人工复核。

Phase 3 结果：48 个剩余账号全部获得独立近期帖子原始响应，共 229 条；34 个置顶 ID 返回 33 条。共检查 84 个站外页面，55 个成功访问，失败状态保留在 phase-3/web。已生成 48 份统一报告，无法访问官网或没有明确价格时均保留证据边界。

### Phase 4：总编与发布

- [x] 统一产品分类和付费方式。
- [x] 汇总产品方向、付费模式和内容打法。
- [x] 创建 Notion 用户子页面。
- [x] 创建 Notion 总览页面并建立子页面链接。
- [x] 为子页面添加总览页返回链接。
- [x] 检查 Slug 唯一性。
- [ ] 将页面从 Draft 切换为 Published。
- [ ] 验证所有 NotionNext 公共路径。

Notion 已创建 1 个总览和 54 个个人 Draft；数据库查询确认 55 个 Slug 唯一且状态均为 Draft。页面映射保存于 data/notion-pages.json。公开发布与 NotionNext 路径验证等待用户确认。

### 增量账号：@ruguodev

- [x] 独立保存用户资料与最多 5 条近期原创帖的 X API 原始响应，不覆盖 Phase 1–3 文件。
- [x] 核验个人主页、Next Launch、IndexOf.AI 和 domaindex，共 4 个公开页面。
- [x] 生成个人分析报告，并将横向总览从 53 人更新为 54 人。
- [x] 创建 @ruguodev 的 Notion Draft，并更新现有总览 Draft。
- [x] 查询数据库，确认 55 个 Slug 唯一且全部保持 Draft。

增量 X API 请求上限按 1 次用户资料和最多 5 条帖子估算为约 $0.04；实际费用仍以 X Developer Console 为准。本次用户资料没有 pinned_tweet_id，因此没有发起置顶帖请求。

Notion 增量结果：新增 Ruguo 个人 Draft 页面（Page ID：3d613421-7623-81ac-909c-e26aad7badf7），并将既有总览 Draft 更新为 54 人。最终数据库查询返回 55 个相关页面、55 个唯一 Slug，状态全部为 Draft；尚未公开发布。

### Notion 内容重构与浏览器复查

- [x] 移除 54 份个人报告中的“证据”章节与本地文件路径。
- [x] 将“近期内容打法”统一重构为 Notion 友好的内容表现表格。
- [x] 将报告口吻调整为专业出海从业者视角，删除抓取错误、状态码和机械化结论。
- [x] 使用内嵌 Chrome 对 29 个原失败 URL 批量重试：22 个成功渲染，排除 2 个无关跳转后，将 20 个相关页面补充进报告。
- [x] 覆盖更新 1 个总览与 54 个个人 Notion Draft。
- [x] 查询数据库并抽查页面，确认内容、Slug 和 Draft 状态。

浏览器复查显示，原失败并非单一的 curl 拦截问题：旧采集器使用 Node fetch，部分站点依赖浏览器跳转或动态渲染；少量站点在真实 Chrome 中仍返回 502、连接关闭或空白页。浏览器原始复查结果保存于 data/browser-retry/browser-retry.raw.json。

Notion 更新后抽查了 Cydiar、Jeffery Kaneda、luobogor、哥飞、Ruguo 和总览页：个人页均包含“核心判断”和原生表格形式的“近期内容表现”，未出现“证据”章节、本地路径或抓取错误措辞。数据库最终查询仍为 55 个唯一 Slug，状态全部为 Draft。

## 11. 数据状态与失败处理

每个账号保留状态字段：

```text
待筛选
无外部链接
待采集
采集中
证据不足
待复核
已完成
发布失败
已发布
需更新
```

异常处理原则：

- 账号不存在、改名或受保护：记录原因，不反复请求。
- 页面超时或 5xx：有限重试，失败后进入人工队列。
- 登录墙、验证码或权限限制：不绕过。
- 网站无法确认产品归属：降低置信度，不作确定断言。
- 没有公开付费信息：写“未发现公开付费方式”。
- X API 返回 429：遵循 `x-rate-limit-reset`，不进行高频重试。
- Credits 或 Spending Limit 耗尽：停止采集并报告，不自动充值。

## 12. 完成标准

项目完成需同时满足：

- [ ] 73 条原始记录已归并为 68 个唯一账号。
- [ ] 所有入选账号都存在有效主页外部链接。
- [ ] 每位入选用户的网站分析都有可回溯来源。
- [ ] 每位用户都记录最近 5 条原创帖和置顶帖状态。
- [ ] 产品归属、是否付费和付费方式没有无证据断言。
- [ ] 跨领域账号只生成一份报告并保留多值领域标签。
- [ ] 每位用户只有一个唯一 Slug。
- [ ] 总览页可以访问全部用户报告。
- [x] 每个用户报告可以通过 https://www.createsun.work/article/tweets-influencer-analyze 返回总览页。
- [ ] 全部 NotionNext 公共路径实际可打开。
- [ ] 总 X API 费用不超过 $3。
- [ ] 文档记录采集日期、来源和研究限制。

## 13. 非目标

本轮不包含：

- 对五个领域以外的账号进行分析。
- 读取每位用户的完整历史时间线。
- 推断未公开的收入、利润或用户规模。
- 自动注册产品、试用付费功能或完成购买。
- 采集私信、非公开数据或登录后隐私内容。
- 使用个人 X Cookie 运行非官方批量抓取器。
- 绕过 X、产品网站或 Notion 的访问限制。
