import { useVWAPStore } from '../store/useVWAPStore'

export default function Header() {
  const bloombergConnected = useVWAPStore((s) => s.bloombergConnected)
  const setShowFAQ = useVWAPStore((s) => s.setShowFAQ)

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-bold text-gray-900 tracking-tight">VWAP Curve Generator</h1>
        <span className="text-xs text-gray-400 hidden sm:block">Bloomberg · Intraday Volume Profile</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Bloomberg status */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              bloombergConnected ? 'bg-green-500' : 'bg-red-400'
            }`}
          />
          <span className={bloombergConnected ? 'text-green-600' : 'text-gray-400'}>
            Bloomberg {bloombergConnected ? 'Connected' : 'Offline'}
          </span>
        </div>

        {/* FAQ button */}
        <button
          onClick={() => setShowFAQ(true)}
          className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 text-sm font-bold flex items-center justify-center transition-colors border border-gray-200"
          title="Help / FAQ"
        >
          ?
        </button>
      </div>
    </header>
  )
}
