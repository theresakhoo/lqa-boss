import React, { useEffect, useCallback, useRef, forwardRef } from 'react'
import { EditorState, LexicalEditor as Editor, $getRoot, $isElementNode, TextNode, LexicalNode } from 'lexical'
import {
  HeadingNode,
  QuoteNode
} from '@lexical/rich-text'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeNode } from '@lexical/code'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { Box } from '@chakra-ui/react'
import { NormalizedItem, PlaceholderDescription } from '../types'
import { PlaceholderNode } from './editor/nodes/PlaceholderNode'
import { PlainTextPastePlugin } from './editor/plugins/PlainTextPastePlugin'
import { ArrowNavigationPlugin } from './editor/plugins/ArrowNavigationPlugin'
import { InitializePlugin } from './editor/plugins/InitializePlugin'
import { DragDropPlugin } from './editor/plugins/DragDropPlugin'
import { EditorRefPlugin, NormalizedTextEditorRef } from './editor/plugins/EditorRefPlugin'
import { KeyboardShortcutPlugin } from './editor/plugins/KeyboardShortcutPlugin'
import { normalizedArraysEqual } from '../utils/normalizedComparison'

// Re-export NormalizedTextEditorRef for consumers
export type { NormalizedTextEditorRef }

// Global store for placeholder descriptions
let globalPlaceholderDescriptions: { [key: string]: PlaceholderDescription } | undefined

interface NormalizedTextEditorProps {
  normalizedContent: NormalizedItem[]
  sourceContent?: NormalizedItem[]
  onChange: (normalizedContent: NormalizedItem[]) => void
  onFocus?: () => void
  isActive?: boolean
  placeholderDescriptions?: { [key: string]: { sample?: string, desc?: string } }
  segmentState?: 'original' | 'saved' | 'modified'
}

const NormalizedTextEditor = forwardRef<NormalizedTextEditorRef, NormalizedTextEditorProps>(({
  normalizedContent,
  sourceContent,
  onChange,
  onFocus,
  isActive,
  placeholderDescriptions,
  segmentState = 'original'
}, ref) => {
  const lastEmittedContentRef = useRef<NormalizedItem[]>([])
  const editorRef = useRef<NormalizedTextEditorRef>(null)

  // Update global placeholder descriptions whenever they change
  useEffect(() => {
    globalPlaceholderDescriptions = placeholderDescriptions
  }, [placeholderDescriptions])

  // Add global styles and tooltip handler
  useEffect(() => {
    const styleId = 'placeholder-tooltip-styles'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        .placeholder-tooltip-container {
          position: fixed;
          background-color: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          white-space: pre-line;
          pointer-events: none;
          z-index: 10000;
          max-width: 250px;
          opacity: 0;
          transition: opacity 0s;
        }
        .placeholder-tooltip-container.visible {
          opacity: 1;
        }
      `
      document.head.appendChild(style)
    }

    let tooltipElement: HTMLDivElement | null = null

    const showTooltip = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('placeholder-with-tooltip')) {
        const tooltipText = target.getAttribute('data-tooltip')
        if (!tooltipText) return

        // Get placeholder v value and check for description
        const placeholderV = target.getAttribute('data-placeholder-v')
        let fullTooltip = tooltipText

        if (placeholderV && globalPlaceholderDescriptions) {
          const phDesc = globalPlaceholderDescriptions[placeholderV]
          if (phDesc?.desc) {
            fullTooltip += `\n\n${phDesc.desc}`
          }
        }

        // Create tooltip if it doesn't exist
        if (!tooltipElement) {
          tooltipElement = document.createElement('div')
          tooltipElement.className = 'placeholder-tooltip-container'
          document.body.appendChild(tooltipElement)
        }

        tooltipElement.textContent = fullTooltip

        // Position the tooltip
        const rect = target.getBoundingClientRect()
        const tooltipRect = tooltipElement.getBoundingClientRect()

        let top = rect.top - tooltipRect.height - 8
        let left = rect.left + rect.width / 2 - tooltipRect.width / 2

        // Check if tooltip would go above viewport
        if (top < 10) {
          // Position below instead
          top = rect.bottom + 8
        }

        // Check if tooltip would go off left edge
        if (left < 10) {
          left = 10
        }

        // Check if tooltip would go off right edge
        const maxLeft = window.innerWidth - tooltipRect.width - 10
        if (left > maxLeft) {
          left = maxLeft
        }

        tooltipElement.style.top = `${top}px`
        tooltipElement.style.left = `${left}px`
        tooltipElement.classList.add('visible')
      }
    }

    const hideTooltip = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('placeholder-with-tooltip') && tooltipElement) {
        tooltipElement.classList.remove('visible')
      }
    }

    document.addEventListener('mouseover', showTooltip)
    document.addEventListener('mouseout', hideTooltip)

    return () => {
      document.removeEventListener('mouseover', showTooltip)
      document.removeEventListener('mouseout', hideTooltip)
      if (tooltipElement && tooltipElement.parentNode) {
        tooltipElement.parentNode.removeChild(tooltipElement)
      }
    }
  }, [])

  // Connect the forwarded ref to our internal ref
  React.useImperativeHandle(ref, () => ({
    blur: () => editorRef.current?.blur(),
    focus: () => editorRef.current?.focus(),
    forceUpdate: (content: NormalizedItem[]) => editorRef.current?.forceUpdate(content)
  }), [])

  const initialConfig = {
    namespace: 'NormalizedTextEditor',
    theme: {
      text: {
        bold: 'text-bold',
        italic: 'text-italic',
        underline: 'text-underline',
      },
    },
    onError: (error: Error) => {
      console.error('Lexical error:', error)
    },
    nodes: [
      PlaceholderNode,
      HeadingNode,
      QuoteNode,
      ListItemNode,
      ListNode,
      CodeNode,
      AutoLinkNode,
      LinkNode
    ]
  }

  const handleChange = useCallback((editorState: EditorState, _editor: Editor, tags: Set<string>) => {
    // Ignore programmatic updates (initialization, external updates, undo/reset operations)
    if (tags.has('initial-load') || tags.has('content-update') || tags.has('force-update')) {
      return
    }

    editorState.read(() => {
      const root = $getRoot()
      const paragraphs = root.getChildren()

      if (paragraphs.length === 0) {
        const emptyContent: NormalizedItem[] = []
        if (!normalizedArraysEqual(emptyContent, lastEmittedContentRef.current)) {
          lastEmittedContentRef.current = emptyContent
          onChange(emptyContent)
        }
        return
      }

      const newNormalized: NormalizedItem[] = []

      paragraphs.forEach((paragraph, paragraphIdx) => {
        if (!$isElementNode(paragraph)) return

        const children = paragraph.getChildren()

        children.forEach((node: LexicalNode) => {
          if (node instanceof TextNode) {
            const text = node.getTextContent()
            if (text) {
              newNormalized.push(text)
            }
          } else if (node instanceof PlaceholderNode) {
            newNormalized.push(node.__placeholder)
          }
        })

        // Add newline after each paragraph except the last
        if (paragraphIdx < paragraphs.length - 1) {
          // Append newline to the last text item, or create a new text item
          if (newNormalized.length > 0 && typeof newNormalized[newNormalized.length - 1] === 'string') {
            newNormalized[newNormalized.length - 1] = (newNormalized[newNormalized.length - 1] as string) + '\n'
          } else {
            newNormalized.push('\n')
          }
        }
      })

      // Only emit onChange if content has actually changed
      if (!normalizedArraysEqual(newNormalized, lastEmittedContentRef.current)) {
        lastEmittedContentRef.current = [...newNormalized]
        onChange(newNormalized)
      }
    })
  }, [onChange])

  // Get background color based on segment state
  const getEditorBg = () => {
    if (!isActive) return 'transparent'
    // Show orange for all corrected segments (saved or modified)
    if (segmentState !== 'original') return 'rgba(251, 146, 60, 0.15)' // light orange for corrected
    return 'rgba(147, 197, 253, 0.15)' // light blue for unchanged
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <Box
        position="relative"
        onClick={onFocus}
        borderRadius="md"
        p={2}
        bg={getEditorBg()}
        backdropFilter={isActive ? 'blur(5px)' : 'none'}
        _hover={{
          bg: 'rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(5px)'
        }}
        transition="all 0.2s"
        minWidth={0}
        maxW="100%"
        overflowWrap="break-word"
      >
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              style={{
                minHeight: '32px',
                outline: 'none',
                color: '#374151',
                fontSize: '16px',
                fontWeight: 'normal',
                lineHeight: '1.6',
                cursor: 'text',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                maxWidth: '100%',
              }}
              className="lexical-editor-content"
            />
          }
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <OnChangePlugin onChange={handleChange} />
        <HistoryPlugin />
        <PlainTextPastePlugin />
        <ArrowNavigationPlugin />
        <KeyboardShortcutPlugin />
        <InitializePlugin normalizedContent={normalizedContent} sourceContent={sourceContent} />
        <DragDropPlugin sourceContent={sourceContent} />
        <EditorRefPlugin editorRef={editorRef} sourceContent={sourceContent} />
      </Box>
    </LexicalComposer>
  )
})

export default NormalizedTextEditor 