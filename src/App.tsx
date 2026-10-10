import { useState } from 'react'
import { Sidebar, type Page } from './components/Sidebar'
import { MonitorPage } from './components/MonitorPage'
import { SettingsPage } from './components/SettingsPage'
import { AboutPage } from './components/AboutPage'
import { DEFAULT_OVERLAY_TOGGLES, type OverlayToggles } from './config/constants'

function App() {
  const [page, setPage] = useState<Page>('monitor')
  const [toggles, setToggles] = useState<OverlayToggles>(DEFAULT_OVERLAY_TOGGLES)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar page={page} onNavigate={setPage} />
      <div className="flex-1">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-8 py-4">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-6 w-6 text-slate-900">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 17h14l-1.4-5.6a2 2 0 00-1.94-1.4H8.34a2 2 0 00-1.94 1.4L5 17z" />
            <circle cx="8" cy="17" r="1.5" />
            <circle cx="16" cy="17" r="1.5" />
          </svg>
          <span className="text-lg font-bold text-slate-900">DriveWatch</span>
          <span className="ml-2 hidden text-sm text-slate-400 sm:inline">Stay Alert. Reach Safer.</span>
        </div>

        {page === 'monitor' && <MonitorPage toggles={toggles} />}
        {page === 'settings' && <SettingsPage toggles={toggles} onChange={setToggles} />}
        {page === 'about' && <AboutPage />}
      </div>
    </div>
  )
}

export default App
