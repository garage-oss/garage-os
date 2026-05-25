import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // ── Users ────────────────────────────────────────────────
  const password = await bcrypt.hash('admin123', 12)
  await prisma.user.upsert({
    where: { email: 'admin@garage.com' },
    update: {},
    create: { email: 'admin@garage.com', password, name: 'מנהל מערכת', role: 'ADMIN' },
  })

  // ── Customers ────────────────────────────────────────────
  const david = await prisma.customer.upsert({
    where: { id: 'cust-1' },
    update: {},
    create: { id: 'cust-1', name: 'דוד כהן', phone: '050-1234567', email: 'david@example.com', address: 'רחוב הרצל 12, תל אביב' },
  })
  const michal = await prisma.customer.upsert({
    where: { id: 'cust-2' },
    update: {},
    create: { id: 'cust-2', name: 'מיכל לוי', phone: '052-9876543', email: 'michal@example.com', address: 'שדרות בן גוריון 45, חיפה' },
  })
  const avi = await prisma.customer.upsert({
    where: { id: 'cust-3' },
    update: {},
    create: { id: 'cust-3', name: 'אבי ישראלי', phone: '054-5554444', address: 'רחוב ויצמן 8, ירושלים' },
  })

  // ── Vehicles ─────────────────────────────────────────────
  const corolla = await prisma.vehicle.upsert({
    where: { plate: '123-45-678' },
    update: {},
    create: { id: 'veh-1', plate: '123-45-678', make: 'Toyota', model: 'Corolla', year: 2019, color: 'לבן', customerId: david.id, mileage: 45000 },
  })
  const i20 = await prisma.vehicle.upsert({
    where: { plate: '987-65-432' },
    update: {},
    create: { id: 'veh-2', plate: '987-65-432', make: 'Hyundai', model: 'i20', year: 2021, color: 'כסוף', customerId: david.id, mileage: 22000 },
  })
  const mazda = await prisma.vehicle.upsert({
    where: { plate: '456-78-901' },
    update: {},
    create: { id: 'veh-3', plate: '456-78-901', make: 'Mazda', model: '3', year: 2020, color: 'אדום', customerId: michal.id, mileage: 38000 },
  })
  const civic = await prisma.vehicle.upsert({
    where: { plate: '112-23-334' },
    update: {},
    create: { id: 'veh-4', plate: '112-23-334', make: 'Honda', model: 'Civic', year: 2018, color: 'שחור', customerId: avi.id, mileage: 72000 },
  })

  // ── Work Orders ───────────────────────────────────────────
  const orders = [
    {
      id: 'wo-1',
      workOrderNumber: 'WO-2026-0001',
      status: 'PENDING' as const,
      complaint: 'רעש חזק מהמנוע בזמן נסיעה, במיוחד בהאצה',
      diagnosis: null,
      laborHours: 2.0,
      laborRate: 150,
      partsTotal: 0,
      totalPrice: 300,
      assignedTechnician: 'יוסי כהן',
      mileage: 45200,
      customerId: david.id,
      vehicleId: corolla.id,
    },
    {
      id: 'wo-2',
      workOrderNumber: 'WO-2026-0002',
      status: 'IN_PROGRESS' as const,
      complaint: 'בלמים תופסים בצד שמאל, הרגשה של משיכה בבלימה',
      diagnosis: 'שחיקת רפידות בלם קדמי שמאל — נדרש החלפה',
      laborHours: 1.5,
      laborRate: 150,
      partsTotal: 280,
      totalPrice: 505,
      assignedTechnician: 'אמיר דוד',
      mileage: 38500,
      customerId: michal.id,
      vehicleId: mazda.id,
    },
    {
      id: 'wo-3',
      workOrderNumber: 'WO-2026-0003',
      status: 'WAITING_PARTS' as const,
      complaint: 'דלת נהג לא נסגרת כראוי, מאבדת אחיזה',
      diagnosis: 'נדרש החלפת מנגנון נעילת דלת — חלקים הוזמנו',
      laborHours: 1.0,
      laborRate: 150,
      partsTotal: 450,
      totalPrice: 600,
      assignedTechnician: 'יוסי כהן',
      mileage: 72300,
      customerId: avi.id,
      vehicleId: civic.id,
    },
    {
      id: 'wo-4',
      workOrderNumber: 'WO-2026-0004',
      status: 'COMPLETED' as const,
      complaint: 'שמן מנוע דולף — כתמים על הרצפה',
      diagnosis: 'נזילה מגזקת שמן — הוחלפה בהצלחה',
      laborHours: 2.5,
      laborRate: 150,
      partsTotal: 120,
      totalPrice: 495,
      assignedTechnician: 'אמיר דוד',
      mileage: 22100,
      customerId: david.id,
      vehicleId: i20.id,
    },
    {
      id: 'wo-5',
      workOrderNumber: 'WO-2026-0005',
      status: 'IN_PROGRESS' as const,
      complaint: 'מיזוג אוויר לא מקרר — יוצא אוויר חם בלבד',
      diagnosis: 'מחסור בגז מקרר, בדיקת דליפות בביצוע',
      laborHours: 3.0,
      laborRate: 150,
      partsTotal: 350,
      totalPrice: 800,
      assignedTechnician: 'רון לוי',
      mileage: 45300,
      customerId: david.id,
      vehicleId: corolla.id,
    },
    {
      id: 'wo-6',
      workOrderNumber: 'WO-2026-0006',
      status: 'COMPLETED' as const,
      complaint: 'טיפול שגרתי — 40,000 ק"מ',
      diagnosis: 'הוחלפו: שמן, פילטרים, בדיקת רצועת טיימינג — תקין',
      laborHours: 3.5,
      laborRate: 150,
      partsTotal: 380,
      totalPrice: 905,
      assignedTechnician: 'יוסי כהן',
      mileage: 38000,
      customerId: michal.id,
      vehicleId: mazda.id,
    },
  ]

  for (const wo of orders) {
    await prisma.workOrder.upsert({
      where: { id: wo.id },
      update: {},
      create: wo,
    })
  }

  console.log('✓ Seed complete — admin@garage.com / admin123')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
