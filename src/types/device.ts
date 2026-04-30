export type PhoneSeries =
  | 'Xiaomi 数字旗舰'
  | 'Xiaomi MIX系列'
  | 'Xiaomi Civi系列'
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
