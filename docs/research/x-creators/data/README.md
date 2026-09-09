# X 创作者研究数据

## 文件分层

- phase-1 下的 raw.json：X API 主页批量查询的原始响应，不包含认证信息。
- phase-1/profiles.json：从原始响应派生的账号、领域、链接和筛选状态。
- phase-1/screening.md：可读的主页筛选结果。
- phase-2/raw 下的 raw.json：5 人试生产的近期原创帖与置顶帖原始响应。
- phase-2/raw/manifest.json：本次试生产请求清单。
- phase-2/reports 下的 Markdown：结合 X 原始数据与公开官网核验生成的分析报告。
- phase-3/raw：剩余 48 人的近期原创帖与置顶帖 X API 原始响应。
- phase-3/web：剩余 48 人公开主页和产品页面的结构化访问证据。
- phase-3/reports：剩余 48 人的统一报告初稿。
- additions/ruguodev/raw：用户追加账号的 X API 原始响应。
- overview.md：54 人横向总览。
- publishing-bundle.json：Notion 属性、内容与 Slug 发布包。
- notion-pages.json：已创建的 1 个总览页和 54 个个人详情页映射。

发布时总览页使用 Published，进入首页文章流；54 个个人详情页使用
Invisible，保持公开路由可访问但不进入首页、标签和 RSS 列表。

原始文件不应手工修改。需要更改解析或分析结果时，应修改脚本并重新生成派生文件。
