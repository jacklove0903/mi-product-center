import { promises as fs } from 'fs'

const API_URL = 'https://api2.order.mi.com/search/index'
const SOURCE_URL = 'https://www.mi.com/shop/search'

interface XiaomiSearchResponse {
  code: number
  msg: string
  data?: {
    total?: number
    pc_list?: XiaomiProduct[]
  }
}

interface XiaomiProduct {
  product_id: string
  commodity_list?: XiaomiCommodity[]
}

interface XiaomiCommodity {
  name: string
  image?: string
  icon?: string
}

function stripJsonp(text: string): XiaomiSearchResponse {
  const match = text.match(/^[^(]+\(([\s\S]*)\);?$/)
  if (!match) throw new Error('JSONP wrapper not found')
  return JSON.parse(match[1])
}

async function fetchSearch(keyword: string, pageIndex = 1, pageSize = 20): Promise<XiaomiSearchResponse> {
  const params = new URLSearchParams({
    query: keyword,
    page_index: String(pageIndex),
    page_size: String(pageSize),
    filter_tag: '0',
    main_sort: '0',
    jsonpcallback: '__mi_search',
  })

  const resp = await fetch(`${API_URL}?${params}`, {
    headers: {
      referer: `${SOURCE_URL}?keyword=${encodeURIComponent(keyword)}`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    },
  })

  return stripJsonp(await resp.text())
}

interface ImageResult {
  keyword: string
  productId: string
  name: string
  imageUrl: string
}

async function main() {
  const keywords = ['MIX Fold', 'MIX Flip', 'MIX 4', 'MIX 3', 'Civi']
  const results: ImageResult[] = []

  for (const kw of keywords) {
    console.log(`\nSearching: ${kw}`)
    try {
      const resp = await fetchSearch(`xiaomi ${kw}`)
      if (resp.code !== 200 || !resp.data?.pc_list) {
        console.log(`  No results (code: ${resp.code})`)
        continue
      }

      for (const product of resp.data.pc_list) {
        const first = product.commodity_list?.[0]
        if (!first) continue
        const imageUrl = first.image || first.icon || ''
        if (!imageUrl) continue

        results.push({
          keyword: kw,
          productId: product.product_id,
          name: first.name,
          imageUrl,
        })
        console.log(`  ${first.name} → ${imageUrl}`)
      }
    } catch (e) {
      console.warn(`  Failed: ${(e as Error).message}`)
    }
  }

  // 保存结果
  await fs.writeFile('data/output/mi/mix-civi-images.json', JSON.stringify(results, null, 2))
  console.log(`\nTotal: ${results.length} products with images`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
