import { promises as fs } from 'fs'

const API_URL = 'https://api2.order.mi.com/search/index'

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

async function fetchSearch(keyword: string): Promise<XiaomiSearchResponse> {
  const params = new URLSearchParams({
    query: keyword,
    page_index: '1',
    page_size: '10',
    filter_tag: '0',
    main_sort: '0',
    jsonpcallback: '__mi_search',
  })

  const resp = await fetch(`${API_URL}?${params}`, {
    headers: {
      referer: `https://www.mi.com/shop/search?keyword=${encodeURIComponent(keyword)}`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    },
  })

  return stripJsonp(await resp.text())
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface ImageResult {
  keyword: string
  productId: string
  name: string
  imageUrl: string
}

// 要搜索的红米机型关键词
const SEARCH_KEYWORDS = [
  // K 系列
  'Redmi K80 Pro',
  'Redmi K80',
  'Redmi K70 Pro',
  'Redmi K70',
  'Redmi K70E',
  'Redmi K70 Ultra',
  'Redmi K60 Pro',
  'Redmi K60',
  'Redmi K60 Ultra',
  'Redmi K50 Pro',
  'Redmi K50',
  'Redmi K50 Ultra',
  'Redmi K40 Pro',
  'Redmi K40',
  'Redmi K40S',
  'Redmi K30 Pro',
  'Redmi K30S',
  'Redmi K20 Pro',
  'Redmi K20',
  // Turbo 系列
  'Redmi Turbo 4 Pro',
  'Redmi Turbo 4',
  'Redmi Turbo 3',
  // Note 系列
  'Redmi Note 14 Pro+',
  'Redmi Note 14 Pro',
  'Redmi Note 14',
  'Redmi Note 13 Pro+',
  'Redmi Note 13 Pro',
  'Redmi Note 13',
  'Redmi Note 12 Pro+',
  'Redmi Note 12 Pro',
  'Redmi Note 12',
  'Redmi Note 11 Pro',
  'Redmi Note 11',
  'Redmi Note 10 Pro',
  'Redmi Note 9 Pro',
  'Redmi Note 8 Pro',
  'Redmi Note 7 Pro',
  // 数字系列
  'Redmi 14C',
  'Redmi 14R',
  'Redmi 13C',
  'Redmi 12C',
  'Redmi 12',
  'Redmi 11',
  'Redmi 10',
  'Redmi 9',
  'Redmi 8',
  'Redmi 7',
  'Redmi 6',
  'Redmi 5',
  'Redmi 4',
  'Redmi 3',
  'Redmi 2',
  'Redmi 1',
]

async function main() {
  const results: ImageResult[] = []

  for (const kw of SEARCH_KEYWORDS) {
    console.log(`Searching: ${kw}`)
    try {
      const resp = await fetchSearch(kw)
      if (resp.code !== 200 || !resp.data?.pc_list?.length) {
        console.log(`  No results (code: ${resp.code})`)
        // 也试试中文搜索
        const cnKw = kw.replace('Redmi ', '红米 ')
        console.log(`  Trying: ${cnKw}`)
        const cnResp = await fetchSearch(cnKw)
        if (cnResp.code === 200 && cnResp.data?.pc_list?.length) {
          for (const product of cnResp.data.pc_list) {
            const first = product.commodity_list?.[0]
            if (!first) continue
            const imageUrl = first.image || first.icon || ''
            if (!imageUrl) continue
            results.push({
              keyword: cnKw,
              productId: product.product_id,
              name: first.name,
              imageUrl,
            })
            console.log(`  ${first.name} → ${imageUrl}`)
          }
        }
        await delay(800)
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

    await delay(800)
  }

  await fs.mkdir('data/output/mi', { recursive: true })
  await fs.writeFile('data/output/mi/redmi-images.json', JSON.stringify(results, null, 2))
  console.log(`\nTotal: ${results.length} products with images saved to data/output/mi/redmi-images.json`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
