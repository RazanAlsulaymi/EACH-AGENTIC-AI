export default function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-start gap-4">
      {Icon && (
        <div className={`p-2.5 rounded-xl ${accent || 'bg-gray-100'}`}>
          <Icon size={20} className="text-gray-700" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 leading-none mb-1">{value ?? '—'}</p>
        <p className="text-xs text-gray-500 font-medium leading-tight">{label}</p>
      </div>
    </div>
  )
}
