import { notFound }    from 'next/navigation'
import Link            from 'next/link'
import { requireOrg }  from '@/lib/org'
import { prisma }      from '@/lib/prisma'
import { ChevronRight, Download, CheckCircle, AlertCircle, FileText, Shield } from 'lucide-react'
import { StaffVerifyButton } from './StaffVerifyButton'

export const dynamic = 'force-dynamic'

const DOC_TYPE_LABELS: Record<string, string> = {
  VEHICLE_LICENSE:         'רישיון רכב',
  MANDATORY_INSURANCE:     'ביטוח חובה',
  DRIVER_LICENSE:          'רישיון נהיגה של בעל הרכב',
  COMPREHENSIVE_INSURANCE: 'ביטוח מקיף/צד ג׳',
  POWER_OF_ATTORNEY:       'ייפוי כוח לטסט',
  OTHER:                   'מסמך אחר',
}

const DOC_TYPES_REQUIRED = ['VEHICLE_LICENSE', 'MANDATORY_INSURANCE', 'DRIVER_LICENSE']

function fmtDate(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function expiryStatus(expiryDate: Date | string | null): 'none' | 'ok' | 'soon' | 'expired' {
  if (!expiryDate) return 'none'
  const diff = new Date(expiryDate).getTime() - Date.now()
  const days = diff / (1000 * 60 * 60 * 24)
  if (days < 0) return 'expired'
  if (days < 30) return 'soon'
  return 'ok'
}

interface Props { params: { id: string; vehicleId: string } }

export default async function StaffVehicleDocumentsPage({ params }: Props) {
  const org = await requireOrg()

  const [customer, vehicle] = await Promise.all([
    prisma.customer.findFirst({
      where:  { id: params.id, organizationId: org.orgId },
      select: { id: true, name: true },
    }),
    prisma.vehicle.findFirst({
      where:  { id: params.vehicleId, organizationId: org.orgId, customerId: params.id },
      select: { id: true, make: true, model: true, plate: true },
    }),
  ])
  if (!customer || !vehicle) notFound()

  const docs = await prisma.vehicleDocument.findMany({
    where:   { vehicleId: vehicle.id, organizationId: org.orgId },
    orderBy: { documentType: 'asc' },
  })

  const docsByType = Object.fromEntries(
    [...DOC_TYPES_REQUIRED, 'COMPREHENSIVE_INSURANCE', 'POWER_OF_ATTORNEY', 'OTHER'].map(t => [t, docs.find(d => d.documentType === t)])
  )

  const requiredCount  = DOC_TYPES_REQUIRED.filter(t => docsByType[t]).length
  const testReadyTypes = ['VEHICLE_LICENSE', 'MANDATORY_INSURANCE', 'POWER_OF_ATTORNEY']
  const testReady      = testReadyTypes.every(t => docsByType[t])

  return (
    <div dir="rtl" className="max-w-3xl mx-auto px-4 py-6 space-y-6">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-slate-500 flex-wrap">
        <Link href="/dashboard/customers" className="hover:text-indigo-600">לקוחות</Link>
        <ChevronRight size={14} className="text-slate-300" />
        <Link href={`/dashboard/customers/${customer.id}`} className="hover:text-indigo-600">{customer.name}</Link>
        <ChevronRight size={14} className="text-slate-300" />
        <span className="text-slate-800 font-semibold">מסמכי {vehicle.make} {vehicle.model}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900">מסמכי הרכב</h1>
          <p className="text-slate-500 mt-1">{vehicle.plate} · {customer.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full ${
            testReady ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {testReady ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {testReady ? 'כשיר לטסט' : 'חסרים מסמכים לטסט'}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-black text-slate-800">{docs.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">הועלו</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
          <p className={`text-2xl font-black ${requiredCount === 3 ? 'text-emerald-600' : 'text-amber-500'}`}>
            {requiredCount}/3
          </p>
          <p className="text-xs text-slate-400 mt-0.5">מסמכי חובה</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-black text-slate-800">
            {docs.filter(d => expiryStatus(d.expiryDate) === 'expired').length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">פג תוקף</p>
        </div>
      </div>

      {/* Test checklist */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-indigo-600" />
          <h2 className="font-black text-slate-800">רשימת מסמכים לטסט</h2>
        </div>
        <div className="space-y-2">
          {testReadyTypes.map(type => {
            const doc  = docsByType[type]
            const stat = doc ? expiryStatus(doc.expiryDate) : 'missing'
            return (
              <div key={type} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs ${
                  !doc           ? 'bg-slate-100 text-slate-400'
                  : stat === 'expired' ? 'bg-red-100 text-red-600'
                  : stat === 'soon'    ? 'bg-amber-100 text-amber-600'
                  :                     'bg-emerald-100 text-emerald-600'
                }`}>
                  {!doc ? '✗' : stat === 'ok' ? '✓' : '!'}
                </span>
                <span className="flex-1 text-sm font-semibold text-slate-700">{DOC_TYPE_LABELS[type]}</span>
                {doc?.expiryDate && (
                  <span className={`text-xs font-semibold ${
                    stat === 'expired' ? 'text-red-600' : stat === 'soon' ? 'text-amber-600' : 'text-slate-400'
                  }`}>
                    {fmtDate(doc.expiryDate)}
                  </span>
                )}
                {doc && (
                  <a
                    href={`/api/vehicles/${vehicle.id}/documents/${doc.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    <Download size={14} />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* All documents */}
      <div>
        <h2 className="font-black text-slate-800 mb-3">כל המסמכים</h2>
        {docs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
            <FileText size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">לא הועלו מסמכים</p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map(doc => {
              const stat = expiryStatus(doc.expiryDate)
              return (
                <div key={doc.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-800 text-sm">{DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}</p>
                        {doc.verifiedAt && (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">✓ אומת</span>
                        )}
                        {stat === 'expired' && (
                          <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">פג תוקף</span>
                        )}
                        {stat === 'soon' && (
                          <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full">עומד לפוג</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{doc.originalFileName}</p>
                      <div className="flex gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                        {doc.issueDate  && <span>הנפקה: {fmtDate(doc.issueDate)}</span>}
                        {doc.expiryDate && <span>תפוגה: {fmtDate(doc.expiryDate)}</span>}
                        <span>הועלה: {fmtDate(doc.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`/api/vehicles/${vehicle.id}/documents/${doc.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg"
                      >
                        <Download size={13} /> הורד
                      </a>
                      <StaffVerifyButton vehicleId={vehicle.id} docId={doc.id} alreadyVerified={!!doc.verifiedAt} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
