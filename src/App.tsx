import { useMemo, useRef, useState } from 'react'
import { CompareView } from './components/CompareView'
import { DeviceList } from './components/DeviceList'
import { xiaomiDevices } from './data/xiaomiDevices'
import type { PhoneSeries } from './types/device'
import './App.css'

const brandMenu = {
  Xiaomi: ['Xiaomi 数字旗舰', 'Xiaomi MIX系列', 'Xiaomi Civi系列'] as PhoneSeries[],
  REDMI: ['REDMI K系列', 'REDMI Turbo系列', 'REDMI Note系列', 'REDMI 数字系列'] as PhoneSeries[],
}

const deviceTypeMenu = [
  { label: '手机', enabled: true },
  { label: '平板（即将支持）', enabled: false },
  { label: '手表（即将支持）', enabled: false },
  { label: '笔记本（即将支持）', enabled: false },
  { label: '汽车（即将支持）', enabled: false },
]

type MenuSection = 'deviceType' | 'xiaomi' | 'redmi'

function App() {
  const [page, setPage] = useState<'list' | 'compare'>('list')
  const [activeSeries, setActiveSeries] = useState<PhoneSeries | 'all'>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedSections, setExpandedSections] = useState<Record<MenuSection, boolean>>({
    deviceType: true,
    xiaomi: true,
    redmi: true,
  })

  const contentRef = useRef<HTMLElement>(null)

  const filteredDevices = useMemo(() => {
    if (activeSeries === 'all') return xiaomiDevices
    return xiaomiDevices.filter((device) => device.series === activeSeries)
  }, [activeSeries])

  const selectedDevices = useMemo(() => {
    return xiaomiDevices.filter((device) => selectedIds.includes(device.id))
  }, [selectedIds])

  const toggleCompare = (id: string) => {
    setSelectedIds((previous) => {
      if (previous.includes(id)) {
        return previous.filter((item) => item !== id)
      }

      if (previous.length >= 4) {
        return previous
      }

      return [...previous, id]
    })
  }

  const goCompare = () => {
    if (selectedIds.length >= 2) {
      setPage('compare')
    }
  }

  const clearCompare = () => {
    setSelectedIds([])
    setPage('list')
  }

  const toggleSection = (section: MenuSection) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  return (
    <main className="frame-layout">
      <header className="topbar">
        <div className="topbar-brand">Xiaomi 参数中心</div>
        <nav className="topbar-links">
          <button type="button" className={page === 'list' ? 'nav-link active' : 'nav-link'} onClick={() => setPage('list')}>
            参数列表
          </button>
          <button type="button" className={page === 'compare' ? 'nav-link active' : 'nav-link'} onClick={goCompare}>
            参数对比
          </button>
        </nav>
      </header>

      <section className="frame-body">
        <aside className="side-menu">
          <div className="menu-group">
            <button type="button" className="menu-section-toggle" onClick={() => toggleSection('deviceType')}>
              <span className="menu-section-label">设备类型</span>
              <span className={expandedSections.deviceType ? 'menu-arrow expanded' : 'menu-arrow'}>›</span>
            </button>
            {expandedSections.deviceType
              ? deviceTypeMenu.map((type) => (
                  <button
                    key={type.label}
                    type="button"
                    className={type.enabled ? 'menu-item device-type active' : 'menu-item device-type'}
                    onClick={type.enabled ? () => setActiveSeries('all') : undefined}
                    disabled={!type.enabled}
                  >
                    {type.label}
                  </button>
                ))
              : null}
          </div>

          <div className="menu-group">
            <button type="button" className={activeSeries === 'all' ? 'menu-item all active' : 'menu-item all'} onClick={() => setActiveSeries('all')}>
              全部手机
            </button>
          </div>

          {Object.entries(brandMenu).map(([brand, seriesList]) => (
            <div className="menu-group" key={brand}>
              <button
                type="button"
                className="menu-section-toggle"
                onClick={() => toggleSection(brand === 'Xiaomi' ? 'xiaomi' : 'redmi')}
              >
                <span className="menu-section-label">{brand}</span>
                <span
                  className={
                    expandedSections[brand === 'Xiaomi' ? 'xiaomi' : 'redmi'] ? 'menu-arrow expanded' : 'menu-arrow'
                  }
                >
                  ›
                </span>
              </button>
              {expandedSections[brand === 'Xiaomi' ? 'xiaomi' : 'redmi']
                ? seriesList.map((series) => (
                    <button
                      key={series}
                      type="button"
                      className={activeSeries === series ? 'menu-item active' : 'menu-item'}
                      onClick={() => setActiveSeries(series)}
                    >
                      {series}
                    </button>
                  ))
                : null}
            </div>
          ))}

          <div className="menu-group">
            <p className="menu-title">操作</p>
            <button type="button" className="menu-action" onClick={goCompare} disabled={selectedIds.length < 2}>
              对比已选 ({selectedIds.length})
            </button>
            <button type="button" className="menu-action" onClick={() => setActiveSeries('all')}>
              重置筛选
            </button>
            <button type="button" className="menu-action" onClick={clearCompare}>
              清空已选
            </button>
          </div>
        </aside>

        <section className="frame-content" ref={contentRef}>
          {page === 'list' ? (
            <DeviceList devices={filteredDevices} selectedIds={selectedIds} onToggleCompare={toggleCompare} />
          ) : (
            <CompareView devices={selectedDevices} onBack={() => setPage('list')} />
          )}
        </section>
      </section>
    </main>
  )
}

export default App
