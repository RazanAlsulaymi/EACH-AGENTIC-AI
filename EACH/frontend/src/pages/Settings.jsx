import { useState } from 'react'
import { Check } from 'lucide-react'
import Layout from '../components/layout/Layout'
import { useApp } from '../context/AppContext'
import { useTranslation } from '../lib/i18n'

export default function Settings() {
  const { language, setLanguage, teacherName, setTeacherName } = useApp()
  const tr = useTranslation(language)
  const [name, setName] = useState(teacherName)
  const [saved, setSaved] = useState(false)

  const handleSaveName = () => {
    setTeacherName(name.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Layout title={tr.settings}>
      <div className="max-w-lg mx-auto w-full px-4 py-8 space-y-8">

        {/* Teacher name */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">{tr.teacherNameLabel}</h2>
          <p className="text-xs text-gray-500">
            {language === 'ar'
              ? 'سيظهر اسمك في تحية الترحيب على الصفحة الرئيسية'
              : 'Your name appears in the welcome greeting on the home page'}
          </p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={language === 'ar' ? 'اسمك هنا...' : 'Your name...'}
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-gray-400 transition-colors"
              dir={language === 'ar' ? 'rtl' : 'ltr'}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
            />
            <button
              onClick={handleSaveName}
              className={`px-4 text-sm font-medium rounded-xl transition-all flex items-center gap-1.5 ${
                saved
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-900 text-white hover:bg-gray-700'
              }`}
            >
              {saved ? <><Check size={14} /> {language === 'ar' ? 'تم' : 'Saved'}</> : (language === 'ar' ? 'حفظ' : 'Save')}
            </button>
          </div>
        </div>

        {/* Language */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">{tr.languageLabel}</h2>
          <div className="flex gap-2">
            {[
              { code: 'en', label: 'English' },
              { code: 'ar', label: 'العربية' },
            ].map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                className={`flex-1 py-3 text-sm font-medium rounded-xl border transition-all ${
                  language === code
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Logout placeholder */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <button className="w-full text-sm font-medium text-red-600 py-2 hover:text-red-800 transition-colors">
            {tr.logout}
          </button>
        </div>

      </div>
    </Layout>
  )
}
