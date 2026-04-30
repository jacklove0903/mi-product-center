import axios from 'axios'
import { load } from 'cheerio'
import { promises as fs } from 'fs'
import path from 'path'

interface VariantSpec {
  name: string
  url: string
  [key: string]: string
}

interface ModelData {
  model: string
  series: string
  paramUrl: string
  specs: VariantSpec
  variants: { name: string; url: string }[]
}

interface SeriesTree {
  series: string
  models: ModelData[]
}

const SEED_LIST_PAGES = ['https://detail.zol.com.cn/cell_phone_index/subcate57_34645_list_1.html']
const PAGE_LIMIT = 40
const REQUEST_DELAY_MS = 800

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function decodeHtmlFromBytes(bytes: Uint8Array): string {
  const asciiHead = Buffer.from(bytes).toString('latin1')
  const charsetMatch = asciiHead.match(/charset\s*=\s*['\"]?([a-zA-Z0-9_-]+)/i)
  const charset = (charsetMatch?.[1] || 'utf-8').toLowerCase()

  if (charset.includes('gbk') || charset.includes('gb2312') || charset.includes('gb18030')) {
    return new TextDecoder('gb18030').decode(bytes)
  }

  return new TextDecoder('utf-8').decode(bytes)
}

async function fetchHtml(url: string): Promise<string> {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    timeout: 20000,
  })
  return decodeHtmlFromBytes(new Uint8Array(response.data))
}

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/纠错/g, '')
    .replace(/[>＞]\s*$/g, '')
    .replace(/，\s*，/g, '，')
    .trim()
}

function classifySeries(name: string): string {
  if (/MIX\s*(FOLD|FLIP|Fold|Flip)/i.test(name)) return '小米MIX系列'
  if (/MIX/i.test(name)) return '小米MIX系列'
  if (/Civi/i.test(name)) return '小米Civi系列'
  if (/Redmi|红米/i.test(name)) return 'Redmi系列'
  if (/小米\d+/i.test(name)) return '小米数字系列'
  return '小米其他系列'
}

function extractModelName(fullName: string): string {
  // "小米11（12GB/256GB/全网通/5G版）" → "小米11"
  // "小米14 Ultra(12GB/256GB)" → "小米14 Ultra"
  // "小米MIX 4（12GB/256GB/全网通/5G版）" → "小米MIX 4"
  // "小米11青春版（8GB/128GB）" → "小米11青春版"
  // "小米10S（8GB/128GB）" → "小米10S"
  // "小米15S Pro（16GB/512GB）" → "小米15S Pro"
  const m = fullName.match(/^(.+?)[（(]/)
  if (m) return m[1].trim()
  // 没有括号的情况，尝试去掉尾部 RAM/ROM 描述
  const m2 = fullName.match(/^(.+?)(?:\d+GB|\d+TB)/i)
  if (m2) return m2[1].replace(/[\s/]+$/, '').trim()
  return fullName.trim()
}

function buildParamUrlFromIndexUrl(indexUrl: string): string | null {
  const match = indexUrl.match(/index(\d+)\.shtml/i)
  if (!match) return null
  const id = Number(match[1])
  if (!Number.isFinite(id) || id <= 0) return null
  const prefix = Math.ceil(id / 1000)
  return `https://detail.zol.com.cn/${prefix}/${id}/param.shtml`
}

interface IndexEntry {
  name: string
  indexUrl: string
}

function extractIndexEntries(listHtml: string): IndexEntry[] {
  const $ = load(listHtml)
  const seen = new Set<string>()
  const entries: IndexEntry[] = []

  $('a[href]').each((_, a) => {
    const href = ($(a).attr('href') || '').trim()
    if (!href) return
    if (!/detail\.zol\.com\.cn\/cell_phone\/index\d+\.shtml/i.test(href)) return
    const fullUrl = href.startsWith('http') ? href : `https:${href}`
    if (seen.has(fullUrl)) return
    seen.add(fullUrl)
    const name = normalizeText($(a).text())
    if (name) entries.push({ name, indexUrl: fullUrl })
  })

  return entries
}

function findMaxPage(listHtml: string, seedUrl: string): number {
  const escaped = seedUrl
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/_1\.html$/, '_(\\d+)\\.html')
  const regex = new RegExp(escaped, 'g')

  let max = 1
  let match: RegExpExecArray | null
  while ((match = regex.exec(listHtml)) !== null) {
    const page = Number(match[1])
    if (Number.isFinite(page)) max = Math.max(max, page)
  }

  return Math.min(max, PAGE_LIMIT)
}

async function discoverIndexEntries(seedListUrl: string): Promise<IndexEntry[]> {
  const page1 = await fetchHtml(seedListUrl)
  const maxPage = findMaxPage(page1, seedListUrl)
  const template = seedListUrl.replace(/_\d+\.html$/i, '_{page}.html')
  const allEntries: IndexEntry[] = []
  const seenUrls = new Set<string>()

  for (let page = 1; page <= maxPage; page += 1) {
    const listUrl = template.replace('{page}', String(page))
    console.log(`listing ${page}/${maxPage}:`, listUrl)

    try {
      const html = page === 1 ? page1 : await fetchHtml(listUrl)
      const entries = extractIndexEntries(html)
      for (const e of entries) {
        if (!seenUrls.has(e.indexUrl)) {
          seenUrls.add(e.indexUrl)
          allEntries.push(e)
        }
      }
    } catch (err) {
      console.warn('list page failed:', listUrl, err)
    }

    await delay(REQUEST_DELAY_MS)
  }

  return allEntries
}

async function scrapeParamPage(url: string): Promise<{ specs: VariantSpec; variants: { name: string; url: string }[] }> {
  const html = await fetchHtml(url)
  const $ = load(html)

  const name =
    normalizeText($('h1').first().text().replace(/参数$/, '')) ||
    normalizeText($('h2, .title').first().text()) ||
    url.split('/').slice(-2, -1)[0]

  const specs: VariantSpec = { name, url }

  const addPair = (rawKey: string, rawVal: string) => {
    const key = normalizeText(rawKey).replace(/[:：]$/, '')
    const val = normalizeText(rawVal)
    if (!key || !val || key.length > 60) return
    if (key === '参数纠错' || key === '进入官网') return
    specs[key] = val
  }

  $('table tr').each((_, tr) => {
    const $cells = $(tr).find('th, td')
    if ($cells.length < 2) return
    addPair($cells.eq(0).text(), $cells.eq(1).text())
  })

  $('li').each((_, li) => {
    const $li = $(li)
    const key =
      $li.find('.param-name, .tit, .title, .hd, dt').first().text() ||
      $li.children().first().text()
    const val =
      $li.find('.param-value, .des, .desc, .bd, dd').first().text() ||
      $li.children().eq(1).text()
    addPair(key, val)
  })

  $('dl').each((_, dl) => {
    const key = $(dl).find('dt').first().text()
    const val = $(dl).find('dd').first().text()
    addPair(key, val)
  })

  // 提取"同系列产品"区域的所有型号链接
  const variants: { name: string; url: string }[] = []
  const seenVariantUrls = new Set<string>()

  // ZOL 页面中同系列产品通常在特定区块
  $('[class*="same"], [class*="series"], [class*="tong"]').find('a[href]').each((_, a) => {
    const href = ($(a).attr('href') || '').trim()
    if (!/detail\.zol\.com\.cn\/cell_phone\/index\d+\.shtml/i.test(href)) return
    const fullUrl = href.startsWith('http') ? href : `https:${href}`
    if (seenVariantUrls.has(fullUrl)) return
    seenVariantUrls.add(fullUrl)
    const vName = normalizeText($(a).text())
    if (vName) variants.push({ name: vName, url: fullUrl })
  })

  // 兜底：如果上面没找到，尝试从页面所有链接中匹配同系列
  if (variants.length === 0) {
    $('a[href]').each((_, a) => {
      const href = ($(a).attr('href') || '').trim()
      if (!/detail\.zol\.com\.cn\/cell_phone\/index\d+\.shtml/i.test(href)) return
      const fullUrl = href.startsWith('http') ? href : `https:${href}`
      if (seenVariantUrls.has(fullUrl)) return
      const vName = normalizeText($(a).text())
      const modelName = extractModelName(name)
      // 只收录同机型的型号（名称以机型名开头）
      if (vName && vName.startsWith(modelName)) {
        seenVariantUrls.add(fullUrl)
        variants.push({ name: vName, url: fullUrl })
      }
    })
  }

  return { specs, variants }
}

async function main() {
  // ── 第1步：从列表页获取所有机型条目 ──
  const allEntries: IndexEntry[] = []
  for (const seed of SEED_LIST_PAGES) {
    const entries = await discoverIndexEntries(seed)
    allEntries.push(...entries)
  }
  console.log('total index entries:', allEntries.length)

  // ── 第2步：按机型名分组（去掉括号里的型号后缀） ──
  const modelMap = new Map<string, IndexEntry[]>()
  for (const entry of allEntries) {
    const modelName = extractModelName(entry.name)
    const list = modelMap.get(modelName) || []
    list.push(entry)
    modelMap.set(modelName, list)
  }
  console.log('unique models:', modelMap.size)

  // ── 第3步：每个机型只抓一个参数页，获取规格+同系列产品 ──
  const allModels: ModelData[] = []
  let scraped = 0

  for (const [modelName, entries] of modelMap.entries()) {
    // 取第一个条目的参数页
    const paramUrl = buildParamUrlFromIndexUrl(entries[0].indexUrl)
    if (!paramUrl) {
      console.warn('skip (no param url):', modelName)
      continue
    }

    scraped++
    console.log(`scraping [${scraped}/${modelMap.size}]:`, modelName, '←', paramUrl)

    try {
      const { specs, variants } = await scrapeParamPage(paramUrl)
      const series = classifySeries(modelName)

      // 把列表页发现的所有同机型条目也合并进 variants
      const allVariantUrls = new Set(variants.map((v) => v.url))
      for (const e of entries) {
        if (!allVariantUrls.has(e.indexUrl)) {
          variants.push({ name: e.name, url: e.indexUrl })
          allVariantUrls.add(e.indexUrl)
        }
      }

      allModels.push({
        model: modelName,
        series,
        paramUrl,
        specs,
        variants,
      })
    } catch (err) {
      console.warn('param page failed:', paramUrl, err)
    }

    await delay(REQUEST_DELAY_MS)
  }

  // ── 第4步：按系列分组，输出三级目录 ──
  const seriesMap = new Map<string, ModelData[]>()
  for (const m of allModels) {
    const list = seriesMap.get(m.series) || []
    list.push(m)
    seriesMap.set(m.series, list)
  }

  const outBase = path.join('data', 'output', 'zol')
  await fs.mkdir(outBase, { recursive: true })

  // 输出完整树状结构
  const tree: SeriesTree[] = []
  for (const [series, models] of seriesMap.entries()) {
    tree.push({ series, models })
  }
  await fs.writeFile(path.join(outBase, 'tree.json'), JSON.stringify(tree, null, 2))

  // 按系列输出独立文件
  const seriesDir = path.join(outBase, 'series')
  await fs.mkdir(seriesDir, { recursive: true })

  const summary: Record<string, { models: number; variants: number }> = {}
  for (const [series, models] of seriesMap.entries()) {
    const totalVariants = models.reduce((sum, m) => sum + m.variants.length, 0)
    summary[series] = { models: models.length, variants: totalVariants }
    const safeName = series.replace(/[\\/:*?"<>|]/g, '_')
    await fs.writeFile(path.join(seriesDir, `${safeName}.json`), JSON.stringify({ series, models }, null, 2))
  }

  await fs.writeFile(path.join(outBase, 'summary.json'), JSON.stringify(summary, null, 2))

  console.log('\n── 完成 ──')
  console.log('输出目录:', outBase)
  console.log('系列统计:', JSON.stringify(summary, null, 2))
}

main()
