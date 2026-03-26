import { useEffect, useRef } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $isElementNode,
  LexicalNode,
  TextNode
} from 'lexical'
import { NormalizedItem } from '../../../types'
import { PlaceholderNode, $createPlaceholderNode } from '../nodes/PlaceholderNode'
import { normalizedArraysEqual } from '../../../utils/normalizedComparison'

// Plugin to initialize editor with normalized content
interface InitializePluginProps {
  normalizedContent: NormalizedItem[]
  sourceContent?: NormalizedItem[]
}

export function InitializePlugin({ normalizedContent, sourceContent }: InitializePluginProps): null {
  const [editor] = useLexicalComposerContext()
  const isInitializedRef = useRef(false)
  const lastExternalContentRef = useRef<NormalizedItem[]>([])

  // Helper function to get current editor content as normalized items
  const getCurrentContent = (): NormalizedItem[] => {
    const root = $getRoot()
    const paragraphs = root.getChildren()

    if (paragraphs.length === 0) {
      return []
    }

    const items: NormalizedItem[] = []

    paragraphs.forEach((paragraph, paragraphIdx) => {
      if (!$isElementNode(paragraph)) return

      const children = paragraph.getChildren()

      children.forEach((node: LexicalNode) => {
        if (node instanceof TextNode) {
          const text = node.getTextContent()
          if (text) {
            items.push(text)
          }
        } else if (node instanceof PlaceholderNode) {
          items.push(node.__placeholder)
        }
      })

      // Add newline after each paragraph except the last
      if (paragraphIdx < paragraphs.length - 1) {
        // Append newline to the last text item, or create a new text item
        if (items.length > 0 && typeof items[items.length - 1] === 'string') {
          items[items.length - 1] = (items[items.length - 1] as string) + '\n'
        } else {
          items.push('\n')
        }
      }
    })

    return items
  }

  useEffect(() => {
    // Only update if:
    // 1. This is the first initialization, OR
    // 2. The new content is different from what we last set externally AND different from current editor content

    // Read current content first (synchronously, outside of update)
    let currentContent: NormalizedItem[] = []
    editor.getEditorState().read(() => {
      currentContent = getCurrentContent()
    })

    // Check if this is genuinely new external content
    const isNewExternalContent = !normalizedArraysEqual(normalizedContent, lastExternalContentRef.current)
    const isDifferentFromCurrent = !normalizedArraysEqual(normalizedContent, currentContent)

    if (!isInitializedRef.current || (isNewExternalContent && isDifferentFromCurrent)) {
      // Schedule update outside of read() to avoid flushSync warning
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

        normalizedContent.forEach((item) => {
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
              // First, try to find exact match including all properties
              const exactMatch = sourcePlaceholders.find(sp =>
                typeof sp.item !== 'string' &&
                sp.item.v === item.v &&
                sp.item.t === item.t
              )

              if (exactMatch) {
                index = exactMatch.index
              } else {
                // If no exact match, try matching just by value
                const valueMatch = sourcePlaceholders.find(sp =>
                  typeof sp.item !== 'string' && sp.item.v === item.v
                )
                if (valueMatch) {
                  index = valueMatch.index
                }
              }

              // For handling duplicates, remove the matched item from future matches
              // This ensures first occurrence in translation maps to first in source, etc.
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

        lastExternalContentRef.current = [...normalizedContent]
        isInitializedRef.current = true
      }, { tag: 'content-update' })
    }
  }, [editor, normalizedContent, sourceContent])

  return null
}
