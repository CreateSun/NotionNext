import { useEffect, useRef } from 'react'

const INTERACTIVE_SELECTOR =
  'a, button, input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])'

export default function CustomCursor() {
  const dotRef = useRef(null)
  const circleRef = useRef(null)

  useEffect(() => {
    const root = document.getElementById('theme-editorial')
    const dot = dotRef.current
    const circle = circleRef.current
    const finePointer = window.matchMedia('(pointer: fine)').matches
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    if (!root || !dot || !circle || !finePointer || reducedMotion) return

    const setVisible = visible => {
      root.classList.toggle('editorial-cursor-visible', visible)
    }

    const handlePointerMove = event => {
      dot.style.left = event.clientX + 'px'
      dot.style.top = event.clientY + 'px'
      circle.style.left = event.clientX + 'px'
      circle.style.top = event.clientY + 'px'
      setVisible(true)
    }

    const handlePointerOver = event => {
      if (event.target.closest?.(INTERACTIVE_SELECTOR)) {
        root.classList.add('editorial-cursor-hover')
      }
    }

    const handlePointerOut = event => {
      const fromInteractive = event.target.closest?.(INTERACTIVE_SELECTOR)
      const toInteractive = event.relatedTarget?.closest?.(INTERACTIVE_SELECTOR)
      if (fromInteractive && fromInteractive !== toInteractive) {
        root.classList.remove('editorial-cursor-hover')
      }
    }

    const handlePointerLeave = () => {
      setVisible(false)
      root.classList.remove('editorial-cursor-hover')
    }

    root.classList.add('editorial-fancy-cursor')
    root.addEventListener('pointermove', handlePointerMove, { passive: true })
    root.addEventListener('pointerover', handlePointerOver, { passive: true })
    root.addEventListener('pointerout', handlePointerOut, { passive: true })
    root.addEventListener('pointerleave', handlePointerLeave, { passive: true })

    return () => {
      root.classList.remove(
        'editorial-fancy-cursor',
        'editorial-cursor-visible',
        'editorial-cursor-hover'
      )
      root.removeEventListener('pointermove', handlePointerMove)
      root.removeEventListener('pointerover', handlePointerOver)
      root.removeEventListener('pointerout', handlePointerOut)
      root.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [])

  return (
    <>
      <span
        ref={dotRef}
        className='editorial-cursor-dot'
        aria-hidden='true'
      />
      <span
        ref={circleRef}
        className='editorial-cursor-circle'
        aria-hidden='true'
      />
    </>
  )
}
