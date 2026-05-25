import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { SupplierForm } from '@/components/suppliers/SupplierForm'

export default function NewSupplierPage() {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6">
        <Link href="/dashboard/suppliers" className="hover:text-[#e2e8f0] transition-colors">ספקים</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">ספק חדש</span>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">הוספת ספק חדש</h1>
        <p className="text-sm text-[#8892a4] mt-0.5">הזן את פרטי הספק</p>
      </div>
      <SupplierForm mode="create" />
    </div>
  )
}
