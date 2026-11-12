import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeText, extractUrl, extractImage, predict } from '../services/api.js'
import { saveAnalysis, getHistory } from '../services/history.js'
import Notice from '../components/Notice.jsx'
import VerdictBadge from '../components/VerdictBadge.jsx'
import PipelineSteps from '../components/PipelineSteps.jsx'

const TABS = [
  { id: 'text', label: 'Paste Text', icon: '✦' },
  { id: 'url', label: 'Enter URL', icon: '⌁' },
  { id: 'image', label: 'Upload Image', icon: '◈' },
]

const ML_TASKS = ['fever_claim', 'liar_statement', 'tamil_xfact']

const SAMPLE_TEXTS = [
  {
    label: 'NASA Galaxy (Real)',
    text: 'WASHINGTON (Reuters) - NASA said on Wednesday that the James Webb Space Telescope has discovered GLASS-z12, one of the oldest galaxies ever seen, dating to approximately 350 million years after the Big Bang.',
  },
  {
    label: 'Miracle Cure (Fake)',
    text: 'BREAKING: Drinking 500ml of boiled lemon water with honey cures stage 4 lung cancer in 48 hours according to a secret hospital study.',
  },
]

const SAMPLE_URLS = [
  {
    label: 'JWST Wikipedia Article',
    url: 'https://en.wikipedia.org/wiki/James_Webb_Space_Telescope',
  },
  {
    label: 'Current Events Portal',
    url: 'https://en.wikipedia.org/wiki/Portal:Current_events',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('text')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [activeStep, setActiveStep] = useState(null) // 'extract' | 'gemini' | 'ml' | 'report'
  const fileRef = useRef()
  const history = getHistory().slice(0, 5)

  function handleFileChange(selectedFile) {
    if (!selectedFile) return
    setFile(selectedFile)
    setError(null)
    const reader = new FileReader()
    reader.onload = () => setPreviewUrl(reader.result)
    reader.readAsDataURL(selectedFile)
  }

  async function loadSampleImage() {
    try {
      const res = await fetch('/sample-news.png')
      const blob = await res.blob()
      const sampleFile = new File([blob], 'sample-news.png', { type: 'image/png' })
      handleFileChange(sampleFile)
    } catch {
      setError('Could not load sample image.')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    let inputText = ''
    let inputMeta = {}

    // Validation
    if (tab === 'text') {
      if (!text.trim()) { setError('Please enter some news text to analyze.'); return }
      inputText = text.trim()
      inputMeta = { text: inputText }
    } else if (tab === 'url') {
      if (!url.trim()) { setError('Please enter a valid article URL.'); return }
    } else if (tab === 'image') {
      if (!file) { setError('Please select or drop an image first.'); return }
    }

    setLoading(true)

    try {
      // Step 1: Content Extraction
      setActiveStep('extract')
      if (tab === 'url') {
        const urlResult = await extractUrl(url.trim())
        if (!urlResult.extracted_text || urlResult.extracted_text.trim().length < 20) {
          throw { code: 'no_content', message: 'No readable article text could be extracted from this URL. Try copying and pasting the text.' }
        }
        inputText = urlResult.extracted_text
        inputMeta = {
          url: url.trim(),
          title: urlResult.article_title,
          publisher: urlResult.publisher,
          text: inputText
        }
      } else if (tab === 'image') {
        const imgResult = await extractImage(file)
        if (!imgResult.extracted_text || imgResult.extracted_text.trim().length < 5) {
          throw { code: 'no_content', message: 'No readable text was detected in the image. Please upload a clear headline or article screenshot.' }
        }
        inputText = imgResult.extracted_text
        inputMeta = { filename: file.name, text: inputText }
      }

      // Step 2: Gemini Analysis
      setActiveStep('gemini')
      let geminiResult = null
      let geminiError = null
      try {
        geminiResult = await analyzeText(inputText)
      } catch (err) {
        geminiError = { code: err.code, message: err.message }
      }

      // Step 3: ML Classifiers
      setActiveStep('ml')
      const mlResults = {}
      const mlErrors = {}
      await Promise.all(
        ML_TASKS.map(async (task) => {
          try {
            const r = await predict(task, inputText.slice(0, 5000))
            mlResults[task] = r
          } catch (err) {
            mlErrors[task] = { code: err.code, message: err.message }
          }
        })
      )

      // Step 4: Compiling Report & Navigation
      setActiveStep('report')
      const id = saveAnalysis({
        ...inputMeta,
        inputType: tab,
        gemini: geminiResult,
        ml: mlResults,
        errors: { gemini: geminiError, ml: mlErrors },
      })

      // Short delay for animation smoothness
      setTimeout(() => {
        navigate(`/results/${id}`)
      }, 400)
    } catch (err) {
      setLoading(false)
      setActiveStep(null)
      setError(err.message || 'An unexpected error occurred during processing.')
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && dropped.type.startsWith('image/')) {
      handleFileChange(dropped)
      setTab('image')
    }
  }

  // Current pipeline step objects for loading state
  const liveSteps = [
    {
      id: 'extract',
      label: tab === 'url' ? 'Fetching Web Article' : tab === 'image' ? 'Gemini Vision OCR Extraction' : 'Content Received',
      status: activeStep === 'extract' ? 'running' : activeStep ? 'done' : 'pending',
      note: activeStep === 'extract' ? 'Fetching and parsing content…' : null,
    },
    {
      id: 'gemini',
      label: 'Gemini Fact-Checking Analysis',
      status: activeStep === 'gemini' ? 'running' : ['ml', 'report'].includes(activeStep) ? 'done' : 'pending',
      note: activeStep === 'gemini' ? 'Extracting verifiable claims & source evidence…' : null,
    },
    {
      id: 'ml',
      label: 'ML Classifier Grounding',
      status: activeStep === 'ml' ? 'running' : activeStep === 'report' ? 'done' : 'pending',
      note: activeStep === 'ml' ? 'Querying trained model registry…' : null,
    },
    {
      id: 'report',
      label: 'Compiling Final Report',
      status: activeStep === 'report' ? 'running' : 'pending',
    },
  ]

  return (
    <div className="landing">
      {/* Ticker */}
      <div className="ticker" aria-hidden="true">
        <div className="ticker__inner">
          {[...Array(2)].map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '64px' }}>
              {['Independent Verification', 'Gemini-Powered Analysis', 'URL Fetching', 'Vision OCR', 'No Hallucinated URLs', 'Real-Time Evidence'].map((item, j) => (
                <span key={j} className="ticker__item">
                  <span className="ticker__separator">◆</span>
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Hero */}
      <div className="landing__hero">
        <div className="container container--narrow">
          <div className="landing__eyebrow">
            <span>◆</span>
            News Verification System
          </div>
          <h1 className="landing__title">
            VERI<em>TAS</em>
          </h1>
          <p className="landing__subtitle">
            Independent verification. No assumptions. Every claim traced to real evidence.
          </p>
        </div>
      </div>

      {/* Input Panel */}
      <div className="container container--narrow" style={{ marginBottom: '32px' }}>
        {error && (
          <div style={{ marginBottom: '16px' }}>
            <Notice type="error">{error}</Notice>
          </div>
        )}

        <div className="input-panel">
          {/* Tabs */}
          <div className="input-panel__tabs" role="tablist" aria-label="Input type">
            {TABS.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`input-panel__tab ${tab === t.id ? 'input-panel__tab--active' : ''}`}
                onClick={() => { setTab(t.id); setError(null) }}
                disabled={loading}
              >
                <span aria-hidden="true">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="input-panel__body" role="tabpanel">
            {loading ? (
              <div style={{ padding: '24px 8px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px', textAlign: 'center' }}>
                  Processing Verification Pipeline…
                </h3>
                <PipelineSteps steps={liveSteps} />
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {tab === 'text' && (
                  <>
                    <textarea
                      className="input textarea"
                      placeholder="Paste news text, article content, or any claim to verify…"
                      value={text}
                      onChange={e => setText(e.target.value)}
                      maxLength={10000}
                      aria-label="News text to analyze"
                    />
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>Try Example:</span>
                      {SAMPLE_TEXTS.map((sample, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="btn btn--ghost btn--sm"
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          onClick={() => { setText(sample.text); setError(null) }}
                        >
                          {sample.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {tab === 'url' && (
                  <>
                    <input
                      type="url"
                      className="input"
                      placeholder="https://example.com/news-article"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      aria-label="Article URL"
                    />
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>Try Example:</span>
                      {SAMPLE_URLS.map((sample, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="btn btn--ghost btn--sm"
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          onClick={() => { setUrl(sample.url); setError(null) }}
                        >
                          {sample.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {tab === 'image' && (
                  <div>
                    <div
                      className={`drop-zone ${dragOver ? 'drop-zone--over' : ''}`}
                      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      aria-label="Upload image"
                      onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
                    >
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        style={{ display: 'none' }}
                        onChange={e => handleFileChange(e.target.files[0])}
                      />
                      {previewUrl ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <img
                            src={previewUrl}
                            alt="Upload preview"
                            style={{ maxHeight: '140px', maxWidth: '100%', borderRadius: '6px', marginBottom: '12px', objectFit: 'contain' }}
                          />
                          <p className="drop-zone__text" style={{ fontWeight: 600 }}>{file?.name}</p>
                          <p className="drop-zone__hint">{file ? (file.size / 1024).toFixed(0) + 'KB' : ''} · Click to replace image</p>
                        </div>
                      ) : (
                        <>
                          <svg className="drop-zone__icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="8" y="12" width="32" height="28" rx="3"/>
                            <path d="M8 32l10-10 8 8 6-6 8 8"/>
                            <circle cx="18" cy="20" r="2"/>
                          </svg>
                          <p className="drop-zone__text">Drop an image or click to browse</p>
                          <p className="drop-zone__hint">PNG, JPEG, WebP · Gemini Multimodal Vision</p>
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>Try Example:</span>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        onClick={loadSampleImage}
                      >
                        Load Sample News Headline Image
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
                  {tab === 'text' && text.length > 0 && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)' }}>
                      {text.length}/10,000
                    </span>
                  )}
                  <button
                    type="submit"
                    className="btn btn--primary btn--lg"
                    disabled={loading}
                    aria-busy={loading}
                  >
                    Verify →
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Recent History */}
      {history.length > 0 && (
        <div className="recent-section">
          <div className="container container--narrow">
            <div className="section-title">Recent Analyses</div>
            <div className="history-list">
              {history.map(item => (
                <a
                  key={item.id}
                  href={`/results/${item.id}`}
                  className="history-item"
                  onClick={e => { e.preventDefault(); navigate(`/results/${item.id}`) }}
                >
                  <div
                    className="history-item__score"
                    style={{
                      background: item.credibility_score >= 0.65 ? 'var(--supported-bg)' :
                                  item.credibility_score >= 0.35 ? 'var(--unverified-bg)' :
                                  item.credibility_score !== null ? 'var(--refuted-bg)' : 'var(--bg-muted)',
                      color: item.credibility_score >= 0.65 ? 'var(--supported)' :
                             item.credibility_score >= 0.35 ? 'var(--unverified)' :
                             item.credibility_score !== null ? 'var(--refuted)' : 'var(--text-disabled)',
                    }}
                  >
                    {item.credibility_score !== null
                      ? `${Math.round(item.credibility_score * 100)}`
                      : '?'}
                  </div>
                  <div className="history-item__content">
                    <div className="history-item__text">
                      {item.inputPreview || 'Analysis'}
                    </div>
                    <div className="history-item__meta">
                      {new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      {item.inputType.toUpperCase()}
                    </div>
                  </div>
                  <VerdictBadge score={item.credibility_score} />
                  <svg className="history-item__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
