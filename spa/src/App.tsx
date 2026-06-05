import { useEffect } from 'react'
import Header from './components/Header'
import CurveBuilder from './components/CurveBuilder'
import CurveList from './components/CurveList'
import TodayPanel from './components/TodayPanel'
import SimulationPanel from './components/SimulationPanel'
import VWAPChart from './components/VWAPChart'
import FAQModal from './components/FAQModal'
import { useVWAPStore } from './store/useVWAPStore'
import { fetchHealth } from './lib/bridgeClient'

export default function App() {
  const setBloombergConnected = useVWAPStore((s) => s.setBloombergConnected)

  // Poll Bloomberg bridge health every 5 seconds
  useEffect(() => {
    async function poll() {
      try {
        const h = await fetchHealth()
        setBloombergConnected(h.status === 'ok' && h.blpapi === true)
      } catch {
        setBloombergConnected(false)
      }
    }
    poll()
    const id = setInterval(poll, 5_000)
    return () => clearInterval(id)
  }, [setBloombergConnected])

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left sidebar ── */}
        <aside className="w-80 flex-shrink-0 bg-gray-900 border-r border-gray-800 overflow-y-auto">
          <div className="p-4 space-y-0">
            <CurveBuilder />
            <CurveList />
            <TodayPanel />
            <SimulationPanel />
          </div>
        </aside>

        {/* ── Main chart area ── */}
        <main className="flex-1 overflow-y-auto p-6">
          <VWAPChart />
        </main>
      </div>

      <FAQModal />
    </div>
  )
}
