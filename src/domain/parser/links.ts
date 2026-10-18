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

const DEVICEMART_PRODUCT_LINK = /\/goods\/(view|catalog)(?:[/?]|$)/

/**
 * 디바이스마트 장바구니/주문서 화면은 품목명 링크에 항상 `class="order_name"`을 쓰고
 * href가 상품 상세(`/goods/view`, `/goods/catalog`)를 가리킨다. 이 순서가 품목이 나열된
 * 순서와 같아서, 텍스트 유사도 매칭(matchLinkUrl)보다 훨씬 안정적으로 품목별 링크를 뽑을 수 있다.
 */
export function extractDevicemartItemLinks(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const anchors = Array.from(doc.querySelectorAll('a.order_name[href]'))

  const hrefs: string[] = []
  anchors.forEach((anchor) => {
    const href = anchor.getAttribute('href') ?? ''
    if (!/^https?:\/\//.test(href)) return
    if (!DEVICEMART_PRODUCT_LINK.test(href)) return
    hrefs.push(href)
  })

  return hrefs
}
