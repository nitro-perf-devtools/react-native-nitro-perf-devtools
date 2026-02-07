import { defineConfig } from 'vite'
import { rozenitePlugin } from '@rozenite/vite-plugin'
import path from 'node:path'
import type { Plugin } from 'vite'

const monorepoRoot = path.resolve(__dirname, '../..')

/**
 * Inline all JS/CSS chunks into the HTML so the panel is a single file.
 * Rozenite's middleware only reliably serves the .html entry; extra
 * assets at sibling paths fall through to Metro which rejects them.
 */
function inlinePlugin(): Plugin {
  return {
    name: 'vite-plugin-inline-build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (fileName.endsWith('.html')) {
          if (chunk.type !== 'asset') continue
          let html = typeof chunk.source === 'string' ? chunk.source : new TextDecoder().decode(chunk.source)

          // Inline JS chunks
          for (const [jsName, jsChunk] of Object.entries(bundle)) {
            if (jsChunk.type === 'chunk' && jsName.endsWith('.js')) {
              // Escape </script> sequences so the browser doesn't close the tag early
              const escaped = jsChunk.code.replace(/<\/script/gi, '<\\/script')
              // Use a function replacement to avoid $& / $' / $` interpretation
              // in the minified bundle (e.g. React Children uses "$&" in .replace())
              const inlined = `<script type="module">${escaped}</script>`
              html = html.replace(
                new RegExp(`<script[^>]*src=["']\.?\/?${jsName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>\\s*</script>`),
                () => inlined,
              )
              delete bundle[jsName]
            }
          }

          // Inline CSS assets
          for (const [cssName, cssChunk] of Object.entries(bundle)) {
            if (cssChunk.type === 'asset' && cssName.endsWith('.css')) {
              const cssSource = typeof cssChunk.source === 'string' ? cssChunk.source : new TextDecoder().decode(cssChunk.source)
              html = html.replace(
                new RegExp(`<link[^>]*href=["']\.?\/?${cssName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`),
                `<style>${cssSource}</style>`,
              )
              delete bundle[cssName]
            }
          }

          chunk.source = html
        }
      }
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [rozenitePlugin(), inlinePlugin()],
  build: {
    assetsDir: '.',
    cssCodeSplit: false,
  },
  resolve: {
    alias: {
      'react': path.resolve(monorepoRoot, 'node_modules/react'),
      'react-dom': path.resolve(monorepoRoot, 'node_modules/react-dom'),
    },
  },
})
