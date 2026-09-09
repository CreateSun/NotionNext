import { render, screen } from '@testing-library/react'
import { siteConfig } from '@/lib/config'
import BlogItem from '@/themes/editorial/components/BlogItem'
import BlogListPage from '@/themes/editorial/components/BlogListPage'

jest.mock('@/lib/config', () => ({
  siteConfig: jest.fn()
}))

jest.mock('@/lib/global', () => ({
  useGlobal: () => ({ NOTION_CONFIG: {} })
}))

jest.mock('next/router', () => ({
  useRouter: () => ({ asPath: '/' })
}))

jest.mock('@/components/LazyImage', () => ({
  __esModule: true,
  default: ({ className = '', src = '' }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt='' className={className} src={src} />
  )
}))

jest.mock('@/components/SmartLink', () => ({
  __esModule: true,
  default: ({ children, className = '', href = '' }) => (
    <a className={className} href={href}>
      {children}
    </a>
  )
}))

const createPost = overrides => ({
  id: overrides.slug,
  href: `/article/${overrides.slug}`,
  title: overrides.slug,
  ...overrides
})

describe('editorial post list', () => {
  beforeEach(() => {
    siteConfig.mockImplementation((key, defaultValue) =>
      key === 'EDITORIAL_FEATURED_POST_SLUG'
        ? 'mi-gpt-account'
        : defaultValue
    )
  })

  it('features mi-gpt-account only on the homepage', () => {
    const featuredPost = createPost({ slug: 'mi-gpt-account' })
    const regularPost = createPost({ slug: 'another-post' })
    const { rerender } = render(
      <BlogListPage home posts={[regularPost, featuredPost]} postCount={2} />
    )

    expect(screen.getByText('mi-gpt-account').closest('article')).toHaveClass(
      'featured'
    )
    expect(screen.getByText('another-post').closest('article')).not.toHaveClass(
      'featured'
    )

    rerender(<BlogListPage posts={[featuredPost]} postCount={1} />)

    expect(
      screen.getByText('mi-gpt-account').closest('article')
    ).not.toHaveClass('featured')
  })

  it('does not fall back to the full cover when the thumbnail is absent', () => {
    const post = createPost({
      slug: 'no-thumbnail',
      pageCover: '/full-cover.png'
    })

    const { container } = render(<BlogItem post={post} />)

    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(container.querySelector('article')).toHaveClass('no-cover')
  })
})
