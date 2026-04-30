import { Fragment } from 'react'
import type { DeviceSpec } from '../types/device'

interface DeviceListProps {
  devices: DeviceSpec[]
  selectedIds: string[]
  onToggleCompare: (id: string) => void
}

type SpecField = {
  label: string
  key?: keyof DeviceSpec
  getValue?: (device: DeviceSpec) => string
}

const specGroups: { title: string; fields: SpecField[] }[] = [
  {
    title: '基础',
    fields: [
      { label: '型号显示', key: 'name' },
      { label: '宣传口号', getValue: (device) => device.sourceDescription || '-' },
      { key: 'releaseDate', label: '发布日期' },
      { key: 'os', label: '系统' },
      { label: '型号标识', key: 'id' },
      { label: '商城产品ID', getValue: (device) => device.productId || '-' },
    ],
  },
  {
    title: '外观',
    fields: [
      { label: '外观颜色', key: 'colors' },
      { label: '机身材料', key: 'material' },
      { label: '尺寸', key: 'dimensions' },
      { label: '重量', key: 'weight' },
    ],
  },
  {
    title: '性能',
    fields: [
      { key: 'chip', label: '芯片' },
      { key: 'storage', label: 'RAM ROM' },
      { label: '在售版本', getValue: (device) => (device.variantCount ? `${device.variantCount} 个 SKU` : '-') },
    ],
  },
  {
    title: '显示屏',
    fields: [
      { key: 'screen', label: '屏幕参数' },
      { label: '分辨率', key: 'resolution' },
      { label: '刷新率', key: 'refreshRate' },
      { label: '亮度', key: 'brightness' },
    ],
  },
  {
    title: '影像',
    fields: [
      { key: 'camera', label: '后置摄像头' },
      { label: '前置摄像头', key: 'frontCamera' },
    ],
  },
  {
    title: '连接',
    fields: [
      { label: '网络', key: 'network' },
      { label: 'WiFi', key: 'wifi' },
      { label: '蓝牙', key: 'bluetooth' },
      { label: 'NFC', key: 'nfc' },
      { label: '接口', key: 'port' },
    ],
  },
  {
    title: '感应器',
    fields: [
      { label: '解锁方式', key: 'unlock' },
      { label: '防水等级', key: 'waterproof' },
      { label: '传感器', key: 'sensors' },
    ],
  },
  {
    title: '电源',
    fields: [
      { key: 'battery', label: '电池容量' },
      { key: 'charging', label: '充电方式' },
    ],
  },
  {
    title: '音频',
    fields: [{ label: '音频', key: 'audio' }],
  },
  {
    title: '其他',
    fields: [
      { key: 'priceCny', label: '首发价格' },
      { label: '购买链接', getValue: (device) => device.buyUrl ? '小米商城' : '-' },
    ],
  },
]

export function DeviceList({ devices, selectedIds, onToggleCompare }: DeviceListProps) {
  return (
    <section>
      <div className="hub-table-wrap">
        <table className="hub-table">
          <colgroup>
            <col style={{ width: '46px' }} />
            <col style={{ width: '66px' }} />
            {devices.map((device) => (
              <col key={`col-device-${device.id}`} style={{ width: '160px' }} />
            ))}
          </colgroup>
          <thead>
            <tr className="hub-header-row">
              <th className="hub-sticky-header" colSpan={2}>参数</th>
              {devices.map((device) => (
                <th key={device.id} className="hub-device-col">
                  <div className="hub-device-thumb-wrap">
                    <img src={device.image} alt={device.name} className="hub-device-thumb" />
                  </div>
                  <div className="hub-device-name">{device.name}</div>
                  <button
                    type="button"
                    className={selectedIds.includes(device.id) ? 'hub-select-btn active' : 'hub-select-btn'}
                    onClick={() => onToggleCompare(device.id)}
                  >
                    {selectedIds.includes(device.id) ? '已选' : '加入对比'}
                  </button>
                  {device.buyUrl ? (
                    <a className="hub-buy-link" href={device.buyUrl} target="_blank" rel="noreferrer">
                      小米商城
                    </a>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {specGroups.map((group) => (
              <Fragment key={group.title}>
                {group.fields.map((field, rowIndex) => (
                  <tr key={`${group.title}-${field.label}`} className="hub-data-row">
                    {rowIndex === 0 && (
                      <td className="hub-sticky-group" rowSpan={group.fields.length} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                        {group.title}
                      </td>
                    )}
                    <td className="hub-sticky-field" style={{ textAlign: 'center', verticalAlign: 'middle' }}>{field.label}</td>
                    {devices.map((device) => (
                      <td key={`${group.title}-${field.label}-${device.id}`} className="hub-data-cell">
                        {field.getValue ? field.getValue(device) : field.key ? String(device[field.key] || '-') : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {devices.length === 0 ? <p className="empty-note">当前筛选条件下没有机型。</p> : null}
    </section>
  )
}
