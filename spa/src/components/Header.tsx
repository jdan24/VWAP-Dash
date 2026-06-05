import { useVWAPStore } from '../store/useVWAPStore'

export default function Header() {
  const bloombergConnected = useVWAPStore((s) => s.bloombergConnected)
  const setShowFAQ = useVWAPStore((s) => s.setShowFAQ)

  return (
    <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-bold text-white tracking-tight">VWAP Curve Generator</h1>
        <span className="text-xs text-gray-600 hidden sm:block">Bloomberg · Intraday Volume Profile</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Bloomberg status */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              bloombergConnected ? 'bg-green-400 shadow-green-400/50 shadow-sm' : 'bg-red-500'
            }`}
          />
          <span className={bloombergConnected ? 'text-green-400' : 'text-gray-500'}>
            Bloomberg {bloombergConnected ? 'Connected' : 'Offline'}
          </span>
        </div>

        {/* FAQ button */}
        <button
          onClick={() => setShowFAQ(true)}
          className="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-sm font-bold flex items-center justify-center transition-colors"
          title="Help / FAQ"
        >
          ?
        </button>
      </div>
    </header>
  )
}
