import { create } from 'zustand'
import type { VWAPCurve, TodayData, SimResult } from '../types'

export const CURVE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#f43f5e']

export type YAxisKey = 'PctBuckets' | 'Smoothed' | 'AvgVolume'

interface VWAPStore {
  // Curves
  curves: VWAPCurve[]
  generating: boolean

  // Bloomberg
  bloombergConnected: boolean

  // Chart
  yAxis: YAxisKey

  // FAQ modal
  showFAQ: boolean

  // Today comparison
  today: TodayData | null
  todayVisible: boolean

  // Simulation
  simulation: SimResult[]

  // Actions
  addCurve: (curve: VWAPCurve) => void
  removeCurve: (id: string) => void
  toggleVisible: (id: string) => void
  setColor: (id: string, color: string) => void
  setLabel: (id: string, label: string) => void
  setGenerating: (v: boolean) => void
  setBloombergConnected: (v: boolean) => void
  setYAxis: (v: YAxisKey) => void
  setShowFAQ: (v: boolean) => void
  setToday: (v: TodayData | null) => void
  setTodayVisible: (v: boolean) => void
  setSimulation: (v: SimResult[]) => void
  nextColor: () => string
}

export const useVWAPStore = create<VWAPStore>((set, get) => ({
  curves: [],
  generating: false,
  bloombergConnected: false,
  yAxis: 'Smoothed',
  showFAQ: false,
  today: null,
  todayVisible: true,
  simulation: [],

  addCurve: (curve) =>
    set((s) => {
      if (s.curves.length >= 4) return s
      return { curves: [...s.curves, curve] }
    }),

  removeCurve: (id) =>
    set((s) => ({
      curves: s.curves.filter((c) => c.id !== id),
      simulation: s.simulation.filter((r) => r.curveId !== id),
    })),

  toggleVisible: (id) =>
    set((s) => ({
      curves: s.curves.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)),
    })),

  setColor: (id, color) =>
    set((s) => ({
      curves: s.curves.map((c) => (c.id === id ? { ...c, color } : c)),
      simulation: s.simulation.map((r) => (r.curveId === id ? { ...r, color } : r)),
    })),

  setLabel: (id, label) =>
    set((s) => ({
      curves: s.curves.map((c) => (c.id === id ? { ...c, label } : c)),
    })),

  setGenerating: (v) => set({ generating: v }),
  setBloombergConnected: (v) => set({ bloombergConnected: v }),
  setYAxis: (v) => set({ yAxis: v }),
  setShowFAQ: (v) => set({ showFAQ: v }),
  setToday: (v) => set({ today: v }),
  setTodayVisible: (v) => set({ todayVisible: v }),
  setSimulation: (v) => set({ simulation: v }),

  nextColor: () => {
    const { curves } = get()
    const used = new Set(curves.map((c) => c.color))
    return CURVE_COLORS.find((c) => !used.has(c)) ?? CURVE_COLORS[curves.length % CURVE_COLORS.length]
  },
}))
