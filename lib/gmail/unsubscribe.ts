export async function extractUnsubscribeLinks(html?: string | null): Promise<string[]> {
  if (!html) return []
  const links: string[] = []
  const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    const href = match[1]
    const text = (match[2] || '').toLowerCase()
    if (text.includes('unsubscribe') || href.toLowerCase().includes('unsubscribe')) {
      links.push(href)
    }
  }
  return links
}

