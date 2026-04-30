export type PhoneSeries =
  // 小米数字系列（按代分组）
  | '小米17系列'
  | '小米15系列'
  | '小米14系列'
  | '小米13系列'
  | '小米12系列'
  | '小米11系列'
  | '小米10系列'
  | '小米9系列'
  | '小米8系列'
  | '小米6系列'
  | '小米5系列'
  | '小米4系列'
  | '小米3系列'
  | '小米2系列'
  | '小米1系列'
  // 小米其他系列
  | 'Xiaomi MIX系列'
  | 'Xiaomi Civi系列'
  // Redmi 系列
  | 'REDMI K系列'
  | 'REDMI Turbo系列'
  | 'REDMI Note系列'
  | 'REDMI 数字系列'

export interface DeviceSpec {
  id: string
  name: string
  image: string
  brand: 'Xiaomi' | 'REDMI'
  series: PhoneSeries
  releaseDate: string
  chip: string
  screen: string
  camera: string
  battery: string
  charging: string
  storage: string
  priceCny: string
  os: string
  productId?: string
  buyUrl?: string
  sourceDescription?: string
  variantCount?: number
  colors?: string
  dimensions?: string
  weight?: string
  material?: string
  resolution?: string
  refreshRate?: string
  brightness?: string
  frontCamera?: string
  network?: string
  wifi?: string
  bluetooth?: string
  nfc?: string
  port?: string
  unlock?: string
  waterproof?: string
  sensors?: string
  audio?: string
}
