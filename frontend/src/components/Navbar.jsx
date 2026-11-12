import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { checkHealth } from '../services/api.js'

export default function Navbar() {
  const location = useLocation()
  const [online, setOnline] = useState(null) // null=checking, true=online, false=offline

  useEffect(() => {
    let mounted = true
    async function ping() {
      try {
        await checkHealth()
        if (mounted) setOnline(true)
      } catch {
        if (mounted) setOnline(false)
      }
    }
    ping()
    const interval = setInterval(ping, 30_000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  const isActive = (path) => location.pathname === path

  return (
    <header className="header">
      <div className="container">
        <div className="header__inner">
          <Link to="/" className="header__logo">
            <span className="header__logo-mark">V</span>
            VERITAS
          </Link>

          <nav className="header__nav" aria-label="Main navigation">
            <Link
              to="/"
              className={`header__nav-link ${isActive('/') ? 'active' : ''}`}
            >
              Analyze
            </Link>
            <Link
              to="/history"
              className={`header__nav-link ${isActive('/history') ? 'active' : ''}`}
            >
              History
            </Link>
          </nav>

          <div className="header__status" aria-live="polite">
            <span
              className={`status-dot ${
                online === null ? '' :
                online ? 'status-dot--online' : 'status-dot--offline'
              }`}
              aria-hidden="true"
            />
            {online === null ? 'Connecting…' :
             online ? 'API Online' : 'API Offline'}
          </div>
        </div>
      </div>
    </header>
  )
}
