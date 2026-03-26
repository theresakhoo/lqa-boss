import React from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical'
import { NormalizedItem } from '../../../types'
import { $createPlaceholderNode } from '../nodes/PlaceholderNode'

export interface NormalizedTextEditorRef {
  blur: () => void
  focus: () => void
  forceUpdate: (content: NormalizedItem[]) => void
}

// Plugin to expose editor methods via ref
export function EditorRefPlugin({ editorRef, sourceContent }: {
  editorRef: React.RefObject<NormalizedTextEditorRef | null>,
  sourceContent?: NormalizedItem[]
}): null {
  const [editor] = useLexicalComposerContext()

  React.useImperativeHandle(editorRef, () => ({
    blur: () => {
      editor.blur()
    },
    focus: () => {
      editor.focus()
    },
    forceUpdate: (content: NormalizedItem[]) => {
      editor.update(() => {
        const root = $getRoot()
        root.clear()

        let paragraph = $createParagraphNode()

        // Build a list of source placeholders with their positions
        const sourcePlaceholders: Array<{ item: NormalizedItem; index: number }> = []
        if (sourceContent) {
          let sourceIndex = 0
          sourceContent.forEach(item => {
            if (typeof item !== 'string') {
              sourcePlaceholders.push({ item, index: sourceIndex })
              sourceIndex++
            }
          })
        }

        // Track current position for fallback (0-based)
        let currentPosition = 0

        content.forEach((item) => {
          if (typeof item === 'string') {
            // Split by newlines and create separate paragraphs
            const parts = item.split('\n')
            parts.forEach((part, partIdx) => {
              if (partIdx > 0) {
                // Start a new paragraph for each newline
                root.append(paragraph)
                paragraph = $createParagraphNode()
              }
              if (part) {
                paragraph.append($createTextNode(part))
              }
            })
          } else {
            // Find the matching source placeholder
            let index = currentPosition

            if (sourceContent && sourcePlaceholders.length > 0) {
              // For handling duplicates, find and remove the first matching item
              const matchIndex = sourcePlaceholders.findIndex(sp =>
                typeof sp.item !== 'string' &&
                sp.item.v === item.v &&
                sp.item.t === item.t
              )
              if (matchIndex !== -1) {
                index = sourcePlaceholders[matchIndex].index
                sourcePlaceholders.splice(matchIndex, 1)
              }
            }

            paragraph.append($createPlaceholderNode(item, index))
            currentPosition++
          }
        })

        // Append the last paragraph
        root.append(paragraph)
      }, { tag: 'force-update' })
    }
  }), [editor, sourceContent])

  return null
}
