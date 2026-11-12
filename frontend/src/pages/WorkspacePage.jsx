import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import PipelineSteps from '../components/PipelineSteps.jsx'

/** WorkspacePage — shows analysis pipeline progress.
 *  This page is shown when navigated via LandingPage during analysis.
 *  If accessed directly with no state, redirects home.
 */
export default function WorkspacePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state

  useEffect(() => {
    if (!state) navigate('/', { replace: true })
  }, [state, navigate])

  if (!state) return null

  const steps = buildSteps(state)

  return (
    <div className="workspace">
      <div className="container container--narrow">
        <div className="workspace__header">
          <h1 className="workspace__title">Analyzing…</h1>
          <p className="workspace__subtitle">
            Tracing every claim through real sources and evidence.
          </p>
        </div>

        <PipelineSteps steps={steps} />

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-disabled)' }}>
            This may take 10–30 seconds depending on article length.
          </p>
        </div>
      </div>
    </div>
  )
}

function buildSteps(state) {
  const { status, inputType } = state

  const extractLabel =
    inputType === 'url' ? 'Fetching Article' :
    inputType === 'image' ? 'OCR Text Extraction' :
    'Content Received'

  const steps = [
    {
      id: 'extract',
      label: extractLabel,
      status: status === 'pending' ? 'pending' :
              status === 'extracting' ? 'running' : 'done',
      note: status === 'extracting' ? 'Fetching and parsing content…' : null,
    },
    {
      id: 'gemini',
      label: 'Gemini Analysis',
      status: status === 'pending' || status === 'extracting' ? 'pending' :
              status === 'analyzing' ? 'running' : 'done',
      note: status === 'analyzing' ? 'Extracting claims and evidence…' : null,
    },
    {
      id: 'ml',
      label: 'ML Classification',
      status: status === 'pending' || status === 'extracting' || status === 'analyzing' ? 'pending' :
              status === 'classifying' ? 'running' : 'done',
      note: status === 'classifying' ? 'Running classifier models…' : null,
    },
    {
      id: 'report',
      label: 'Report Generation',
      status: status === 'done' ? 'done' : 'pending',
    },
  ]

  return steps
}
