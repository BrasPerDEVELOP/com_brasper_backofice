const allowed = new Set('P BR STRONG B EM I U UL OL LI H2 H3 BLOCKQUOTE PRE CODE DIV'.split(' '))

/** Rebuild formatting only; never copy attributes or executable elements. */
export function safeNoticeHtml(value: string): string {
  const source = new DOMParser().parseFromString(value, 'text/html')
  const target = document.createElement('div')
  function copy(node: Node, parent: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(node.textContent ?? ''))
    } else if (node instanceof Element) {
      const container = allowed.has(node.tagName) ? document.createElement(node.tagName) : parent
      if (container !== parent) parent.appendChild(container)
      for (const child of node.childNodes) copy(child, container)
    }
  }
  for (const child of source.body.childNodes) copy(child, target)
  return target.innerHTML
}
