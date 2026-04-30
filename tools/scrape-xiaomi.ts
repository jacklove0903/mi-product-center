/*
  Simple Xiaomi spec scraper (learning/demo only)
  ----------------------------------------------
  • Reads model spec page URLs from urls.json
  • Extracts parameter table into DeviceSpecLike JSON
  • Writes result to data/output/xiaomi_raw.json

  Requirements: npm i axios cheerio
  Run: npx ts-node tools/scrape-xiaomi.ts
*/
import axios from 'axios'
import { load } from 'cheerio'
import { promises as fs } from 'fs'

interface DeviceSpecLike {
  name: string
  url: string
  [key: string]: string
}

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

async function scrape(url: string): Promise<DeviceSpecLike> {
  const response = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' })
  const html = decodeHtmlFromBytes(new Uint8Array(response.data))
  const $ = load(html)

  const name =
    $('h1').first().text().replace(/参数$/, '').trim() ||
    $('h2, .title').first().text().trim() ||
    url.split('/').slice(-2, -1)[0]
  const spec: DeviceSpecLike = { name, url }

  const addPair = (rawKey: string, rawVal: string) => {
    const key = rawKey.replace(/\s+/g, ' ').trim().replace(/[:：]$/, '')
    const val = rawVal.replace(/\s+/g, ' ').trim()
    if (!key || !val || key.length > 60) return
    if (key === '参数纠错' || key === '进入官网') return
    spec[key] = val
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

  return spec
}

async function main() {
  const urls: string[] = JSON.parse(await fs.readFile('tools/urls.json', 'utf8'))
  const out: DeviceSpecLike[] = []

  for (const u of urls) {
    console.log('scraping', u)
    try {
      out.push(await scrape(u))
    } catch (e) {
      console.warn('failed', u, e)
    }
    await delay(1500) // polite delay
  }

  await fs.mkdir('data/output', { recursive: true })
  await fs.writeFile('data/output/xiaomi_raw.json', JSON.stringify(out, null, 2))
  console.log('done -> data/output/xiaomi_raw.json')
}

main()
