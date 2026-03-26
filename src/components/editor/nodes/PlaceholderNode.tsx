import React from 'react'
import { DecoratorNode, NodeKey } from 'lexical'
import { NormalizedPlaceholder } from '../../../types'

// Flag to allow programmatic removal during drag-and-drop
let allowPlaceholderRemoval = false

export function setAllowPlaceholderRemoval(allow: boolean) {
  allowPlaceholderRemoval = allow
}

// Custom node for non-editable placeholders
export class PlaceholderNode extends DecoratorNode<React.ReactNode> {
  __placeholder: NormalizedPlaceholder
  __index: number

  static getType(): string {
    return 'placeholder'
  }

  static clone(node: PlaceholderNode): PlaceholderNode {
    return new PlaceholderNode(node.__placeholder, node.__index, node.__key)
  }

  constructor(placeholder: NormalizedPlaceholder, index: number, key?: NodeKey) {
    super(key)
    this.__placeholder = placeholder
    this.__index = index
  }

  // Make placeholder inline
  isInline(): boolean {
    return true
  }

  // Make placeholders non-selectable - cursor jumps over them
  isKeyboardSelectable(): boolean {
    return false
  }

  // Make placeholder act as a word boundary for double-click selection
  isSegmented(): boolean {
    return true
  }

  // Prevent removal of placeholder nodes except during drag-and-drop
  remove(): this {
    if (allowPlaceholderRemoval) {
      // Allow programmatic removal during drag-and-drop
      super.remove()
    }
    // Always return this (whether removed or not)
    return this
  }

  createDOM(): HTMLElement {
    const { v, s } = this.__placeholder

    // Build tooltip content
    let tooltipContent = `Code: ${v}`
    if (s) {
      tooltipContent += `\nSample: ${s}`
    }

    const span = document.createElement('span')
    span.setAttribute('data-lexical-decorator', 'true')
    span.setAttribute('data-placeholder-index', this.__index.toString())
    span.setAttribute('data-placeholder-v', v)
    span.setAttribute('data-tooltip', tooltipContent)
    span.className = 'placeholder-with-tooltip'
    span.style.display = 'inline-block'
    span.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'
    span.style.padding = '2px 8px'
    span.style.borderRadius = '12px'
    span.style.border = '1px solid rgba(59, 130, 246, 0.4)'
    span.style.fontFamily = 'monospace'
    span.style.fontSize = '0.85em'
    span.style.fontWeight = '600'
    span.style.color = 'rgba(37, 99, 235, 1)'
    span.style.userSelect = 'none'
    span.style.cursor = 'grab'
    span.style.pointerEvents = 'auto'
    span.contentEditable = 'false'
    span.draggable = true

    // Add drag event listeners
    span.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/placeholder', JSON.stringify(this.__placeholder))
      e.dataTransfer?.setData('text/node-key', this.__key || '')
      e.dataTransfer?.setData('text/index', this.__index.toString())
      span.style.opacity = '0.5'
      span.style.cursor = 'grabbing'

      // Create a transparent drag image to hide the default drag ghost
      const dragImage = document.createElement('div')
      dragImage.style.position = 'absolute'
      dragImage.style.top = '-1000px'
      dragImage.style.left = '-1000px'
      dragImage.style.width = '1px'
      dragImage.style.height = '1px'
      dragImage.style.opacity = '0'
      dragImage.style.pointerEvents = 'none'
      document.body.appendChild(dragImage)

      // Set transparent drag image
      e.dataTransfer?.setDragImage(dragImage, 0, 0)

      // Clean up the drag image after a short delay
      setTimeout(() => {
        if (dragImage && dragImage.parentNode) {
          dragImage.parentNode.removeChild(dragImage)
        }
      }, 0)
    })

    span.addEventListener('dragend', () => {
      span.style.opacity = '1'
      span.style.cursor = 'grab'
    })

    return span
  }

  updateDOM(): false {
    return false
  }

  getTextContent(): string {
    // Display position-based index + 1 (for 1-based numbering)
    return `{${this.__index + 1}}`
  }

  decorate(): React.ReactNode {
    // Display position-based index + 1 (for 1-based numbering)
    const displayValue = (this.__index + 1).toString()
    // Return wrapped in span - plain primitives don't work correctly with Lexical
    return <span>{displayValue}</span>
  }

  static importJSON(serializedNode: any): PlaceholderNode {
    const { placeholder, index } = serializedNode
    return new PlaceholderNode(placeholder, index ?? 0)
  }

  exportJSON(): any {
    return {
      type: 'placeholder',
      placeholder: this.__placeholder,
      index: this.__index
    }
  }
}

export function $createPlaceholderNode(placeholder: NormalizedPlaceholder, index: number): PlaceholderNode {
  return new PlaceholderNode(placeholder, index)
}
