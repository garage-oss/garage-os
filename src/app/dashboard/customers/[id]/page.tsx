import { notFound } from 'next/navigation'
import { requireOrg } from '@/lib/org'
import { getCustomer } from '@/lib/customers'

export const dynamic = 'force-dynamic'

export default async function CustomerProfilePage({ params }: { params: { id: string } }) {
  const { orgId } = await requireOrg()
  const customer = await getCustomer(orgId, params.id)
  if (!customer) notFound()

  return (
    <div style={{ padding: '2rem' }}>
      <p>MINIMAL TEST — Customer: {customer.name}</p>
      <p>ID: {customer.id}</p>
    </div>
  )
}
