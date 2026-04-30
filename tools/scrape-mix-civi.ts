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

function clean(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/纠错/g, '')
    .replace(/更多.*?手机[，,、]?手机性能排行/g, '')
    .replace(/更多.*?手机/g, '')
    .replace(/[>＞]\s*/g, '')
    .replace(/\s+查看外观.*/g, '')
    .trim()
}

async function fetchHtml(url: string): Promise<string> {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    timeout: 20000,
  })
  return decodeHtml(response.data)
}

type ZolSpec = Record<string, string>

async function scrapeParamPage(url: string): Promise<{ title: string; spec: ZolSpec }> {
  const html = await fetchHtml(url)
  const $ = load(html)
  const title = clean($('h1').first().text()) || clean($('title').first().text())
  const spec: ZolSpec = { sourceUrl: url }

  const add = (key: string, value: string) => {
    const k = clean(key).replace(/[:：]$/, '')
    const v = clean(value)
    if (!k || !v || k.length > 40) return
    if (!spec[k] || spec[k].length < v.length) spec[k] = v
  }

  $('table tr').each((_, tr) => {
    const cells = $(tr).find('th,td')
    if (cells.length < 2) return
    add($(cells[0]).text(), $(cells[1]).text())
  })

  $('li').each((_, li) => {
    const item = $(li)
    const key = item.find('.param-name, .tit, .title, .hd, dt').first().text() || item.children().first().text()
    const value = item.find('.param-value, .des, .desc, .bd, dd').first().text() || item.children().eq(1).text()
    add(key, value)
  })

  $('dl').each((_, dl) => {
    add($(dl).find('dt').first().text(), $(dl).find('dd').first().text())
  })

  return { title, spec }
}

// ZOL 搜索 URL 格式: 用百度搜索来找 ZOL 参数页
async function searchViaBaidu(keyword: string): Promise<string | null> {
  const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(keyword + ' site:detail.zol.com.cn param.shtml')}`
  try {
    const html = await fetchHtml(searchUrl)
    // 从百度搜索结果中提取 ZOL param.shtml URL
    const match = html.match(/https?:\/\/detail\.zol\.com\.cn\/\d+\/\d+\/param\.shtml/)
    return match ? match[0] : null
  } catch {
    return null
  }
}

// 已知可用的 ZOL 参数页 URL
// 从现有项目数据和手动搜索获取
const KNOWN_URLS: Record<string, string> = {
  // 从现有 ZOL 数据确认
  'Xiaomi MIX Fold 4': 'https://detail.zol.com.cn/2087/2086684/param.shtml',
  // 从 enrich-mi-digital.ts 中确认
  'Xiaomi MIX Fold 3': 'https://detail.zol.com.cn/1554/1553913/param.shtml',
  // 从 urls.json 中确认
  'Xiaomi MIX Fold 2': 'https://detail.zol.com.cn/1354/1353680/param.shtml',
}

const TARGET_MODELS = [
  'Xiaomi MIX Fold 4',
  'Xiaomi MIX Fold 3',
  'Xiaomi MIX Fold 2',
  'Xiaomi MIX Fold',
  'Xiaomi MIX Flip',
  'Xiaomi MIX 4',
  'Xiaomi MIX 3',
  'Xiaomi MIX 2S',
  'Xiaomi MIX 2',
  'Xiaomi MIX',
  'Xiaomi Civi 5 Pro',
  'Xiaomi Civi 4 Pro',
  'Xiaomi Civi 3',
  'Xiaomi Civi 2',
  'Xiaomi Civi 1S',
  'Xiaomi Civi',
]

async function main() {
  const results: Record<string, { title: string; spec: ZolSpec }> = {}

  for (const model of TARGET_MODELS) {
    console.log(`\n── ${model} ──`)

    let url = KNOWN_URLS[model]
    if (!url) {
      // 通过百度搜索 ZOL 参数页
      const zolName = model.replace('Xiaomi ', '小米')
      console.log(`  searching: ${zolName} 参数 site:detail.zol.com.cn`)
      url = await searchViaBaidu(zolName + ' 参数') || undefined
      if (url) {
        console.log(`  found: ${url}`)
      } else {
        console.log(`  not found via search`)
      }
      await delay(2000)
    }

    if (url) {
      try {
        const { title, spec } = await scrapeParamPage(url)
        results[model] = { title, spec }
        console.log(`  scraped: ${title} (${Object.keys(spec).length} fields)`)
      } catch (e) {
        console.warn(`  scrape failed:`, (e as Error).message)
      }
    } else {
      console.log(`  skipped: no URL`)
    }

    await delay(1500)
  }

  await fs.mkdir('data/output/zol', { recursive: true })
  await fs.writeFile('data/output/zol/mix-civi-specs.json', JSON.stringify(results, null, 2))
  console.log(`\ndone: ${Object.keys(results).length} models scraped`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
