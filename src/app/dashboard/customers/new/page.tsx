import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { CustomerForm } from '@/components/customers/CustomerForm'

export default function NewCustomerPage() {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-[#8892a4] mb-6">
        <Link href="/dashboard/customers" className="hover:text-[#e2e8f0] transition-colors">לקוחות</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-[#e2e8f0]">לקוח חדש</span>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">הוספת לקוח חדש</h1>
        <p className="text-sm text-[#8892a4] mt-0.5">מלא את הפרטים להוספת לקוח למערכת</p>
      </div>
      <CustomerForm />
    </div>
  )
}
