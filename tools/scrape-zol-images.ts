import axios from 'axios'
import { load } from 'cheerio'
import { promises as fs } from 'fs'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function decodeHtml(bytes: ArrayBuffer): string {
  const data = new Uint8Array(bytes)
  const head = Buffer.from(data).toString('latin1')
  const charset = head.match(/charset\s*=\s*['"]?([a-zA-Z0-9_-]+)/i)?.[1]?.toLowerCase()
  if (charset?.includes('gbk') || charset?.includes('gb2312') || charset?.includes('gb18030')) {
    return new TextDecoder('gb18030').decode(data)
  }
  return new TextDecoder('utf-8').decode(data)
}

async function fetchHtml(url: string): Promise<string> {
  const resp = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    timeout: 20000,
  })
  return decodeHtml(resp.data)
}

// 尝试通过 ZOL 搜索页找到机型参数页 URL
async function findZolParamUrl(modelName: string): Promise<string | null> {
  const zolName = modelName
    .replace('Xiaomi MIX Fold', '小米MIX FOLD')
    .replace('Xiaomi MIX Flip', '小米MIX Flip')
    .replace('Xiaomi MIX 4', '小米MIX 4')
    .replace('Xiaomi MIX 3', '小米MIX 3')
    .replace('Xiaomi MIX 2S', '小米MIX 2S')
    .replace('Xiaomi MIX 2', '小米MIX 2')
    .replace('Xiaomi MIX', '小米MIX')
    .replace('Xiaomi Civi 5 Pro', '小米Civi 5 Pro')
    .replace('Xiaomi Civi 4 Pro', '小米Civi 4 Pro')
    .replace('Xiaomi Civi 3', '小米Civi 3')
    .replace('Xiaomi Civi 2', '小米Civi 2')
    .replace('Xiaomi Civi 1S', '小米Civi 1S')
    .replace('Xiaomi Civi', '小米Civi')

  // 直接尝试 ZOL 搜索
  const searchUrl = `https://detail.zol.com.cn/cell_phone_index/subcate57_0_list_s${encodeURIComponent(zolName)}_1_0_1_0_0_0_1.html`
  try {
    const html = await fetchHtml(searchUrl)
    const $ = load(html)

    // 找第一个 param.shtml 链接
    let found: string | null = null
    $('a[href]').each((_, a) => {
      if (found) return
      const href = ($(a).attr('href') || '').trim()
      if (/\/\d+\/\d+\/param\.shtml/.test(href)) {
        found = href.startsWith('http') ? `https:${href}` : `https://detail.zol.com.cn${href}`
      }
    })
    return found
  } catch {
    return null
  }
}

// 从 ZOL 参数页提取产品图 URL
async function extractImageFromParamPage(url: string): Promise<string | null> {
  try {
    const html = await fetchHtml(url)
    const $ = load(html)

    // ZOL 产品图通常在以下位置：
    // 1. .pic-box img
    // 2. .product-pic img
    // 3. #pro-intro img
    // 4. meta og:image
    const ogImage = $('meta[property="og:image"]').attr('content')
    if (ogImage) return ogImage.startsWith('http') ? ogImage : `https:${ogImage}`

    // 找主要产品图
    const selectors = ['.pic-box img', '.product-pic img', '#pro-intro img', '.goods-card img', '.pro-intro img']
    for (const sel of selectors) {
      const src = $(sel).first().attr('src') || $(sel).first().attr('data-src')
      if (src) return src.startsWith('http') ? src : `https:${src}`
    }

    // 兜底：找最大的 img
    let bestSrc: string | null = null
    let bestSize = 0
    $('img[src]').each((_, img) => {
      const src = $(img).attr('src') || ''
      if (!src.includes('zol') && !src.includes('cnbj1')) return
      if (src.includes('icon') || src.includes('logo') || src.includes('ad')) return
      const w = Number($(img).attr('width')) || 0
      const h = Number($(img).attr('height')) || 0
      const size = w * h
      if (size > bestSize || (!bestSrc && src.includes('.jpg') || src.includes('.png'))) {
        bestSize = size
        bestSrc = src.startsWith('http') ? src : `https:${src}`
      }
    })

    return bestSrc
  } catch {
    return null
  }
}

// 需要图片的老机型
const MODELS_NEED_IMAGE = [
  { id: 'xiaomi-mix-fold2', name: 'Xiaomi MIX Fold 2' },
  { id: 'xiaomi-mix-fold', name: 'Xiaomi MIX Fold' },
  { id: 'xiaomi-mix4', name: 'Xiaomi MIX 4' },
  { id: 'xiaomi-mix3', name: 'Xiaomi MIX 3' },
  { id: 'xiaomi-mix2s', name: 'Xiaomi MIX 2S' },
  { id: 'xiaomi-mix2', name: 'Xiaomi MIX 2' },
  { id: 'xiaomi-mix', name: 'Xiaomi MIX' },
  { id: 'xiaomi-civi3', name: 'Xiaomi Civi 3' },
  { id: 'xiaomi-civi2', name: 'Xiaomi Civi 2' },
  { id: 'xiaomi-civi1s', name: 'Xiaomi Civi 1S' },
  { id: 'xiaomi-civi', name: 'Xiaomi Civi' },
]

async function main() {
  const results: Record<string, string> = {}

  for (const model of MODELS_NEED_IMAGE) {
    console.log(`\n── ${model.name} ──`)

    // Step 1: 找到 ZOL 参数页 URL
    const paramUrl = await findZolParamUrl(model.name)
    if (!paramUrl) {
      console.log('  param page not found')
      await delay(1000)
      continue
    }
    console.log(`  param: ${paramUrl}`)

    // Step 2: 提取产品图
    const imageUrl = await extractImageFromParamPage(paramUrl)
    if (imageUrl) {
      results[model.id] = imageUrl
      console.log(`  image: ${imageUrl}`)
    } else {
      console.log('  no image found')
    }

    await delay(1500)
  }

  await fs.writeFile('data/output/zol/mix-civi-images.json', JSON.stringify(results, null, 2))
  console.log(`\ndone: ${Object.keys(results).length} images found`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
