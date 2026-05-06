import { promises as fs } from 'fs'

interface ImageEntry {
  keyword: string
  productId: string
  name: string
  imageUrl: string
}

interface DeviceMap {
  [deviceId: string]: string // deviceId -> imageUrl
}

// 过滤掉配件、服务等非手机产品
function isPhone(name: string): boolean {
  const lower = name.toLowerCase()
  // 排除配件关键词
  if (/保护壳|保护套|贴膜|屏幕换新|后盖换新|电池换新|维修服务|手机壳|充电器|耳机|数据线|支架|钢化膜/.test(lower)) return false
  // 排除电脑、平板等
  if (/book|pad pro|平板|笔记本|显示器/.test(lower)) return false
  // 必须包含手机型号关键词
  if (/redmi|k\d0|k\d0|note\s*\d|turbo\s*\d|\d+[cg]?[dg]|k20|k30|k40|k50|k60|k70|k80|k90/.test(lower)) return true
  return false
}

// 从产品名中提取基础型号（去掉存储配置等后缀）
function extractBaseName(name: string): string {
  return name
    .replace(/\s*\d+GB\+\d+GB.*$/i, '')
    .replace(/\s*至.*/i, '')
    .replace(/\s+祥云.*/i, '')
    .replace(/\s+子夜.*/i, '')
    .replace(/\s+星辉.*/i, '')
    .replace(/\s+ROCK.*/i, '')
    .replace(/\s+AlwaySmart.*/i, '')
    .replace(/\s+浅梦.*/i, '')
    .replace(/\s+墨羽.*/i, '')
    .replace(/\s+晴雪.*/i, '')
    .trim()
}

// 搜索关键词到设备ID的映射
const KEYWORD_TO_DEVICE: Record<string, string> = {
  'REDMI K80 Pro': 'redmi-k80-pro',
  'REDMI K80': 'redmi-k80',
  'Redmi K70 Pro': 'redmi-k70-pro',
  'Redmi K70': 'redmi-k70',
  'Redmi K70E': 'redmi-k70e',
  'Redmi K70 Ultra': 'redmi-k70-ultra',
  'Redmi K60 Pro': 'redmi-k60-pro',
  'Redmi K60': 'redmi-k60',
  'Redmi K60 Ultra': 'redmi-k60-ultra',
  'Redmi K50 Pro': 'redmi-k50-pro',
  'Redmi K50': 'redmi-k50',
  'Redmi K50 Ultra': 'redmi-k50-ultra',
  'Redmi K40 Pro': 'redmi-k40-pro',
  'Redmi K40': 'redmi-k40',
  'Redmi K40S': 'redmi-k40s',
  'Redmi K30 Pro': 'redmi-k30-pro',
  'Redmi K30S': 'redmi-k30s',
  'Redmi K20 Pro': 'redmi-k20-pro',
  'Redmi K20': 'redmi-k20',
  'REDMI Turbo 4 Pro': 'redmi-turbo4-pro',
  'REDMI Turbo 4': 'redmi-turbo4',
  'REDMI Turbo 3': 'redmi-turbo3',
  'Redmi Note 14 Pro+': 'redmi-note14-pro-plus',
  'Redmi Note 14 Pro': 'redmi-note14-pro',
  'Redmi Note 14': 'redmi-note14',
  'Redmi Note 13 Pro+': 'redmi-note13-pro-plus',
  'Redmi Note 13 Pro': 'redmi-note13-pro',
  'Redmi Note 13': 'redmi-note13',
  'Redmi Note 12 Pro+': 'redmi-note12-pro-plus',
  'Redmi Note 12 Pro': 'redmi-note12-pro',
  'Redmi Note 12': 'redmi-note12',
  'Redmi Note 11 Pro': 'redmi-note11-pro',
  'Redmi Note 11': 'redmi-note11',
  'Redmi Note 10 Pro': 'redmi-note10-pro',
  'Redmi Note 9 Pro': 'redmi-note9-pro',
  'Redmi Note 8 Pro': 'redmi-note8-pro',
  'Redmi Note 7 Pro': 'redmi-note7-pro',
  'Redmi 14C': 'redmi-14c-5g',
  'Redmi 14R': 'redmi-14r-5g',
  'Redmi 13C': 'redmi-13c',
  'Redmi 12C': 'redmi-12c',
  'Redmi 12': 'redmi-12',
  'Redmi 11': 'redmi-11',
  'Redmi 10': 'redmi-10',
  'Redmi 9': 'redmi-9',
  'Redmi 8': 'redmi-8',
  'Redmi 7': 'redmi-7',
  'Redmi 6': 'redmi-6',
  'Redmi 5': 'redmi-5',
  'Redmi 4': 'redmi-4',
  'Redmi 3': 'redmi-3',
  'Redmi 2': 'redmi-2',
  'Redmi 1': 'redmi-1',
}

async function main() {
  const rawImages: ImageEntry[] = JSON.parse(
    await fs.readFile('data/output/mi/redmi-images.json', 'utf-8')
  )

  const deviceImages: DeviceMap = {}

  for (const entry of rawImages) {
    if (!isPhone(entry.name)) continue

    const baseName = extractBaseName(entry.name)

    // 尝试匹配到设备ID
    for (const [pattern, deviceId] of Object.entries(KEYWORD_TO_DEVICE)) {
      if (deviceImages[deviceId]) continue // 已有图片

      // 精确匹配或包含匹配
      if (baseName === pattern || baseName.includes(pattern) || pattern.includes(baseName)) {
        deviceImages[deviceId] = entry.imageUrl
        console.log(`✓ ${deviceId} ← ${baseName}`)
        break
      }
    }
  }

  // 输出映射结果
  const result = Object.entries(deviceImages).map(([id, url]) => ({ id, imageUrl: url }))
  await fs.writeFile('data/output/mi/redmi-image-map.json', JSON.stringify(result, null, 2))

  const total = Object.keys(KEYWORD_TO_DEVICE).length
  const matched = Object.keys(deviceImages).length
  console.log(`\nMatched: ${matched}/${total}`)

  // 显示未匹配的设备
  for (const [, deviceId] of Object.entries(KEYWORD_TO_DEVICE)) {
    if (!deviceImages[deviceId]) {
      console.log(`✗ Missing: ${deviceId}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
