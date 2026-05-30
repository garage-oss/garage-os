/**
 * Demo data seed — complete customer journey for portal testing
 * Run: node scripts/seed-demo.mjs
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const ORG_ID = 'org-1'

// ── helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function hoursAgo(n) {
  const d = new Date()
  d.setHours(d.getHours() - n)
  return d
}

function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

async function main() {
  console.log('🌱 Seeding demo data for GarageOS portal testing...\n')

  // ── 1. Customer ─────────────────────────────────────────────────────────────
  const customer = await prisma.customer.upsert({
    where: {
      // No unique on phone, so we'll use create + check pattern
      id: 'demo-customer-daniel',
    },
    update: {},
    create: {
      id: 'demo-customer-daniel',
      organizationId: ORG_ID,
      name: 'דניאל כהן',
      phone: '0524112233',
      email: 'daniel.cohen@example.com',
    },
  })
  console.log('✅ Customer:', customer.name, `(${customer.id})`)

  // ── 2. Vehicle ──────────────────────────────────────────────────────────────
  const vehicle = await prisma.vehicle.upsert({
    where: {
      plate_organizationId: { plate: '8765432', organizationId: ORG_ID },
    },
    update: {},
    create: {
      id: 'demo-vehicle-corolla',
      organizationId: ORG_ID,
      plate: '8765432',
      make: 'Toyota',
      model: 'Corolla',
      year: 2020,
      color: 'לבן',
      fuelType: 'GASOLINE',
      mileage: 58400,
      customerId: customer.id,
    },
  })
  console.log('✅ Vehicle:', vehicle.make, vehicle.model, vehicle.plate)

  // ── 3. Active Work Order (IN_PROGRESS) ─────────────────────────────────────
  const activeWO = await prisma.workOrder.upsert({
    where: {
      workOrderNumber_organizationId: { workOrderNumber: 'WO-DEMO-001', organizationId: ORG_ID },
    },
    update: {},
    create: {
      id: 'demo-wo-active',
      organizationId: ORG_ID,
      workOrderNumber: 'WO-DEMO-001',
      status: 'IN_PROGRESS',
      complaint: 'רעש בזמן בלימה, רכב מושך שמאלה',
      diagnosis: 'בלאי בלמים קדמיים — רפידות ודיסקיות. ציר שמאלי נתון לבדיקה נוספת.',
      assignedTechnician: 'אלי לוי',
      mileage: 58400,
      laborHours: 2.5,
      laborRate: 295,
      partsTotal: 680,
      totalPrice: 1475.3,  // (2.5*295 + 680) * 1.17
      receivedAt: daysAgo(2),
      customerId: customer.id,
      vehicleId: vehicle.id,
    },
  })
  console.log('✅ Active WO:', activeWO.workOrderNumber, `(id: ${activeWO.id})`)

  // ── 4. Quote (SENT) ─────────────────────────────────────────────────────────
  // labor: 2.5h × 295 = 737.5, parts: 680, subtotal: 1417.5, VAT 17%: 241.0, total: 1658.5
  const laborTotal = 2.5 * 295         // 737.50
  const partsTotal = 680               // pads + rotors
  const subtotal   = laborTotal + partsTotal  // 1417.50
  const vat        = Math.round(subtotal * 0.17 * 100) / 100  // 240.98
  const total      = Math.round((subtotal + vat) * 100) / 100// 1658.48

  const existingQuote = await prisma.quote.findFirst({
    where: { workOrderId: activeWO.id },
  })

  let quote
  if (existingQuote) {
    quote = existingQuote
    console.log('⏭️  Quote already exists:', quote.quoteNumber)
  } else {
    quote = await prisma.quote.create({
      data: {
        id: 'demo-quote-001',
        organizationId: ORG_ID,
        quoteNumber: 'Q-DEMO-001',
        status: 'SENT',
        laborHours: 2.5,
        laborRate: 295,
        partsTotal: partsTotal,
        totalPrice: total,
        isEstimate: false,
        validUntil: daysFromNow(14),
        notes: 'מחיר כולל מע״מ 17%. תקף ל-14 יום.',
        customerId: customer.id,
        vehicleId: vehicle.id,
        workOrderId: activeWO.id,
        items: {
          create: [
            {
              description: 'רפידות בלמים קדמיות (סט)',
              quantity: 1,
              unitPrice: 320,
              total: 320,
            },
            {
              description: 'דיסקיות בלמים קדמיות (זוג)',
              quantity: 1,
              unitPrice: 360,
              total: 360,
            },
            {
              description: 'עבודת בלמים — 2.5 שעות × 295 ₪',
              quantity: 1,
              unitPrice: laborTotal,
              total: laborTotal,
            },
          ],
        },
      },
    })
    console.log('✅ Quote:', quote.quoteNumber, `total: ${total} ₪`)
  }

  // ── 5. Technician Notes (CUSTOMER visible) ──────────────────────────────────
  const existingNotes = await prisma.technicianNote.findMany({
    where: { workOrderId: activeWO.id },
  })

  if (existingNotes.length === 0) {
    await prisma.technicianNote.createMany({
      data: [
        {
          id: 'demo-note-1',
          workOrderId: activeWO.id,
          content: 'הרכב קיבלנו. בדיקה ראשונית מראה בלאי משמעותי ברפידות הקדמיות. מתחילים עבודה.',
          visibility: 'CUSTOMER',
          authorName: 'אלי לוי',
          createdAt: daysAgo(2),
        },
        {
          id: 'demo-note-2',
          workOrderId: activeWO.id,
          content: 'הזמנו חלקים — רפידות ודיסקיות קדמיות. הגעה צפויה תוך 3 שעות.',
          visibility: 'CUSTOMER',
          authorName: 'אלי לוי',
          createdAt: hoursAgo(20),
        },
        {
          id: 'demo-note-3',
          workOrderId: activeWO.id,
          content: 'החלקים הגיעו, מתחילים החלפה. הרכב יהיה מוכן עד סוף היום.',
          visibility: 'CUSTOMER',
          authorName: 'אלי לוי',
          createdAt: hoursAgo(3),
        },
      ],
    })
    console.log('✅ Technician notes: 3 customer-visible notes created')
  } else {
    console.log('⏭️  Notes already exist')
  }

  // ── 6. Media files (before/during phases) ──────────────────────────────────
  const existingMedia = await prisma.mediaFile.findMany({
    where: { workOrderId: activeWO.id },
  })

  if (existingMedia.length === 0) {
    await prisma.mediaFile.createMany({
      data: [
        {
          id: 'demo-media-1',
          workOrderId: activeWO.id,
          filename: 'before-1.jpg',
          originalName: 'בלמים לפני.jpg',
          mimeType: 'image/jpeg',
          size: 284000,
          url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
          phase: 'before',
          createdAt: daysAgo(2),
        },
        {
          id: 'demo-media-2',
          workOrderId: activeWO.id,
          filename: 'before-2.jpg',
          originalName: 'דיסקית קדמית.jpg',
          mimeType: 'image/jpeg',
          size: 312000,
          url: 'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&q=80',
          phase: 'before',
          createdAt: daysAgo(2),
        },
        {
          id: 'demo-media-3',
          workOrderId: activeWO.id,
          filename: 'during-1.jpg',
          originalName: 'פירוק בלמים.jpg',
          mimeType: 'image/jpeg',
          size: 267000,
          url: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&q=80',
          phase: 'during',
          createdAt: hoursAgo(5),
        },
        {
          id: 'demo-media-4',
          workOrderId: activeWO.id,
          filename: 'during-2.jpg',
          originalName: 'חלקים חדשים.jpg',
          mimeType: 'image/jpeg',
          size: 298000,
          url: 'https://images.unsplash.com/photo-1486754735734-325b5831c3ad?w=800&q=80',
          phase: 'during',
          createdAt: hoursAgo(2),
        },
      ],
    })
    console.log('✅ Media: 4 photos (2 before, 2 during) created')
  } else {
    console.log('⏭️  Media already exists')
  }

  // ── 7. Payment Link ─────────────────────────────────────────────────────────
  const existingPayment = await prisma.paymentLink.findFirst({
    where: { workOrderId: activeWO.id },
  })

  let paymentLink
  if (existingPayment) {
    paymentLink = existingPayment
    console.log('⏭️  Payment link already exists')
  } else {
    paymentLink = await prisma.paymentLink.create({
      data: {
        id: 'demo-payment-001',
        organizationId: ORG_ID,
        workOrderId: activeWO.id,
        amount: total,
        currency: 'ILS',
        description: 'החלפת בלמים קדמיים — Toyota Corolla 8765432',
        expiresAt: daysFromNow(30),
      },
    })
    console.log('✅ Payment link created:', paymentLink.token)
  }

  // ── 8. Past Work Orders (COMPLETED) for History screen ──────────────────────
  const pastWOs = [
    {
      id: 'demo-wo-past-1',
      workOrderNumber: 'WO-DEMO-100',
      status: 'COMPLETED',
      complaint: 'טיפול תקופתי 50,000 ק"מ',
      diagnosis: 'החלפת שמן מנוע, פילטרים, נוזלים. הכל תקין.',
      laborHours: 2.0,
      laborRate: 295,
      partsTotal: 290,
      totalPrice: Math.round((2.0 * 295 + 290) * 1.17 * 100) / 100,
      mileage: 50000,
      receivedAt: daysAgo(180),
      completedAt: daysAgo(179),
      assignedTechnician: 'אלי לוי',
    },
    {
      id: 'demo-wo-past-2',
      workOrderNumber: 'WO-DEMO-101',
      status: 'COMPLETED',
      complaint: 'תקלת מזגן — לא מקרר',
      diagnosis: 'מילוי גז פריאון + ניקוי פילטרים. תקין לאחר טיפול.',
      laborHours: 1.5,
      laborRate: 295,
      partsTotal: 185,
      totalPrice: Math.round((1.5 * 295 + 185) * 1.17 * 100) / 100,
      mileage: 44200,
      receivedAt: daysAgo(365),
      completedAt: daysAgo(364),
      assignedTechnician: 'יוסי אברהם',
    },
    {
      id: 'demo-wo-past-3',
      workOrderNumber: 'WO-DEMO-102',
      status: 'COMPLETED',
      complaint: 'ביקורת רכב לפני טסט',
      diagnosis: 'תיקון אורות, כיוון גלגלים. עמד בטסט בהצלחה.',
      laborHours: 1.0,
      laborRate: 295,
      partsTotal: 0,
      totalPrice: Math.round(1.0 * 295 * 1.17 * 100) / 100,
      mileage: 40100,
      receivedAt: daysAgo(540),
      completedAt: daysAgo(539),
      assignedTechnician: 'אלי לוי',
    },
  ]

  for (const wo of pastWOs) {
    await prisma.workOrder.upsert({
      where: {
        workOrderNumber_organizationId: {
          workOrderNumber: wo.workOrderNumber,
          organizationId: ORG_ID,
        },
      },
      update: {},
      create: {
        ...wo,
        organizationId: ORG_ID,
        customerId: customer.id,
        vehicleId: vehicle.id,
      },
    })
  }
  console.log('✅ Past work orders: 3 COMPLETED records created')

  // ── Done ─────────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60))
  console.log('🎉 Demo data ready!\n')
  console.log('Portal token (= work order ID):', activeWO.id)
  console.log('\n📱 Customer Portal URLs (localhost:3000):')
  const base = `http://localhost:3000/portal/${activeWO.id}`
  console.log(`  Home:            ${base}`)
  console.log(`  Status/Timeline: ${base}/timeline`)
  console.log(`  Quote:           ${base}/quote       ← SENT, awaiting approval`)
  console.log(`  Payment:         ${base}/pay         ← active payment link`)
  console.log(`  Photos & Video:  ${base}/media       ← 4 photos (before/during)`)
  console.log(`  Service History: ${base}/history     ← 3 past completed WOs`)
  console.log(`  Request Quote:   ${base}/request-quote`)
  console.log('\n🗝️  Quote token (for /pay/:token direct access):')
  console.log(`  http://localhost:3000/pay/${paymentLink.token}`)
  console.log('\n🏢 Dashboard URL:')
  console.log(`  http://localhost:3000/dashboard/work-orders/${activeWO.id}`)
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
