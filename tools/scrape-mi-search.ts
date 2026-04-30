import { promises as fs } from 'fs'

const SOURCE_URL =
  'https://www.mi.com/shop/search?keyword=xiaomi%E6%95%B0%E5%AD%97%E7%B3%BB%E5%88%97'
const API_URL = 'https://api2.order.mi.com/search/index'
const KEYWORD = 'xiaomi数字系列'
const OUT_DIR = 'data/output/mi'

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
  class_sort?: number
  commodity_list?: XiaomiCommodity[]
}

interface XiaomiCommodity {
  name: string
  desc?: string
  image?: string
  icon?: string
  price?: string
  market_price?: string
  commodity_id?: number
  product_id?: number
}

interface OutputModel {
  sourceSeries: string
  modelName: string
  productId: string
  priceText: string
  buyUrl: string
  detailUrl: string
  imageUrl: string
  description: string
  variants: Array<{
    name: string
    commodityId: number | null
    priceText: string
    imageUrl: string
  }>
}

function stripJsonp(text: string): XiaomiSearchResponse {
  const match = text.match(/^[^(]+\(([\s\S]*)\);?$/)
  if (!match) {
    throw new Error('Unexpected response format: JSONP wrapper not found')
  }
  return JSON.parse(match[1]) as XiaomiSearchResponse
}

function inferModelName(commodityName: string): string {
  return commodityName
    .replace(/\s+\d+GB\+\d+(?:GB|TB).*$/i, '')
    .replace(/\s+双卫星版.*$/i, ' 双卫星版')
    .replace(/\s+钛金属特别版.*$/i, ' 钛金属特别版')
    .replace(/\s+限量定制版.*$/i, ' 限量定制版')
    .trim()
}

function normalizePrice(price?: string): string {
  return price ? `${price}元` : ''
}

async function fetchSearchPage(pageIndex: number, pageSize: number): Promise<XiaomiSearchResponse> {
  const params = new URLSearchParams({
    query: KEYWORD,
    page_index: String(pageIndex),
    page_size: String(pageSize),
    filter_tag: '0',
    main_sort: '0',
    province_id: '',
    city_id: '',
    jsonpcallback: '__mi_search',
  })

  const response = await fetch(`${API_URL}?${params}`, {
    headers: {
      referer: SOURCE_URL,
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    },
  })

  if (!response.ok) {
    throw new Error(`Search API failed: ${response.status} ${response.statusText}`)
  }

  return stripJsonp(await response.text())
}

function toOutputModel(product: XiaomiProduct): OutputModel | null {
  const variants = product.commodity_list || []
  const first = variants[0]
  if (!first) return null

  const prices = variants.map((variant) => Number(variant.price)).filter(Number.isFinite)
  const minPrice = prices.length ? `${Math.min(...prices)}元起` : ''
  const modelName = inferModelName(first.name)
  const imageUrl = first.image || first.icon || ''

  return {
    sourceSeries: 'Xiaomi 数字旗舰',
    modelName,
    productId: product.product_id,
    priceText: minPrice,
    buyUrl: `https://www.mi.com/shop/buy?product_id=${product.product_id}`,
    detailUrl: `https://www.mi.com/shop/buy/detail?product_id=${product.product_id}`,
    imageUrl,
    description: first.desc || '',
    variants: variants.map((variant) => ({
      name: variant.name,
      commodityId: variant.commodity_id ?? null,
      priceText: normalizePrice(variant.price),
      imageUrl: variant.image || variant.icon || imageUrl,
    })),
  }
}

function toCsv(models: OutputModel[]): string {
  const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  const rows = [
    ['modelName', 'productId', 'priceText', 'variantCount', 'buyUrl'],
    ...models.map((model) => [
      model.modelName,
      model.productId,
      model.priceText,
      model.variants.length,
      model.buyUrl,
    ]),
  ]
  return rows.map((row) => row.map(quote).join(',')).join('\n')
}

async function main() {
  const firstPage = await fetchSearchPage(1, 20)
  if (firstPage.code !== 200 || !firstPage.data) {
    throw new Error(`Search API returned ${firstPage.code}: ${firstPage.msg}`)
  }

  const total = firstPage.data.total || 0
  const models = (firstPage.data.pc_list || [])
    .map(toOutputModel)
    .filter((model): model is OutputModel => Boolean(model))

  await fs.mkdir(OUT_DIR, { recursive: true })
  await fs.writeFile(
    `${OUT_DIR}/xiaomi-digital-series-models.json`,
    JSON.stringify(
      {
        sourceUrl: SOURCE_URL,
        apiUrl: API_URL,
        keyword: KEYWORD,
        fetchedAt: new Date().toISOString(),
        sourceSeries: 'Xiaomi 数字旗舰',
        totalFromApi: total,
        modelCount: models.length,
        skuCount: models.reduce((count, model) => count + model.variants.length, 0),
        models,
      },
      null,
      2,
    ),
  )
  await fs.writeFile(`${OUT_DIR}/xiaomi-digital-series-models.csv`, toCsv(models))

  console.log(`done: ${models.length} models, ${models.reduce((count, model) => count + model.variants.length, 0)} SKUs`)
  console.log(`${OUT_DIR}/xiaomi-digital-series-models.json`)
  console.log(`${OUT_DIR}/xiaomi-digital-series-models.csv`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
