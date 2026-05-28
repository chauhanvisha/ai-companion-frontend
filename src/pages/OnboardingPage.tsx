import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, saveProfile } from '../lib/api'
import { Sparkles } from 'lucide-react'

export default function OnboardingPage() {
  const [field,   setField]   = useState('')
  const [role,    setRole]    = useState('')
  const [school,  setSchool]  = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getProfile().then(p => {
      if (p?.field || p?.target_role) navigate('/dashboard', { replace: true })
    }).catch(() => {})
  }, [navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (field.trim() || role.trim() || school.trim()) {
        await saveProfile(field.trim(), role.trim(), school.trim())
      }
    } catch {}
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <img src="/highview-logo.png" alt="HighView" className="h-9 w-auto mx-auto mb-5" />
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl icon-box-blue mb-5">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Welcome!</h1>
          <p className="text-slate-500 mt-2 font-medium">
            Let's personalise your coaching so every session is relevant to you.
          </p>
        </div>

        {/* Card */}
        <div className="auth-card px-8 py-8">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Three quick questions</h2>
          <p className="text-sm text-slate-500 mb-7">
            The AI uses these to tailor every question, example, and scenario to your world.
            No dropdowns — type anything.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {[
              {
                label: 'What are you studying?',
                value: field, setter: setField, autoFocus: true,
                placeholder: 'e.g. Computer Science, Nursing, Criminal Justice, Marine Biology…',
              },
              {
                label: 'What kind of role are you working toward?',
                value: role, setter: setRole, autoFocus: false,
                placeholder: 'e.g. Software internship, Clinical rotation, Policy research…',
              },
              {
                label: 'What school do you go to?',
                value: school, setter: setSchool, autoFocus: false,
                placeholder: 'e.g. Santa Clara University, UCLA, University of Denver…',
              },
            ].map(({ label, value, setter, autoFocus, placeholder }) => (
              <div key={label} className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{label}</label>
                <input
                  value={value}
                  onChange={e => setter(e.target.value)}
                  placeholder={placeholder}
                  autoFocus={autoFocus}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm
                    text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2
                    focus:ring-primary/30 focus:border-primary/50 transition-all"
                />
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3.5 rounded-xl bg-primary text-white text-sm font-bold
                  hover:bg-primary/90 transition-all disabled:opacity-60
                  shadow-lg shadow-primary/25"
              >
                {loading ? 'Saving…' : "Let's go →"}
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3.5 rounded-xl text-sm font-semibold text-slate-500
                  hover:bg-slate-100 transition-all"
              >
                Skip
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
