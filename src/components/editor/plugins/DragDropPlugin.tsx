import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getRoot,
  $getNodeByKey,
  $isElementNode,
  $setSelection,
  $createRangeSelection,
  $createTextNode,
  LexicalNode,
  TextNode
} from 'lexical'
import { NormalizedItem, NormalizedPlaceholder } from '../../../types'
import { $createPlaceholderNode, setAllowPlaceholderRemoval } from '../nodes/PlaceholderNode'

interface DragDropPluginProps {
  sourceContent?: NormalizedItem[]
}

// Plugin to handle drag and drop
export function DragDropPlugin({ sourceContent }: DragDropPluginProps): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    let dragIndicator: HTMLElement | null = null

    const createDragIndicator = () => {
      const indicator = document.createElement('div')
      indicator.style.position = 'absolute'
      indicator.style.width = '2px'
      indicator.style.height = '20px'
      indicator.style.backgroundColor = '#3b82f6'
      indicator.style.borderRadius = '1px'
      indicator.style.pointerEvents = 'none'
      indicator.style.zIndex = '1000'
      indicator.style.opacity = '0'
      indicator.style.transition = 'opacity 0.15s ease-in-out'
      return indicator
    }

    const showDragIndicator = (x: number, y: number) => {
      if (!dragIndicator) {
        dragIndicator = createDragIndicator()
        document.body.appendChild(dragIndicator)
      }
      dragIndicator.style.left = `${x - 1}px`
      dragIndicator.style.top = `${y - 10}px`
      dragIndicator.style.opacity = '1'
    }

    const hideDragIndicator = () => {
      if (dragIndicator) {
        dragIndicator.style.opacity = '0'
      }
    }

    const removeDragIndicator = () => {
      if (dragIndicator) {
        document.body.removeChild(dragIndicator)
        dragIndicator = null
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer!.dropEffect = 'move'

      // Show caret indicator at drop position
      showDragIndicator(e.clientX, e.clientY)
    }

    const handleDragLeave = (e: DragEvent) => {
      // Only hide if we're actually leaving the editor
      const editorElement = editor.getRootElement()
      if (editorElement && !editorElement.contains(e.relatedTarget as Node)) {
        hideDragIndicator()
      }
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      hideDragIndicator()

      const placeholderData = e.dataTransfer?.getData('text/placeholder')
      const nodeKey = e.dataTransfer?.getData('text/node-key')
      const indexData = e.dataTransfer?.getData('text/index')

      if (!placeholderData || !nodeKey || !indexData) return

      const placeholder = JSON.parse(placeholderData) as NormalizedPlaceholder
      const index = parseInt(indexData, 10)

      editor.update(() => {
        // Remove the old node first (temporarily allow placeholder removal)
        const oldNode = $getNodeByKey(nodeKey)
        if (oldNode) {
          setAllowPlaceholderRemoval(true)
          oldNode.remove()
          setAllowPlaceholderRemoval(false)
        }

        // Get editor element
        const editorElement = editor.getRootElement()
        if (!editorElement) return

        // Try to use the browser's built-in coordinate-to-position API
        let targetNode: Node | null = null
        let targetOffset = 0

        if (document.caretRangeFromPoint) {
          const range = document.caretRangeFromPoint(e.clientX, e.clientY)
          if (range) {
            targetNode = range.startContainer
            targetOffset = range.startOffset
          }
        } else if ((document as any).caretPositionFromPoint) {
          const caretPos = (document as any).caretPositionFromPoint(e.clientX, e.clientY)
          if (caretPos) {
            targetNode = caretPos.offsetNode
            targetOffset = caretPos.offset
          }
        }

        // Find the target paragraph based on the drop coordinates
        const root = $getRoot()
        const paragraphs = root.getChildren()

        let targetParagraph: LexicalNode | null = null

        // Find which paragraph contains the drop point
        for (const para of paragraphs) {
          if (!$isElementNode(para)) continue
          const paraElement = editor.getElementByKey(para.getKey())
          if (paraElement) {
            const rect = paraElement.getBoundingClientRect()
            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
              targetParagraph = para
              break
            }
          }
        }

        // If no paragraph found, use the first one or last one based on Y position
        if (!targetParagraph && paragraphs.length > 0) {
          const firstPara = paragraphs[0]
          const lastPara = paragraphs[paragraphs.length - 1]
          if ($isElementNode(firstPara) && $isElementNode(lastPara)) {
            const firstRect = editor.getElementByKey(firstPara.getKey())?.getBoundingClientRect()
            const lastRect = editor.getElementByKey(lastPara.getKey())?.getBoundingClientRect()
            if (firstRect && lastRect) {
              targetParagraph = e.clientY < firstRect.top ? firstPara : lastPara
            }
          }
        }

        if (!targetParagraph || !$isElementNode(targetParagraph)) return

        const newPlaceholderNode = $createPlaceholderNode(placeholder, index)
        let cursorPlacementNode: LexicalNode | null = null
        let cursorOffset = 0
        let cursorType: 'text' | 'element' = 'element'
        let placeholderInserted = false

        if (targetNode && targetNode.nodeType === Node.TEXT_NODE) {
          // Find the corresponding Lexical text node
          const children = targetParagraph.getChildren()

          for (let i = 0; i < children.length; i++) {
            const child = children[i]
            if (child instanceof TextNode) {
              const domNode = editor.getElementByKey(child.getKey())
              if (domNode && (domNode.firstChild === targetNode || domNode === targetNode.parentNode)) {
                // Split the text node at the target offset
                if (targetOffset === 0) {
                  // Insert before this text node
                  child.insertBefore(newPlaceholderNode)
                  // Position cursor after the placeholder
                  cursorPlacementNode = child
                  cursorOffset = 0
                  cursorType = 'text'
                  placeholderInserted = true
                } else if (targetOffset >= child.getTextContent().length) {
                  // Insert after this text node
                  child.insertAfter(newPlaceholderNode)
                  // Check if there's a next sibling after the placeholder
                  const afterPlaceholder = newPlaceholderNode.getNextSibling()
                  if (afterPlaceholder instanceof TextNode) {
                    cursorPlacementNode = afterPlaceholder
                    cursorOffset = 0
                    cursorType = 'text'
                  } else {
                    // Position cursor after placeholder
                    const parent = newPlaceholderNode.getParent()
                    if (parent && $isElementNode(parent)) {
                      const siblings = parent.getChildren()
                      const phIndex = siblings.indexOf(newPlaceholderNode)
                      cursorPlacementNode = parent
                      cursorOffset = phIndex + 1
                      cursorType = 'element'
                    }
                  }
                  placeholderInserted = true
                } else {
                  // Split the text node
                  const textContent = child.getTextContent()
                  const beforeText = textContent.substring(0, targetOffset)
                  const afterText = textContent.substring(targetOffset)

                  if (!beforeText && !afterText) {
                    // Entire text node is empty, replace it with placeholder
                    child.insertBefore(newPlaceholderNode)
                    child.remove()
                    // Position cursor after placeholder
                    const parent = newPlaceholderNode.getParent()
                    if (parent && $isElementNode(parent)) {
                      const siblings = parent.getChildren()
                      const phIndex = siblings.indexOf(newPlaceholderNode)
                      cursorPlacementNode = parent
                      cursorOffset = phIndex + 1
                      cursorType = 'element'
                    }
                  } else if (!beforeText && afterText) {
                    // No text before drop point, keep the afterText in the node
                    child.setTextContent(afterText)
                    child.insertBefore(newPlaceholderNode)
                    // Position cursor at start of text
                    cursorPlacementNode = child
                    cursorOffset = 0
                    cursorType = 'text'
                  } else if (beforeText && !afterText) {
                    // No text after drop point
                    child.setTextContent(beforeText)
                    child.insertAfter(newPlaceholderNode)
                    // Position cursor after placeholder
                    const parent = newPlaceholderNode.getParent()
                    if (parent && $isElementNode(parent)) {
                      const siblings = parent.getChildren()
                      const phIndex = siblings.indexOf(newPlaceholderNode)
                      cursorPlacementNode = parent
                      cursorOffset = phIndex + 1
                      cursorType = 'element'
                    }
                  } else {
                    // Both beforeText and afterText exist - need to split
                    child.setTextContent(beforeText)
                    child.insertAfter(newPlaceholderNode)
                    const afterTextNode = $createTextNode(afterText)
                    newPlaceholderNode.insertAfter(afterTextNode)
                    // Position cursor at start of after text
                    cursorPlacementNode = afterTextNode
                    cursorOffset = 0
                    cursorType = 'text'
                  }
                  placeholderInserted = true
                }
                break
              }
            }
          }
        }

        // Fallback: find insertion point based on coordinates (only if not already inserted)
        if (!placeholderInserted) {
          const children = targetParagraph.getChildren()
          const dropX = e.clientX

          let insertIndex = children.length // Default to end

          for (let i = 0; i < children.length; i++) {
            const child = children[i]
            const childElement = editor.getElementByKey(child.getKey())

            if (childElement) {
              const rect = childElement.getBoundingClientRect()
              const midPoint = rect.left + rect.width / 2

              if (dropX < midPoint) {
                insertIndex = i
                break
              }
            }
          }

          // Insert at the determined position
          if (insertIndex >= children.length) {
            targetParagraph.append(newPlaceholderNode)
            // Position cursor after the placeholder (at end of paragraph)
            cursorPlacementNode = targetParagraph
            cursorOffset = targetParagraph.getChildren().length
            cursorType = 'element'
          } else {
            const nodeAtIndex = children[insertIndex]
            nodeAtIndex.insertBefore(newPlaceholderNode)

            // Position cursor after the placeholder
            if (nodeAtIndex instanceof TextNode) {
              cursorPlacementNode = nodeAtIndex
              cursorOffset = 0
              cursorType = 'text'
            } else {
              // Use element-level positioning - get fresh children list
              const updatedChildren = targetParagraph.getChildren()
              const newIndex = updatedChildren.indexOf(newPlaceholderNode)
              if (newIndex >= 0) {
                cursorPlacementNode = targetParagraph
                cursorOffset = newIndex + 1
                cursorType = 'element'
              }
            }
          }
        }

        // Set cursor position after drop
        if (cursorPlacementNode) {
          try {
            const newSelection = $createRangeSelection()
            newSelection.anchor.set(cursorPlacementNode.getKey(), cursorOffset, cursorType)
            newSelection.focus.set(cursorPlacementNode.getKey(), cursorOffset, cursorType)
            $setSelection(newSelection)
          } catch (error) {
            console.debug('Could not set cursor after drop:', error)
          }
        }

      }, { tag: 'drop-placeholder' })
    }

    const editorElement = editor.getRootElement()
    if (editorElement) {
      editorElement.addEventListener('dragover', handleDragOver)
      editorElement.addEventListener('dragleave', handleDragLeave)
      editorElement.addEventListener('drop', handleDrop)

      return () => {
        editorElement.removeEventListener('dragover', handleDragOver)
        editorElement.removeEventListener('dragleave', handleDragLeave)
        editorElement.removeEventListener('drop', handleDrop)
        removeDragIndicator()
      }
    }
  }, [editor, sourceContent])

  return null
}
