export interface ExtractedLink {
  text: string
  href: string
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function extractLinks(html: string): ExtractedLink[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const anchors = Array.from(doc.querySelectorAll('a[href]'))

  const seenHrefs = new Set<string>()
  const links: ExtractedLink[] = []
  anchors.forEach((anchor) => {
    const href = anchor.getAttribute('href') ?? ''
    if (!/^https?:\/\//.test(href)) return
    const text = collapseSpaces(anchor.textContent ?? '')
    if (text === '') return
    if (seenHrefs.has(href)) return
    seenHrefs.add(href)
    links.push({ text, href })
  })

  return links
}

function isLinkMatch(itemName: string, linkText: string): boolean {
  if (itemName === linkText) return true
  const shorter = itemName.length <= linkText.length ? itemName : linkText
  const longer = itemName.length <= linkText.length ? linkText : itemName
  return shorter.length >= 8 && longer.includes(shorter)
}

export function matchLinkUrl(itemName: string, links: ExtractedLink[]): string | undefined {
  const normalizedName = collapseSpaces(itemName)
  const candidates = links.filter((link) => isLinkMatch(normalizedName, link.text))
  if (candidates.length === 0) return undefined
  candidates.sort((a, b) => b.text.length - a.text.length)
  return candidates[0].href
}
