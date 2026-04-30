import axios from 'axios'
import { load } from 'cheerio'
import { promises as fs } from 'fs'

type RawModel = {
  modelName: string
  productId: string
  priceText: string
  buyUrl: string
  imageUrl: string
  description: string
  variants: Array<{ name: string }>
}

type ZolSpec = Record<string, string>

const ZOL_PARAM_URLS: Record<string, string> = {
  'Xiaomi 15': 'https://detail.zol.com.cn/1960/1959968/param.shtml',
  'Xiaomi 17 Ultra': 'https://detail.zol.com.cn/2153/2152334/param.shtml',
  'Xiaomi 15 Pro': 'https://detail.zol.com.cn/2113/2112061/param.shtml',
  'Xiaomi 15 Ultra': 'https://detail.zol.com.cn/2122/2121957/param.shtml',
  'Xiaomi 17 Ultra 徕卡版': 'https://detail.zol.com.cn/2153/2152334/param.shtml',
  'Xiaomi 17': 'https://detail.zol.com.cn/2143/2142373/param.shtml',
  'Xiaomi 17 Pro Max': 'https://detail.zol.com.cn/2143/2142375/param.shtml',
  'Xiaomi 17 Pro': 'https://detail.zol.com.cn/2143/2142374/param.shtml',
  'Xiaomi 15 定制版': 'https://detail.zol.com.cn/1960/1959968/param.shtml',
  'Xiaomi 15S Pro': 'https://detail.zol.com.cn/series/57/34645/param_10913841_0_1.html',
  'Xiaomi 14 Ultra': 'https://detail.zol.com.cn/1983/1982925/param.shtml',
  'Xiaomi 14 Pro': 'https://detail.zol.com.cn/1442/1441061/param.shtml',
  'Xiaomi 13 Ultra 限量定制色': 'https://detail.zol.com.cn/1554/1553913/param.shtml',
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

async function scrapeZol(url: string): Promise<ZolSpec> {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    },
    timeout: 20000,
  })
  const $ = load(decodeHtml(response.data))
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

  return spec
}

function pick(spec: ZolSpec, keys: string[], fallback = '-'): string {
  return keys.map((key) => spec[key]).find(Boolean) || fallback
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/徕卡版/g, 'leica')
    .replace(/定制版/g, 'custom')
    .replace(/限量定制色/g, 'limited')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatCamera(spec: ZolSpec, fallback: string): string {
  const pixels = pick(spec, ['像素'], '')
  const names = pick(spec, ['摄像头名称'], '')
  if (pixels) return pixels
  return names || fallback || '-'
}

function formatScreen(spec: ZolSpec, fallback: string): string {
  const size = pick(spec, ['屏幕尺寸'], '')
  const resolution = pick(spec, ['分辨率'], '')
  const material = pick(spec, ['屏幕材质'], '')
  const refresh = pick(spec, ['屏幕刷新率'], '')
  return [size, resolution, material, refresh].filter(Boolean).join(' / ') || fallback || '-'
}

function formatStorage(model: RawModel): string {
  return model.variants
    .map((variant) => variant.name.replace(model.modelName, '').trim())
    .filter(Boolean)
    .join(' / ')
}

async function main() {
  const raw = JSON.parse(await fs.readFile('data/output/mi/xiaomi-digital-series-models.json', 'utf8')) as {
    models: RawModel[]
  }

  const enriched = []

  for (const model of raw.models) {
    const zolUrl = ZOL_PARAM_URLS[model.modelName]
    const spec = zolUrl ? await scrapeZol(zolUrl) : { sourceUrl: '' }
    await delay(500)

    enriched.push({
      id: slug(model.modelName),
      name: model.modelName,
      image: model.imageUrl,
      brand: 'Xiaomi',
      series: 'Xiaomi 数字旗舰',
      releaseDate: pick(spec, ['上市日期', '国内发布时间']),
      chip: pick(spec, ['CPU型号'], model.description.match(/(?:第[一二三四五六七八九十]+代\s*)?骁龙[^｜|\n]*/)?.[0] || '-'),
      screen: formatScreen(spec, pick(spec, ['屏幕尺寸'], '-')),
      camera: formatCamera(spec, model.description),
      battery: pick(spec, ['电池容量'], model.description.match(/\d+\s*mAh[^｜|\n]*/i)?.[0] || '-'),
      charging: [pick(spec, ['有线充电'], ''), pick(spec, ['无线充电'], '')].filter(Boolean).join(' / ') || '-',
      storage: formatStorage(model),
      priceCny: `¥${model.priceText.replace('元', '')}`,
      os: pick(spec, ['操作系统'], model.description.match(/小米澎湃OS\s*\d?/)?.[0] || 'Xiaomi HyperOS'),
      productId: model.productId,
      buyUrl: model.buyUrl,
      sourceDescription: model.description,
      variantCount: model.variants.length,
      specSource: spec.sourceUrl,
      colors: pick(spec, ['机身颜色']),
      dimensions: [pick(spec, ['长度'], ''), pick(spec, ['宽度'], ''), pick(spec, ['厚度'], '')].filter(Boolean).join(' × ') || '-',
      weight: pick(spec, ['重量']),
      material: pick(spec, ['机身材质', '其他外观参数']),
      cpuFrequency: pick(spec, ['CPU频率']),
      gpu: pick(spec, ['GPU型号']),
      ramType: pick(spec, ['RAM存储类型']),
      romType: pick(spec, ['ROM存储类型']),
      resolution: pick(spec, ['分辨率']),
      refreshRate: pick(spec, ['屏幕刷新率']),
      brightness: pick(spec, ['屏幕亮度']),
      frontCamera: pick(spec, ['前置视频拍摄', '前置拍照功能']),
      network: pick(spec, ['网络类型']),
      wifi: pick(spec, ['WLAN功能']),
      bluetooth: pick(spec, ['蓝牙']),
      nfc: pick(spec, ['NFC']),
      port: pick(spec, ['机身接口']),
      unlock: [pick(spec, ['指纹识别'], ''), pick(spec, ['面部识别'], '')].filter(Boolean).join(' / ') || '-',
      waterproof: pick(spec, ['三防功能']),
      sensors: pick(spec, ['感应器']),
      audio: pick(spec, ['扬声器', '音频支持']),
    })
  }

  await fs.writeFile('data/output/mi/xiaomi-digital-series-enriched.json', JSON.stringify(enriched, null, 2))
  console.log(`done: ${enriched.length} enriched models`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
