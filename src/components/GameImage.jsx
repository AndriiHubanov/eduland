// ─── GameImage — зображення з emoji-fallback ───
// Спробує завантажити PNG; якщо файл відсутній — показує emoji.

import { useState } from 'react'

/**
 * @param {string}  src      — шлях до зображення (з assets.js)
 * @param {string}  fallback — emoji, що показується коли зображення немає
 * @param {string}  alt      — alt-текст для accessibility
 * @param {string}  className
 * @param {object}  style
 * @param {boolean} pixelated — увімкнути image-rendering: pixelated
 */
export default function GameImage({ src, fallback, alt = '', className = '', style = {}, pixelated = false }) {
  const [failed, setFailed] = useState(false)

  if (failed || !src) {
    return (
      <span className={className} style={style} role="img" aria-label={alt}>
        {fallback}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        ...style,
        ...(pixelated ? { imageRendering: 'pixelated' } : {}),
      }}
      onError={() => setFailed(true)}
      draggable={false}
    />
  )
}
