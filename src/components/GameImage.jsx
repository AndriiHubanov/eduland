// ─── GameImage — зображення з SVG → emoji fallback ───
// PNG → SVG → emoji (для SVG-плейсхолдерів)

import { useState } from 'react'

export default function GameImage({ src, fallback, alt = '', className = '', style = {}, pixelated = false }) {
  const [state, setState] = useState('png') // 'png' | 'svg' | 'emoji'

  const imgStyle = {
    ...style,
    ...(pixelated ? { imageRendering: 'pixelated' } : {}),
  }

  if (state === 'emoji' || !src) {
    return (
      <span className={className} style={style} role="img" aria-label={alt}>
        {fallback}
      </span>
    )
  }

  const svgSrc = src.replace(/\.png$/, '.svg')

  if (state === 'svg') {
    return (
      <img
        src={svgSrc}
        alt={alt}
        className={className}
        style={imgStyle}
        onError={() => setState('emoji')}
        draggable={false}
      />
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={imgStyle}
      onError={() => setState('svg')}
      draggable={false}
    />
  )
}
