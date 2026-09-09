import SmartLink from '@/components/SmartLink'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import { useRouter } from 'next/router'
import CONFIG from '../config'
import BlogItem from './BlogItem'

export default function BlogListPage({
  page = 1,
  posts = [],
  postCount = 0,
  home = false
}) {
  const router = useRouter()
  const { NOTION_CONFIG } = useGlobal()
  const perPage = siteConfig('POSTS_PER_PAGE', 12, NOTION_CONFIG)
  const featuredPostSlug = siteConfig(
    'EDITORIAL_FEATURED_POST_SLUG',
    '',
    CONFIG
  )
  const totalPage = Math.ceil(postCount / perPage)
  const currentPage = Number(page)
  const prefix = router.asPath
    .split('?')[0]
    .replace(/\/page\/[1-9]\d*/, '')
    .replace(/\/$/, '')
    .replace('.html', '')
  const pageHref = target =>
    target === 1 ? `${prefix || ''}/` : `${prefix}/page/${target}`

  return (
    <section className='editorial-list-section'>
      <div id='posts-wrapper' className='editorial-post-list'>
        {posts.map(post => (
          <BlogItem
            key={post.id}
            post={post}
            featured={
              home &&
              currentPage === 1 &&
              featuredPostSlug &&
              post.slug === featuredPostSlug
            }
          />
        ))}
      </div>

      {totalPage > 1 && (
        <nav className='editorial-pagination' aria-label='Pagination'>
          {currentPage > 1 ? (
            <SmartLink href={pageHref(currentPage - 1)}>← Newer</SmartLink>
          ) : (
            <span />
          )}
          <span>{String(currentPage).padStart(2, '0')} / {String(totalPage).padStart(2, '0')}</span>
          {currentPage < totalPage ? (
            <SmartLink href={pageHref(currentPage + 1)}>Older →</SmartLink>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  )
}
