import { useState } from 'react'
import { Sidebar, type Page } from './components/Sidebar'
import { MonitorPage } from './components/MonitorPage'
import { SettingsPage } from './components/SettingsPage'
import { CalibrationPage } from './components/CalibrationPage'
import { AnalyticsPage } from './components/AnalyticsPage'
import { DEFAULT_OVERLAY_TOGGLES, type OverlayToggles } from './config/constants'
import type { RecordingSample } from './metrics/types'

export type SessionRecord = {
  id: string
  date: string
  durationMs: number
  samples: RecordingSample[]
}

function App() {
  const [page, setPage] = useState<Page>('monitor')
  const [toggles, setToggles] = useState<OverlayToggles>(DEFAULT_OVERLAY_TOGGLES)
  const [sessions, setSessions] = useState<SessionRecord[]>([])

  const handleSaveSession = (durationMs: number, samples: RecordingSample[]) => {
    const newSession: SessionRecord = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      durationMs,
      samples,
    }
    setSessions(prev => [newSession, ...prev])
  }

  const handleDeleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-200">
      <Sidebar page={page} onNavigate={setPage} />
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-slate-900">DriveWatch Platform</h2>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
            {page === 'monitor' && <span>Live Monitoring Active</span>}
            {page === 'calibration' && <span>Personalization Wizard</span>}
            {page === 'analytics' && <span>{sessions.length} Recorded Session{sessions.length !== 1 ? 's' : ''}</span>}
            {page === 'settings' && <span>System Configuration</span>}
          </div>
        </div>

        <div className="p-8">
          {page === 'monitor' && <MonitorPage toggles={toggles} onSaveSession={handleSaveSession} />}
          {page === 'calibration' && <CalibrationPage toggles={toggles} />}
          {page === 'analytics' && <AnalyticsPage sessions={sessions} onDeleteSession={handleDeleteSession} />}
          {page === 'settings' && <SettingsPage toggles={toggles} onChange={setToggles} />}
        </div>
      </main>
    </div>
  )
}

export default App
