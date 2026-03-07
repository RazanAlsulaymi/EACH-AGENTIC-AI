import { useRef, useState } from 'react'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { useApp } from '../../../context/AppContext'
import { api } from '../../../api/client'

const ALLOWED_TYPES = ['.pdf', '.png', '.jpg', '.jpeg', '.webp']
const MAX_SIZE_MB = 20

export default function FilesTab({ student, onUploadSuccess }) {
  const { language } = useApp()
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const files = student?.full_profile?.files || student?.files || []
  const studentId = student?.student?.student_id ?? student?.student_id ?? student?.id

  const handleFileChange = async (e) => {
    const file = e.target?.files?.[0]
    if (!file || !studentId) return
    e.target.value = ''
    setError(null)
    setLastResult(null)
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED_TYPES.includes(ext)) {
      setError(language === 'ar' ? `نوع غير مدعوم. استخدم: PDF, PNG, JPG, WebP` : `Unsupported type. Use: PDF, PNG, JPG, WebP`)
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(language === 'ar' ? `الملف كبير جداً. الحد: ${MAX_SIZE_MB} ميجابايت` : `File too large. Max: ${MAX_SIZE_MB}MB`)
      return
    }
    setUploading(true)
    try {
      const res = await api.analyzeFile(file, parseInt(studentId), 'IEP', null)
      setLastResult(res)
      onUploadSuccess?.()
    } catch (err) {
      setError(err?.message || (language === 'ar' ? 'فشل الرفع' : 'Upload failed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-6">
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || !studentId}
        className="w-full border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center mb-6 hover:border-gray-300 hover:bg-gray-50/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-transparent"
      >
        {uploading ? (
          <Loader2 size={24} className="text-primary mx-auto mb-3 animate-spin" />
        ) : (
          <Upload size={24} className="text-gray-300 mx-auto mb-3" />
        )}
        <p className="text-sm font-medium text-gray-500">
          {uploading
            ? (language === 'ar' ? 'جاري التحليل...' : 'Analyzing...')
            : (language === 'ar' ? 'رفع IEP أو واجب أو رسمة' : 'Upload IEP, homework, or drawing')}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {language === 'ar' ? 'سيحلل الذكاء الاصطناعي الملف تلقائيًا' : 'AI will analyze the file automatically'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">PDF, PNG, JPG, WebP · max {MAX_SIZE_MB}MB</p>
      </button>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {lastResult && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <p className="font-medium">{language === 'ar' ? 'تم تحليل الملف بنجاح' : 'File analyzed successfully'}</p>
          {lastResult.key_insights && (
            <p className="mt-2 text-gray-700">{lastResult.key_insights}</p>
          )}
        </div>
      )}

      {files.length === 0 && !lastResult ? (
        <p className="text-sm text-gray-400 text-center">
          {language === 'ar' ? 'لم يُرفع أي ملف بعد' : 'No files uploaded yet'}
        </p>
      ) : (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={f.id || i} className="flex items-center gap-3 border border-gray-200 rounded-xl p-3">
              <FileText size={16} className="text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{f.filename || f.name}</p>
                <p className="text-xs text-gray-400">{f.file_type || ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
