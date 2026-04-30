import { compareFields } from '../data/xiaomiDevices'
import type { DeviceSpec } from '../types/device'

interface CompareViewProps {
  devices: DeviceSpec[]
  onBack: () => void
}

export function CompareView({ devices, onBack }: CompareViewProps) {
  return (
    <section>
      <header className="compare-header">
        <div>
          <p className="eyebrow">Compare</p>
          <h1>参数对比</h1>
          <p className="subtext">当前已选择 {devices.length} 台设备，差异项已高亮。</p>
        </div>
        <button type="button" className="ghost" onClick={onBack}>
          返回列表
        </button>
      </header>

      <div className="table-wrap compare-wrap">
        <table className="hub-table compare-table">
          <colgroup>
            <col style={{ width: '80px' }} />
            {devices.map((device) => (
              <col key={`col-device-${device.id}`} style={{ width: '160px' }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>参数项</th>
              {devices.map((device) => (
                <th key={device.id}>{device.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {compareFields.map((field) => {
              const values = devices.map((device) => String(device[field.key]))
              const isDifferent = new Set(values).size > 1

              return (
                <tr key={field.key} className={isDifferent ? 'diff' : ''}>
                  <td>{field.label}</td>
                  {values.map((value, index) => (
                    <td key={`${field.key}-${devices[index].id}`}>{value}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
