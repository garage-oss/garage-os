import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // ── Organization ──────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: 'org-1' },
    update: {},
    create: {
      id:      'org-1',
      name:    'מוסך הדגמה',
      slug:    'demo-garage',
      phone:   '03-5551234',
      address: 'רחוב הרצל 1',
      city:    'תל אביב',
      country: 'IL',
      vatId:   '514123456',
      plan:    'FREE',
    },
  })
  const orgId = org.id

  // ── Users (one per role) ──────────────────────────────────────────────────
  const password = await bcrypt.hash('admin123', 12)

  const owner = await prisma.user.upsert({
    where: { email: 'owner@garage.com' },
    update: {},
    create: { email: 'owner@garage.com', password, name: 'ישראל ישראלי', phone: '050-1111111', position: 'בעלים', isActive: true },
  })
  const manager = await prisma.user.upsert({
    where: { email: 'manager@garage.com' },
    update: {},
    create: { email: 'manager@garage.com', password, name: 'רחל לוי', phone: '050-2222222', position: 'מנהל מוסך', department: 'ניהול', isActive: true },
  })
  const technician = await prisma.user.upsert({
    where: { email: 'tech@garage.com' },
    update: {},
    create: { email: 'tech@garage.com', password, name: 'יוסי כהן', phone: '050-3333333', position: 'טכנאי בכיר', department: 'מכונאות', isActive: true },
  })
  const advisor = await prisma.user.upsert({
    where: { email: 'advisor@garage.com' },
    update: {},
    create: { email: 'advisor@garage.com', password, name: 'מיכל דוד', phone: '050-4444444', position: 'יועץ שירות', department: 'קבלת רכבים', isActive: true },
  })
  const accountant = await prisma.user.upsert({
    where: { email: 'accountant@garage.com' },
    update: {},
    create: { email: 'accountant@garage.com', password, name: 'אבי אברהם', phone: '050-5555555', position: 'חשבונאי', department: 'כספים', isActive: true },
  })

  // ── Memberships ───────────────────────────────────────────────────────────
  const joinedAt = new Date('2026-01-01')

  for (const [user, role] of [
    [owner,      'OWNER'          ],
    [manager,    'MANAGER'        ],
    [technician, 'TECHNICIAN'     ],
    [advisor,    'SERVICE_ADVISOR'],
    [accountant, 'ACCOUNTANT'     ],
  ] as const) {
    await prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
      update: {},
      create: { organizationId: orgId, userId: user.id, role, isActive: true, joinedAt },
    })
  }

  // ── Customers ─────────────────────────────────────────────────────────────
  const david = await prisma.customer.upsert({
    where: { id: 'cust-1' },
    update: {},
    create: { id: 'cust-1', organizationId: orgId, name: 'דוד כהן', phone: '050-1234567', email: 'david.cohen@gmail.com', address: 'רחוב הרצל 12, תל אביב', notes: 'לקוח ותיק — מגיע לטיפולים כל 6 חודשים' },
  })
  const michal = await prisma.customer.upsert({
    where: { id: 'cust-2' },
    update: {},
    create: { id: 'cust-2', organizationId: orgId, name: 'מיכל לוי', phone: '052-9876543', email: 'michal.levi@walla.com', address: 'שדרות בן גוריון 45, חיפה' },
  })
  const avi = await prisma.customer.upsert({
    where: { id: 'cust-3' },
    update: {},
    create: { id: 'cust-3', organizationId: orgId, name: 'אבי ישראלי', phone: '054-5554444', address: 'רחוב ויצמן 8, ירושלים', notes: 'מעדיף תיאום מראש בוואטסאפ' },
  })
  const sara = await prisma.customer.upsert({
    where: { id: 'cust-4' },
    update: {},
    create: { id: 'cust-4', organizationId: orgId, name: 'שרה גולדברג', phone: '058-1112233', email: 'sara.g@hotmail.com', address: 'שדרות רוטשילד 22, רמת גן' },
  })
  const yaakov = await prisma.customer.upsert({
    where: { id: 'cust-5' },
    update: {},
    create: { id: 'cust-5', organizationId: orgId, name: 'יעקב פרץ', phone: '050-7778888', email: 'yaakov.perets@gmail.com', address: 'רחוב הגפן 5, בת ים' },
  })
  const noa = await prisma.customer.upsert({
    where: { id: 'cust-6' },
    update: {},
    create: { id: 'cust-6', organizationId: orgId, name: 'נועה אברהם', phone: '054-3339999', email: 'noa.avraham@gmail.com', address: 'רחוב סוקולוב 14, הרצליה' },
  })

  // ── Vehicles ──────────────────────────────────────────────────────────────
  const corolla = await prisma.vehicle.upsert({
    where: { id: 'veh-1' },
    update: {},
    create: { id: 'veh-1', organizationId: orgId, plate: '123-45-678', make: 'Toyota', model: 'Corolla', year: 2019, color: 'לבן', engine: '1.6L', fuelType: 'GASOLINE', transmission: 'AUTOMATIC', customerId: david.id, mileage: 45000 },
  })
  const i20 = await prisma.vehicle.upsert({
    where: { id: 'veh-2' },
    update: {},
    create: { id: 'veh-2', organizationId: orgId, plate: '987-65-432', make: 'Hyundai', model: 'i20', year: 2021, color: 'כסוף', engine: '1.0T', fuelType: 'GASOLINE', transmission: 'AUTOMATIC', customerId: david.id, mileage: 22000 },
  })
  const mazda = await prisma.vehicle.upsert({
    where: { id: 'veh-3' },
    update: {},
    create: { id: 'veh-3', organizationId: orgId, plate: '456-78-901', make: 'Mazda', model: '3', year: 2020, color: 'אדום', engine: '2.0L', fuelType: 'GASOLINE', transmission: 'AUTOMATIC', customerId: michal.id, mileage: 38000 },
  })
  const civic = await prisma.vehicle.upsert({
    where: { id: 'veh-4' },
    update: {},
    create: { id: 'veh-4', organizationId: orgId, plate: '112-23-334', make: 'Honda', model: 'Civic', year: 2018, color: 'שחור', engine: '1.5T', fuelType: 'GASOLINE', transmission: 'MANUAL', customerId: avi.id, mileage: 72000, vin: 'JHMFC1F37JX000001' },
  })
  const sportage = await prisma.vehicle.upsert({
    where: { id: 'veh-5' },
    update: {},
    create: { id: 'veh-5', organizationId: orgId, plate: '333-44-555', make: 'Kia', model: 'Sportage', year: 2022, color: 'כחול', engine: '1.6T', fuelType: 'GASOLINE', transmission: 'AUTOMATIC', customerId: sara.id, mileage: 14000 },
  })
  await prisma.vehicle.upsert({
    where: { id: 'veh-6' },
    update: {},
    create: { id: 'veh-6', organizationId: orgId, plate: '666-77-888', make: 'Volkswagen', model: 'Golf', year: 2019, color: 'אפור', engine: '2.0 TDI', fuelType: 'DIESEL', transmission: 'MANUAL', customerId: yaakov.id, mileage: 61000, vin: 'WVWZZZ1KZAW000002' },
  })
  await prisma.vehicle.upsert({
    where: { id: 'veh-7' },
    update: {},
    create: { id: 'veh-7', organizationId: orgId, plate: '999-00-111', make: 'Subaru', model: 'Forester', year: 2021, color: 'ירוק', engine: '2.0L', fuelType: 'GASOLINE', transmission: 'AUTOMATIC', customerId: noa.id, mileage: 29000 },
  })
  await prisma.vehicle.upsert({
    where: { id: 'veh-8' },
    update: {},
    create: { id: 'veh-8', organizationId: orgId, plate: '222-33-444', make: 'Mitsubishi', model: 'Outlander', year: 2020, color: 'לבן', engine: '2.4L', fuelType: 'HYBRID', transmission: 'AUTOMATIC', customerId: sara.id, mileage: 43000, notes: 'חיבור היברידי — טעינה 220V בלבד' },
  })
  await prisma.vehicle.upsert({
    where: { id: 'veh-9' },
    update: {},
    create: { id: 'veh-9', organizationId: orgId, plate: '555-66-777', make: 'Skoda', model: 'Octavia', year: 2018, color: 'שחור', engine: '1.5 TSI', fuelType: 'GASOLINE', transmission: 'AUTOMATIC', customerId: david.id, mileage: 88000 },
  })
  await prisma.vehicle.upsert({
    where: { id: 'veh-10' },
    update: {},
    create: { id: 'veh-10', organizationId: orgId, plate: '777-11-222', make: 'Toyota', model: 'RAV4', year: 2023, color: 'כסוף', engine: '2.5L', fuelType: 'HYBRID', transmission: 'CVT', customerId: michal.id, mileage: 8000 },
  })

  // ── Suppliers ─────────────────────────────────────────────────────────────
  const sup1 = await prisma.supplier.upsert({
    where: { id: 'sup-1' },
    update: {},
    create: { id: 'sup-1', organizationId: orgId, name: 'טכנו-חלקים בע"מ', contactName: 'משה אברמוביץ', phone: '03-5551234', email: 'orders@techno-parts.co.il', address: 'אזור תעשייה צפוני, פתח תקווה', notes: 'אספקה תוך 24 שעות לחלקי מנוע ובלמים' },
  })
  const sup2 = await prisma.supplier.upsert({
    where: { id: 'sup-2' },
    update: {},
    create: { id: 'sup-2', organizationId: orgId, name: 'אוטו-פרו ייבוא', contactName: 'רחל כץ', phone: '08-6667890', email: 'rachel@autopro.co.il', address: 'רחוב המסחר 7, אשדוד', notes: 'חלקי מקור יפני ואירופאי — הזמנה מינימלית 500 ₪' },
  })
  const sup3 = await prisma.supplier.upsert({
    where: { id: 'sup-3' },
    update: {},
    create: { id: 'sup-3', organizationId: orgId, name: 'אל-קאר שרות', contactName: 'אחמד חסן', phone: '04-8889012', email: 'info@alcar.co.il', address: 'רחוב הנחושת 3, חיפה', notes: 'מתמחה בחלקי מיזוג ומערכות קירור' },
  })
  const sup4 = await prisma.supplier.upsert({
    where: { id: 'sup-4' },
    update: {},
    create: { id: 'sup-4', organizationId: orgId, name: 'פרימיום-אוטו', contactName: 'גיל שפירא', phone: '02-7771111', email: 'gil@premiumauto.co.il', address: 'קניון הגדול, ירושלים', notes: 'ייבוא חלקים גרמניים — BMW, Mercedes, VW' },
  })

  // ── Parts ─────────────────────────────────────────────────────────────────
  const parts = [
    { id: 'part-1',  sku: 'FLT-OIL-001',   name: 'פילטר שמן — יוניברסל',           category: 'פילטרים',     manufacturer: 'Bosch',      supplierId: sup1.id, costPrice: 18,  salePrice: 35,  quantity: 45, minQuantity: 10, location: 'מדף A1' },
    { id: 'part-2',  sku: 'FLT-AIR-002',   name: 'פילטר אוויר — טויוטה קורולה',    category: 'פילטרים',     manufacturer: 'Toyota OEM', supplierId: sup2.id, costPrice: 55,  salePrice: 95,  quantity: 12, minQuantity: 5,  location: 'מדף A2' },
    { id: 'part-3',  sku: 'BRK-PAD-001',   name: 'רפידות בלם קדמי — יוניברסל',     category: 'בלמים',       manufacturer: 'Brembo',     supplierId: sup1.id, costPrice: 90,  salePrice: 160, quantity: 8,  minQuantity: 6,  location: 'מדף B1', notes: 'מתאים לרוב דגמי ה-2015 ומעלה' },
    { id: 'part-4',  sku: 'BRK-DSC-001',   name: 'דיסק בלם קדמי — פרמיום',         category: 'בלמים',       manufacturer: 'Brembo',     supplierId: sup1.id, costPrice: 140, salePrice: 240, quantity: 3,  minQuantity: 4,  location: 'מדף B2' },
    { id: 'part-5',  sku: 'ENG-OIL-5W30',  name: 'שמן מנוע 5W-30 — 4 ליטר',       category: 'שמנים',       manufacturer: 'Castrol',    supplierId: sup2.id, costPrice: 55,  salePrice: 85,  quantity: 30, minQuantity: 10, location: 'מחסן שמנים' },
    { id: 'part-6',  sku: 'ENG-OIL-0W20',  name: 'שמן מנוע 0W-20 היברידי — 4 ליטר',category: 'שמנים',      manufacturer: 'Mobil 1',    supplierId: sup2.id, costPrice: 85,  salePrice: 130, quantity: 2,  minQuantity: 5,  location: 'מחסן שמנים', notes: 'לרכבים היברידיים בלבד' },
    { id: 'part-7',  sku: 'AC-GAS-134A',   name: 'גז מקרר R-134a — 1 ק"ג',        category: 'מיזוג אוויר', manufacturer: 'DuPont',     supplierId: sup3.id, costPrice: 45,  salePrice: 90,  quantity: 7,  minQuantity: 3,  location: 'מדף C1' },
    { id: 'part-8',  sku: 'IGN-PLG-001',   name: 'מצתים — סט 4 יחידות',            category: 'מצתים',       manufacturer: 'NGK',        supplierId: sup1.id, costPrice: 60,  salePrice: 110, quantity: 15, minQuantity: 8,  location: 'מדף A3' },
    { id: 'part-9',  sku: 'TIM-BLT-001',   name: 'רצועת טיימינג עם גלגלת',         category: 'מנוע',        manufacturer: 'Gates',      supplierId: sup4.id, costPrice: 180, salePrice: 320, quantity: 2,  minQuantity: 3,  location: 'מדף D1', notes: 'כולל גלגלת מתיחה וגלגלת לחץ' },
    { id: 'part-10', sku: 'OXY-SEN-001',   name: 'חיישן חמצן — פלטינום',           category: 'חיישנים',     manufacturer: 'Bosch',      supplierId: sup4.id, costPrice: 95,  salePrice: 170, quantity: 6,  minQuantity: 4,  location: 'מדף E1' },
  ]

  for (const part of parts) {
    await prisma.part.upsert({ where: { id: part.id }, update: {}, create: { ...part, organizationId: orgId } })
  }

  // ── Work Orders ────────────────────────────────────────────────────────────
  const orders = [
    { id: 'wo-1', workOrderNumber: 'WO-2026-0001', status: 'PENDING'       as const, complaint: 'רעש חזק מהמנוע בזמן נסיעה, במיוחד בהאצה',          diagnosis: null,                                         laborHours: 2.0, laborRate: 150, partsTotal: 0,   totalPrice: 300, assignedTechnician: 'יוסי כהן',  mileage: 45200, customerId: david.id,  vehicleId: corolla.id },
    { id: 'wo-2', workOrderNumber: 'WO-2026-0002', status: 'IN_PROGRESS'   as const, complaint: 'בלמים תופסים בצד שמאל, הרגשה של משיכה בבלימה',   diagnosis: 'שחיקת רפידות בלם קדמי שמאל — נדרש החלפה',   laborHours: 1.5, laborRate: 150, partsTotal: 280, totalPrice: 505, assignedTechnician: 'אמיר דוד',  mileage: 38500, customerId: michal.id, vehicleId: mazda.id    },
    { id: 'wo-3', workOrderNumber: 'WO-2026-0003', status: 'WAITING_PARTS' as const, complaint: 'דלת נהג לא נסגרת כראוי, מאבדת אחיזה',             diagnosis: 'נדרש החלפת מנגנון נעילת דלת — חלקים הוזמנו', laborHours: 1.0, laborRate: 150, partsTotal: 450, totalPrice: 600, assignedTechnician: 'יוסי כהן',  mileage: 72300, customerId: avi.id,   vehicleId: civic.id    },
    { id: 'wo-4', workOrderNumber: 'WO-2026-0004', status: 'COMPLETED'     as const, complaint: 'שמן מנוע דולף — כתמים על הרצפה',                  diagnosis: 'נזילה מגזקת שמן — הוחלפה בהצלחה',            laborHours: 2.5, laborRate: 150, partsTotal: 120, totalPrice: 495, assignedTechnician: 'אמיר דוד',  mileage: 22100, customerId: david.id,  vehicleId: i20.id      },
    { id: 'wo-5', workOrderNumber: 'WO-2026-0005', status: 'IN_PROGRESS'   as const, complaint: 'מיזוג אוויר לא מקרר — יוצא אוויר חם בלבד',       diagnosis: 'מחסור בגז מקרר, בדיקת דליפות בביצוע',        laborHours: 3.0, laborRate: 150, partsTotal: 350, totalPrice: 800, assignedTechnician: 'רון לוי',   mileage: 45300, customerId: david.id,  vehicleId: corolla.id  },
    { id: 'wo-6', workOrderNumber: 'WO-2026-0006', status: 'COMPLETED'     as const, complaint: 'טיפול שגרתי — 40,000 ק"מ',                         diagnosis: 'הוחלפו: שמן, פילטרים, בדיקת רצועת טיימינג',  laborHours: 3.5, laborRate: 150, partsTotal: 380, totalPrice: 905, assignedTechnician: 'יוסי כהן',  mileage: 38000, customerId: michal.id, vehicleId: mazda.id    },
    { id: 'wo-7', workOrderNumber: 'WO-2026-0007', status: 'COMPLETED'     as const, complaint: 'נורת מנוע דולקת — בדיקת מחשב',                    diagnosis: 'שגיאת חיישן חמצן — הוחלף',                    laborHours: 1.0, laborRate: 150, partsTotal: 230, totalPrice: 380, assignedTechnician: 'אמיר דוד',  mileage: 60500, customerId: yaakov.id, vehicleId: 'veh-6'     },
    { id: 'wo-8', workOrderNumber: 'WO-2026-0008', status: 'PENDING'       as const, complaint: 'רעידה בהגה במהירות גבוהה',                         diagnosis: null,                                         laborHours: 1.5, laborRate: 150, partsTotal: 0,   totalPrice: 225, assignedTechnician: 'רון לוי',   mileage: 14200, customerId: sara.id,   vehicleId: sportage.id },
  ]

  for (const wo of orders) {
    await prisma.workOrder.upsert({ where: { id: wo.id }, update: {}, create: { ...wo, organizationId: orgId } })
  }

  // ── Stock Movements ────────────────────────────────────────────────────────
  const movements = [
    { id: 'mov-1',  type: 'IN'         as const, quantity: 50, reason: 'קבלת סחורה ראשונית',                   partId: 'part-1'  },
    { id: 'mov-2',  type: 'OUT'        as const, quantity: 5,  reason: 'שימוש בפקודת עבודה WO-2026-0006',       partId: 'part-1'  },
    { id: 'mov-3',  type: 'IN'         as const, quantity: 15, reason: 'קבלת סחורה ראשונית',                   partId: 'part-2'  },
    { id: 'mov-4',  type: 'OUT'        as const, quantity: 3,  reason: 'שימוש בפקודת עבודה WO-2026-0006',       partId: 'part-2'  },
    { id: 'mov-5',  type: 'IN'         as const, quantity: 12, reason: 'קבלת סחורה ראשונית',                   partId: 'part-3'  },
    { id: 'mov-6',  type: 'OUT'        as const, quantity: 4,  reason: 'שימוש בפקודת עבודה WO-2026-0002',       partId: 'part-3'  },
    { id: 'mov-7',  type: 'IN'         as const, quantity: 5,  reason: 'קבלת סחורה ראשונית',                   partId: 'part-4'  },
    { id: 'mov-8',  type: 'OUT'        as const, quantity: 2,  reason: 'שימוש בפקודת עבודה WO-2026-0002',       partId: 'part-4'  },
    { id: 'mov-9',  type: 'ADJUSTMENT' as const, quantity: -1, reason: 'תיקון ספירת מלאי',                      partId: 'part-9'  },
    { id: 'mov-10', type: 'IN'         as const, quantity: 6,  reason: 'קבלת סחורה ראשונית',                   partId: 'part-10' },
    { id: 'mov-11', type: 'OUT'        as const, quantity: 1,  reason: 'שימוש בפקודת עבודה WO-2026-0007',       partId: 'part-10' },
  ]
  for (const mov of movements) {
    await prisma.stockMovement.upsert({ where: { id: mov.id }, update: {}, create: mov })
  }

  // ── Quotes ────────────────────────────────────────────────────────────────
  const q1 = await prisma.quote.upsert({
    where: { id: 'quote-1' },
    update: {},
    create: { id: 'quote-1', organizationId: orgId, quoteNumber: 'QT-2026-0001', status: 'SENT', laborHours: 3.5, laborRate: 150, partsTotal: 735, totalPrice: 1260, notes: 'כולל טיפול שמן, פילטרים, ורפידות בלם. תוקף ל-30 יום.', validUntil: new Date('2026-06-25'), customerId: david.id, vehicleId: corolla.id },
  })
  await prisma.quoteItem.createMany({
    skipDuplicates: true,
    data: [
      { id: 'qi-1-1', description: 'החלפת שמן מנוע 5W-30', quantity: 1, unitPrice: 85,  total: 85,  quoteId: q1.id },
      { id: 'qi-1-2', description: 'פילטר שמן',            quantity: 1, unitPrice: 35,  total: 35,  quoteId: q1.id },
      { id: 'qi-1-3', description: 'פילטר אוויר',           quantity: 1, unitPrice: 95,  total: 95,  quoteId: q1.id },
      { id: 'qi-1-4', description: 'רפידות בלם קדמי',       quantity: 2, unitPrice: 160, total: 320, quoteId: q1.id },
      { id: 'qi-1-5', description: 'דיסקי בלם קדמי',        quantity: 2, unitPrice: 100, total: 200, quoteId: q1.id },
    ],
  })

  const q2 = await prisma.quote.upsert({
    where: { id: 'quote-2' },
    update: {},
    create: { id: 'quote-2', organizationId: orgId, quoteNumber: 'QT-2026-0002', status: 'APPROVED', laborHours: 2.0, laborRate: 150, partsTotal: 485, totalPrice: 785, notes: 'תיקון מיזוג אוויר — גז ומדחס.', validUntil: new Date('2026-06-10'), customerId: michal.id, vehicleId: mazda.id },
  })
  await prisma.quoteItem.createMany({
    skipDuplicates: true,
    data: [
      { id: 'qi-2-1', description: 'גז מקרר R-134a',         quantity: 2, unitPrice: 90,  total: 180, quoteId: q2.id },
      { id: 'qi-2-2', description: 'בדיקת מערכת מיזוג + איטום', quantity: 1, unitPrice: 85, total: 85,  quoteId: q2.id },
      { id: 'qi-2-3', description: 'פילטר מיזוג (קבין)',       quantity: 1, unitPrice: 220, total: 220, quoteId: q2.id },
    ],
  })

  const q3 = await prisma.quote.upsert({
    where: { id: 'quote-3' },
    update: {},
    create: { id: 'quote-3', organizationId: orgId, quoteNumber: 'QT-2026-0003', status: 'DRAFT', laborHours: 4.0, laborRate: 150, partsTotal: 540, totalPrice: 1140, notes: 'החלפת רצועת טיימינג מלאה כולל גלגלות.', validUntil: new Date('2026-07-01'), customerId: avi.id, vehicleId: civic.id },
  })
  await prisma.quoteItem.createMany({
    skipDuplicates: true,
    data: [
      { id: 'qi-3-1', description: 'רצועת טיימינג + גלגלת', quantity: 1, unitPrice: 320, total: 320, quoteId: q3.id },
      { id: 'qi-3-2', description: 'משאבת מים',              quantity: 1, unitPrice: 140, total: 140, quoteId: q3.id },
      { id: 'qi-3-3', description: 'שמן מנוע 0W-20',         quantity: 1, unitPrice: 130, total: 130, quoteId: q3.id },
      { id: 'qi-3-4', description: 'פילטר שמן',              quantity: 1, unitPrice: 35,  total: 35,  quoteId: q3.id },
      { id: 'qi-3-5', description: 'פילטר אוויר',             quantity: 1, unitPrice: 95,  total: 95,  quoteId: q3.id },
    ],
  })

  // ── Technician Notes ──────────────────────────────────────────────────────
  const noteData = [
    { id: 'note-1', workOrderId: 'wo-2', visibility: 'INTERNAL' as const, authorName: 'אמיר דוד', content: 'רפידות בלם קדמי בצד שמאל שחוקות לגמרי — 1.5mm בלבד. דיסקים במצב טוב, רק ניקוי.' },
    { id: 'note-2', workOrderId: 'wo-2', visibility: 'CUSTOMER' as const, authorName: 'אמיר דוד', content: 'מצאנו שחיקה חמורה ברפידות הבלם הקדמיות. ממליצים להחליף גם את הצד הימני למניעת בלאי לא אחיד.' },
    { id: 'note-3', workOrderId: 'wo-5', visibility: 'INTERNAL' as const, authorName: 'רון לוי',   content: 'נמצאה דליפה קטנה בצינור גז המקרר ליד הקומפרסור. מחכה לאישור לקוח לפני תיקון.' },
    { id: 'note-4', workOrderId: 'wo-1', visibility: 'INTERNAL' as const, authorName: 'יוסי כהן',  content: 'רעש מגיע מאזור הגיר — כנראה מיסב עמוד הגה. צריך בדיקה מעמיקה יותר.' },
  ]
  for (const note of noteData) {
    await prisma.technicianNote.upsert({ where: { id: note.id }, update: {}, create: note })
  }

  // ── Diagnostic Sessions ────────────────────────────────────────────────────
  const diagSessions = [
    {
      id: 'diag-1', organizationId: orgId,
      complaint: 'נורת בקרת מנוע דולקת, צריכת דלק גבוהה במיוחד — כ-12 ליטר ל-100 ק"מ',
      obdCodes: 'P0171, P0174', symptoms: 'נורת בקרת מנוע דולקת, צריכת דלק גבוהה',
      urgency: 'MEDIUM' as const, vehicleId: corolla.id, workOrderId: 'wo-1',
      aiResponse: JSON.stringify({ possibleCauses: ['תקלה במסכת אוויר', 'זיהום בחיישן MAF', 'פלאג מתדלק פגום'], recommendedTests: ['קריאת קודי שגיאה', 'בדיקת MAF', 'ריסוס קרבורטור', 'בדיקת לחץ דלק'], commonFixes: ['ניקוי MAF', 'החלפת פילטר אוויר', 'איטום דליפות'], estimatedDifficulty: 'MEDIUM', estimatedTime: '2-3 שעות', urgencyLevel: 'MEDIUM', additionalNotes: 'קודים P0171/P0174 — תערובת דלה, בדוק דליפות אוויר.' }),
    },
    {
      id: 'diag-2', organizationId: orgId,
      complaint: 'מיזוג אוויר לא מקרר — יוצא אוויר חם בלבד, קולות חריגים מהקומפרסור',
      obdCodes: null, symptoms: 'מיזוג אוויר לא קר, רעש חריג',
      urgency: 'HIGH' as const, vehicleId: mazda.id, workOrderId: 'wo-5',
      aiResponse: JSON.stringify({ possibleCauses: ['מחסור בגז מקרר', 'כשל בקומפרסור', 'תקלה בשסתום הרחבה', 'נזק לקונדנסר'], recommendedTests: ['בדיקת לחץ גז', 'בדיקת זרם לקומפרסור', 'בדיקת UV לדליפות', 'בדיקת מאוורר'], commonFixes: ['מילוי גז R-134a', 'תיקון דליפות', 'החלפת קומפרסור'], estimatedDifficulty: 'HIGH', estimatedTime: '3-5 שעות', urgencyLevel: 'HIGH', additionalNotes: 'הפסק שימוש במיזוג מיד למניעת נזק נוסף.' }),
    },
  ]
  for (const diag of diagSessions) {
    await prisma.diagnosticSession.upsert({ where: { id: diag.id }, update: {}, create: diag })
  }

  // ── Sample audit logs ──────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    skipDuplicates: true,
    data: [
      { id: 'audit-1', organizationId: orgId, userId: owner.id,      userEmail: owner.email,      userName: owner.name,      action: 'CREATE', entityType: 'customer',   entityId: 'cust-1', entityLabel: 'דוד כהן',    createdAt: new Date('2026-05-20T09:00:00Z') },
      { id: 'audit-2', organizationId: orgId, userId: advisor.id,    userEmail: advisor.email,    userName: advisor.name,    action: 'CREATE', entityType: 'workOrder',  entityId: 'wo-1',   entityLabel: 'WO-2026-0001', createdAt: new Date('2026-05-21T10:00:00Z') },
      { id: 'audit-3', organizationId: orgId, userId: technician.id, userEmail: technician.email, userName: technician.name, action: 'UPDATE', entityType: 'workOrder',  entityId: 'wo-2',   entityLabel: 'WO-2026-0002', createdAt: new Date('2026-05-22T11:30:00Z') },
      { id: 'audit-4', organizationId: orgId, userId: manager.id,    userEmail: manager.email,    userName: manager.name,    action: 'INVITE_SENT', entityType: 'invitation', entityLabel: 'tech2@garage.com', createdAt: new Date('2026-05-23T08:00:00Z') },
      { id: 'audit-5', organizationId: orgId, userId: owner.id,      userEmail: owner.email,      userName: owner.name,      action: 'SETTINGS_UPDATED', entityType: 'organization', entityId: orgId, entityLabel: 'מוסך הדגמה', createdAt: new Date('2026-05-24T14:00:00Z') },
      { id: 'audit-6', organizationId: orgId, userId: advisor.id,    userEmail: advisor.email,    userName: advisor.name,    action: 'CREATE', entityType: 'quote',      entityId: 'quote-1', entityLabel: 'QT-2026-0001', createdAt: new Date('2026-05-25T09:30:00Z') },
    ],
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // David Malka Service Book — 20 vehicles × 5 intervals (15k/30k/60k/90k/120k)
  // ══════════════════════════════════════════════════════════════════════════════
  // Clean slate — delete all previous schedules (cascades to items)
  await prisma.maintenanceSchedule.deleteMany({})

  type Priority = 'REQUIRED' | 'RECOMMENDED' | 'SAFETY'
  type SeedItem = {
    id: string; category: string; nameHe: string
    quantity: number; unitPrice: number; laborHours: number
    required: boolean; priority: Priority
    notes?: string; sortOrder: number
  }

  // ── Item factory ─────────────────────────────────────────────────────────────
  interface VehicleOpts {
    oilName?:          string
    oilLiters?:        number
    oilPrice?:         number
    sparkPlugPrice?:   number
    glowPlugPrice?:    number
    hasTimingBelt?:    boolean
    isVan?:            boolean   // Ducato / Sprinter / Master → heavier schedule
    skipGearbox120k?:  boolean
  }

  function buildItems(
    schedId:     string,
    fuelType:    string,
    intervalKm:  number,
    opts:        VehicleOpts = {},
  ): SeedItem[] {
    const isDiesel  = fuelType === 'DIESEL'
    const isHybrid  = fuelType === 'HYBRID'

    const oilName   = opts.oilName   ?? (isDiesel ? 'שמן מנוע 5W-40 דיזל' : isHybrid ? 'שמן מנוע 0W-20 היברידי' : 'שמן מנוע 5W-30 בנזין')
    const oilLiters = opts.oilLiters ?? (opts.isVan ? 7 : isDiesel ? 6 : isHybrid ? 4.5 : 5)
    const oilPrice  = opts.oilPrice  ?? (opts.isVan ? 310 : isDiesel ? 245 : isHybrid ? 265 : 190)
    const p = `${schedId}`                // item ID prefix = schedule ID

    const items: SeedItem[] = []

    // Oil — every service
    items.push({ id: `${p}-oil`, category: 'OIL',
      nameHe: `${oilName} (${oilLiters} ליטר)`,
      quantity: 1, unitPrice: oilPrice, laborHours: 0,
      required: true, priority: 'REQUIRED', sortOrder: 1 })

    // Oil filter — every service; carries the oil-change labour at 15k
    items.push({ id: `${p}-foil`, category: 'FILTER_OIL', nameHe: 'פילטר שמן',
      quantity: 1, unitPrice: isDiesel ? 55 : 45,
      laborHours: intervalKm === 15000 ? 0.5 : 0.15,
      required: true, priority: 'REQUIRED', sortOrder: 2 })

    // Air + cabin filters — 30k+
    if (intervalKm >= 30000) {
      items.push({ id: `${p}-fair`, category: 'FILTER_AIR', nameHe: 'פילטר אוויר',
        quantity: 1, unitPrice: opts.isVan ? 120 : 85, laborHours: 0.15,
        required: true, priority: 'REQUIRED', sortOrder: 3 })
      items.push({ id: `${p}-fcab`, category: 'FILTER_CABIN',
        nameHe: isHybrid ? 'פילטר קבין HEPA' : 'פילטר קבין',
        quantity: 1, unitPrice: isHybrid ? 120 : opts.isVan ? 95 : 80, laborHours: 0.15,
        required: true, priority: 'REQUIRED', sortOrder: 4 })
    }

    // Diesel fuel filter — 60k+
    if (intervalKm >= 60000 && isDiesel) {
      items.push({ id: `${p}-ffuel`, category: 'FILTER_FUEL', nameHe: 'פילטר דלק (דיזל)',
        quantity: 1, unitPrice: opts.isVan ? 160 : 120, laborHours: 0.25,
        required: true, priority: 'REQUIRED', sortOrder: 5 })
    }

    // Spark plugs / glow plugs
    //  - Gasoline: 60k, 90k, 120k
    //  - Diesel glow plugs: 60k, 120k only
    //  - Hybrid spark plugs: 120k only (iridium longevity)
    const addSpark = !isDiesel && !isHybrid && intervalKm >= 60000
    const addGlow  = isDiesel && (intervalKm === 60000 || intervalKm === 120000)
    const addHybPlug = isHybrid && intervalKm === 120000

    if (addSpark) {
      items.push({ id: `${p}-plugs`, category: 'SPARK_PLUGS',
        nameHe: 'מצתים (סט 4)',
        quantity: 1, unitPrice: opts.sparkPlugPrice ?? 280, laborHours: 0.5,
        required: true, priority: 'REQUIRED', sortOrder: 6 })
    }
    if (addGlow) {
      items.push({ id: `${p}-glow`, category: 'GLOW_PLUGS', nameHe: 'נרות לבה — סט 4',
        quantity: 1, unitPrice: opts.glowPlugPrice ?? 320, laborHours: 0.5,
        required: true, priority: 'REQUIRED', sortOrder: 6 })
    }
    if (addHybPlug) {
      items.push({ id: `${p}-plugs`, category: 'SPARK_PLUGS',
        nameHe: 'מצתי אירידיום (סט 4) — היברידי',
        quantity: 1, unitPrice: 380, laborHours: 0.5,
        required: true, priority: 'REQUIRED', sortOrder: 6,
        notes: 'מצתי אירידיום — אורך חיים 120,000 ק״מ לרכב היברידי' })
    }

    // Brake fluid — 60k+
    if (intervalKm >= 60000) {
      items.push({ id: `${p}-brake`, category: 'BRAKE_FLUID',
        nameHe: isHybrid ? 'נוזל בלמים DOT 3' : 'נוזל בלמים DOT 4',
        quantity: 1, unitPrice: 65, laborHours: 0.2,
        required: true, priority: 'REQUIRED', sortOrder: 7 })
    }

    // Gearbox oil — 120k
    if (intervalKm === 120000 && !opts.skipGearbox120k) {
      items.push({ id: `${p}-gearbox`, category: 'GEARBOX_OIL',
        nameHe: isHybrid ? 'שמן E-CVT' : isDiesel ? 'שמן גיר אוטומטי' : 'שמן גיר',
        quantity: 1, unitPrice: isDiesel ? 180 : 160, laborHours: 0.5,
        required: true, priority: 'REQUIRED', sortOrder: 8 })
    }

    // Timing belt — 120k for belt-driven engines
    if (intervalKm === 120000 && opts.hasTimingBelt) {
      items.push({ id: `${p}-tbelt`, category: 'TIMING_BELT',
        nameHe: 'רצועת תזמון + גלגלות',
        quantity: 1, unitPrice: opts.isVan ? 950 : 580, laborHours: 2.0,
        required: true, priority: 'REQUIRED', sortOrder: 9,
        notes: 'בדוק קוד מנוע והוראות יצרן לאישור — חובה לפני שליחה ללקוח' })
    }

    // Inspection — always last
    const inspHours =
      intervalKm === 15000  ? 0.25 :
      intervalKm === 30000  ? 0.5  :
      intervalKm === 120000 ? 1.0  : 0.4

    items.push({ id: `${p}-insp`, category: 'INSPECTION',
      nameHe: intervalKm >= 60000
        ? (opts.isVan
            ? 'בדיקת מתלים, בלמים, גומיות, נוזלים ואביזרי בטיחות'
            : 'בדיקת מתלים, בלמים, גומיות ונוזלים')
        : 'בדיקה ויזואלית ורמות נוזלים',
      quantity: 1, unitPrice: 0, laborHours: inspHours,
      required: true, priority: 'REQUIRED', sortOrder: 20 })

    return items
  }

  // ── Advisor / Safety items factory (RECOMMENDED + SAFETY) ────────────────────
  function buildAdvisorItems(schedId: string, fuelType: string): SeedItem[] {
    const isGasOrHybrid = fuelType === 'GASOLINE' || fuelType === 'HYBRID'
    const p = schedId
    return [
      // ── RECOMMENDED ──────────────────────────────────────────────────────────
      { id: `${p}-rec-bat`, category: 'BATTERY', nameHe: 'בדיקת מצבר ועיבוי מוליכים',
        quantity: 1, unitPrice: 45, laborHours: 0.25, required: false, priority: 'RECOMMENDED', sortOrder: 30,
        notes: 'ממוצע חיי מצבר 4-5 שנים — מומלץ בדיקה ב-60,000 ק״מ' },
      { id: `${p}-rec-align`, category: 'ALIGNMENT', nameHe: 'בדיקת יישור גלגלים',
        quantity: 1, unitPrice: 95, laborHours: 0.5, required: false, priority: 'RECOMMENDED', sortOrder: 31,
        notes: 'מאריך חיי צמיגים — מומלץ כל 30,000 ק״מ' },
      { id: `${p}-rec-inject`,
        category: isGasOrHybrid ? 'INJECTOR_CLEAN' : 'FILTER_FUEL',
        nameHe:   isGasOrHybrid ? 'ניקוי מזרקי דלק בלחץ (GDI)' : 'בדיקת מערכת AdBlue / SCR',
        quantity: 1, unitPrice: isGasOrHybrid ? 180 : 90, laborHours: isGasOrHybrid ? 0.75 : 0.25,
        required: false, priority: 'RECOMMENDED', sortOrder: 32,
        notes: isGasOrHybrid
          ? 'מונע הצטברות פחם על שסתומים — מומלץ במנועי GDI/TSI/TFSI'
          : 'בדיקת אינדיקטור AdBlue ומילוי אם נדרש' },
      // ── SAFETY ───────────────────────────────────────────────────────────────
      { id: `${p}-saf-pads`, category: 'BRAKE_PADS', nameHe: 'רפידות בלם קדמיות — מוחלפות אם מתחת ל-3מ״מ',
        quantity: 1, unitPrice: 320, laborHours: 1.5, required: false, priority: 'SAFETY', sortOrder: 60,
        notes: 'גבול מינימלי לפי תקן: 2מ״מ — נדרשת בדיקה פיזית' },
      { id: `${p}-saf-tires`, category: 'TIRES', nameHe: 'צמיגים — פחות מ-1.6מ״מ חריץ מחייב החלפה',
        quantity: 1, unitPrice: 0, laborHours: 0.25, required: false, priority: 'SAFETY', sortOrder: 61,
        notes: 'חריץ מינימלי חוקי: 1.6מ״מ — בדיקה חיונית לפני חורף' },
      { id: `${p}-saf-susp`, category: 'SUSPENSION', nameHe: 'גומיות מתלים סדוקות — פגיעה ביציבות הרכב',
        quantity: 1, unitPrice: 180, laborHours: 0.75, required: false, priority: 'SAFETY', sortOrder: 62,
        notes: 'גומיות שחוקות גורמות לרעש ולחוסר יציבות בתנועה' },
    ]
  }

  // ── Schedule upsert helper ────────────────────────────────────────────────────
  async function upsertSchedule(
    id:   string,
    spec: {
      make: string; model: string
      yearFrom: number; yearTo: number
      fuelType?: string; transmission?: string
      intervalKm: number; notes?: string
    },
    items: SeedItem[],
  ) {
    await prisma.maintenanceSchedule.upsert({
      where:  { id },
      update: { notes: spec.notes ?? null },
      create: { id, ...spec },
    })
    for (const item of items) {
      await prisma.maintenanceItem.upsert({
        where:  { id: item.id },
        update: { priority: item.priority },
        create: { ...item, scheduleId: id },
      })
    }
  }

  // ── Per-vehicle seeding (all 5 intervals) ─────────────────────────────────────
  interface VehicleDef {
    prefix:       string          // used as schedule ID base: sched-{prefix}-{km}k
    make:         string
    model:        string
    yearFrom:     number
    yearTo:       number
    fuelType:     string
    transmission?: string
    opts:         VehicleOpts
    notes?:       Record<number, string>
  }

  async function seedVehicle(v: VehicleDef) {
    const kms = [15000, 30000, 60000, 90000, 120000] as const
    for (const km of kms) {
      const schedId = `sched-${v.prefix}-${km / 1000}k`
      const required = buildItems(schedId, v.fuelType, km, v.opts)
      const advisor  = km >= 60000 ? buildAdvisorItems(schedId, v.fuelType) : []
      await upsertSchedule(schedId, {
        make:         v.make,
        model:        v.model,
        yearFrom:     v.yearFrom,
        yearTo:       v.yearTo,
        fuelType:     v.fuelType,
        transmission: v.transmission,
        intervalKm:   km,
        notes:        v.notes?.[km / 1000],
      }, [...required, ...advisor])
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Vehicle definitions — 20 common Israeli cars + 3 generic fallbacks
  // ═══════════════════════════════════════════════════════════════════════════

  const VEHICLES: VehicleDef[] = [
    // 1. Skoda Octavia 2018–2023 Gasoline (TSI / MHEV)
    {
      prefix: 'skoda-octavia-gas', make: 'Skoda', model: 'Octavia',
      yearFrom: 2018, yearTo: 2023, fuelType: 'GASOLINE', transmission: 'AUTOMATIC',
      opts: { sparkPlugPrice: 280 },
      notes: {
        60: 'TSI/MHEV — מצתי אירידיום נדרשים. נוזל בלמים DOT 4 — בדיקה כל 2 שנים.',
        120: 'בדיקת שרשרת תזמון — שרשרת, לא דורשת החלפה בד״כ אך יש לאמת מתח.',
      },
    },
    // 2. Skoda Octavia 2018–2023 Diesel (TDI)
    {
      prefix: 'skoda-octavia-diesel', make: 'Skoda', model: 'Octavia',
      yearFrom: 2018, yearTo: 2023, fuelType: 'DIESEL', transmission: 'AUTOMATIC',
      opts: { glowPlugPrice: 320 },
      notes: { 60: 'TDI — פילטר דלק + נרות לבה נדרשים ב-60 אלף ק״מ.' },
    },
    // 3. Toyota Corolla Hybrid 2019–2024
    {
      prefix: 'corolla-hybrid', make: 'Toyota', model: 'Corolla',
      yearFrom: 2019, yearTo: 2024, fuelType: 'HYBRID', transmission: 'CVT',
      opts: { oilName: 'שמן מנוע 0W-20 Toyota Genuine', oilLiters: 4.5, oilPrice: 265 },
      notes: {
        60: 'היברידי — שמן 0W-20 בלבד. מצתי אירידיום מוחלפים ב-120,000 ק״מ. בדיקת מערכת בלמים רגנרטיבית.',
        120: 'החלפת שמן E-CVT + בדיקת ממשק HV בידוי ביחידת שירות מורשה Toyota.',
      },
    },
    // 4. Toyota Corolla 2014–2019 Gasoline (non-hybrid)
    {
      prefix: 'corolla-gas-old', make: 'Toyota', model: 'Corolla',
      yearFrom: 2014, yearTo: 2019, fuelType: 'GASOLINE', transmission: 'AUTOMATIC',
      opts: { oilPrice: 185, sparkPlugPrice: 260 },
      notes: { 120: 'בדיקת שרשרת תזמון + מתמר מומנט. מנוע 1.6 / 1.8 — שרשרת בד״כ.' },
    },
    // 5. Kia Sportage 2021–2024 Gasoline (T-GDI)
    {
      prefix: 'sportage-gas', make: 'Kia', model: 'Sportage',
      yearFrom: 2021, yearTo: 2024, fuelType: 'GASOLINE', transmission: 'AUTOMATIC',
      opts: { sparkPlugPrice: 260, oilPrice: 210 },
      notes: { 60: 'T-GDI 1.6 — ניקוי מזרקים מומלץ. DCT — שמן גיר מומלץ ב-60,000 ק״מ.' },
    },
    // 6. Kia Sportage 2019–2023 Diesel (CRDi)
    {
      prefix: 'sportage-diesel', make: 'Kia', model: 'Sportage',
      yearFrom: 2019, yearTo: 2023, fuelType: 'DIESEL', transmission: 'AUTOMATIC',
      opts: { hasTimingBelt: false, glowPlugPrice: 300 },
      notes: { 60: 'CRDi 2.0 — פילטר דלק חובה. AdBlue לרכבי Euro 6.' },
    },
    // 7. Hyundai Tucson 2015–2021 Gasoline
    {
      prefix: 'tucson-gas', make: 'Hyundai', model: 'Tucson',
      yearFrom: 2015, yearTo: 2021, fuelType: 'GASOLINE', transmission: 'AUTOMATIC',
      opts: { sparkPlugPrice: 260, oilPrice: 195 },
      notes: { 60: 'GDi 2.0 / T-GDI — מצתים נדרשים. בדיקת גומיות מתלים אחורי.' },
    },
    // 8. Mazda 3 2017–2021 Gasoline (SkyActiv)
    {
      prefix: 'mazda3-gas', make: 'Mazda', model: '3',
      yearFrom: 2017, yearTo: 2021, fuelType: 'GASOLINE', transmission: 'AUTOMATIC',
      opts: { oilName: 'שמן מנוע 5W-30 SkyActiv', oilPrice: 195, sparkPlugPrice: 270 },
      notes: { 60: 'SkyActiv-G — מצתי NGK Iridium מומלצים. שמן מנוע ILSAC GF-5 / GF-6.' },
    },
    // 9. Nissan Qashqai 2014–2021 Diesel (dCi)
    {
      prefix: 'qashqai-diesel', make: 'Nissan', model: 'Qashqai',
      yearFrom: 2014, yearTo: 2021, fuelType: 'DIESEL', transmission: 'MANUAL',
      opts: { hasTimingBelt: true, glowPlugPrice: 290 },
      notes: {
        60: 'dCi 1.5/1.6 — רצועת תזמון ב-120,000 ק״מ. פילטר דלק חובה.',
        120: 'רצועת תזמון — בדוק קוד מנוע (K9K / R9M). החלפה חובה.',
      },
    },
    // 10. Renault Megane 2015–2020 Diesel (dCi)
    {
      prefix: 'megane-diesel', make: 'Renault', model: 'Megane',
      yearFrom: 2015, yearTo: 2020, fuelType: 'DIESEL', transmission: 'MANUAL',
      opts: { hasTimingBelt: true, glowPlugPrice: 290 },
      notes: {
        60: 'dCi 1.5 — פילטר דלק + נרות לבה. AdBlue לדגמי Euro 6.',
        120: 'רצועת תזמון K9K — החלפה חובה ב-120,000 ק״מ.',
      },
    },
    // 11. Subaru Forester 2019–2024 Gasoline (CVT)
    {
      prefix: 'forester-gas', make: 'Subaru', model: 'Forester',
      yearFrom: 2019, yearTo: 2024, fuelType: 'GASOLINE', transmission: 'CVT',
      opts: { oilName: 'שמן מנוע 0W-20 Subaru', oilPrice: 200, sparkPlugPrice: 300 },
      notes: {
        60: 'FB20 — שמן Subaru Genuine 0W-20. בדיקת שמן CVT Lineartronic.',
        120: 'בדיקת שמן פיר ראשי מנוע Boxer — אטימות תחתית.',
      },
    },
    // 12. Fiat Ducato 2014–2021 Diesel (van — timing belt!)
    {
      prefix: 'ducato-diesel', make: 'Fiat', model: 'Ducato',
      yearFrom: 2014, yearTo: 2021, fuelType: 'DIESEL', transmission: 'MANUAL',
      opts: { isVan: true, hasTimingBelt: true, glowPlugPrice: 350, oilLiters: 8 },
      notes: {
        60: 'MultiJet — פילטר דלק + נרות לבה. רצועת תזמון ב-120,000 ק״מ.',
        120: 'רצועת תזמון MultiJet חובה. בדיקת קיט השבה EGR + DPF.',
      },
    },
    // 13. Renault Master 2011–2019 Diesel (van)
    {
      prefix: 'master-diesel', make: 'Renault', model: 'Master',
      yearFrom: 2011, yearTo: 2019, fuelType: 'DIESEL', transmission: 'MANUAL',
      opts: { isVan: true, hasTimingBelt: true, glowPlugPrice: 320 },
      notes: {
        60: 'dCi G9U / M9R — פילטר דלק נדרש. רצועת תזמון ב-120,000 ק״מ.',
        120: 'רצועת תזמון + מסנן DPF — בדיקה לפי מכשיר אבחון.',
      },
    },
    // 14. Citroen Berlingo 2008–2018 Diesel
    {
      prefix: 'berlingo-diesel', make: 'Citroen', model: 'Berlingo',
      yearFrom: 2008, yearTo: 2018, fuelType: 'DIESEL', transmission: 'MANUAL',
      opts: { hasTimingBelt: true, glowPlugPrice: 280 },
      notes: {
        60: 'HDi 1.6 — רצועת תזמון ב-120,000 ק״מ. פילטר DPF לבדיקה.',
        120: 'רצועת תזמון PSA HDi — בדוק גרסת EP6 / DW10.',
      },
    },
    // 15. Dodge Ram 2019–2024 6.7L Cummins Diesel (heavy duty)
    {
      prefix: 'dodge-ram-diesel', make: 'Dodge', model: 'Ram',
      yearFrom: 2019, yearTo: 2024, fuelType: 'DIESEL', transmission: 'AUTOMATIC',
      opts: {
        isVan: false,
        oilName: 'שמן מנוע 15W-40 Cummins (12 ליטר)', oilLiters: 12, oilPrice: 520,
        glowPlugPrice: 480, skipGearbox120k: false,
      },
      notes: {
        15: 'Cummins 6.7 — שמן Fleetguard ES Compleat 15W-40. פילטר שמן + פילטר דלק בנפרד.',
        60: 'Cummins 6.7 — פילטר דלק Racor + נרות לבה + AdBlue DEF.',
        120: 'Cummins 6.7 — בדיקת EGR, DPF, SCR. הפעלת DPF Regen לפי מד.',
      },
    },
    // 16. Mercedes Sprinter 2018–2024 Diesel
    {
      prefix: 'sprinter-diesel', make: 'Mercedes', model: 'Sprinter',
      yearFrom: 2018, yearTo: 2024, fuelType: 'DIESEL', transmission: 'MANUAL',
      opts: { isVan: true, hasTimingBelt: true, glowPlugPrice: 380, oilPrice: 330 },
      notes: {
        60: 'OM651 / OM654 — SCR AdBlue + DPF. פילטר דלק + נרות לבה.',
        120: 'רצועת תזמון OM651 — בדוק מודל מנוע מול תעודת רכב.',
      },
    },
    // 17. Hyundai i20 2015–2022 Gasoline
    {
      prefix: 'i20-gas', make: 'Hyundai', model: 'i20',
      yearFrom: 2015, yearTo: 2022, fuelType: 'GASOLINE', transmission: 'MANUAL',
      opts: { sparkPlugPrice: 220, oilPrice: 175, oilLiters: 4 },
      notes: { 60: 'Kappa G4LD 1.2 — מצתי NGK. שמן 5W-30 SP בלבד.' },
    },
    // 18. Dacia Duster 2018–2022 Diesel (dCi)
    {
      prefix: 'duster-diesel', make: 'Dacia', model: 'Duster',
      yearFrom: 2018, yearTo: 2022, fuelType: 'DIESEL', transmission: 'MANUAL',
      opts: { hasTimingBelt: true, glowPlugPrice: 270 },
      notes: {
        60: 'dCi K9K — פילטר דלק + נרות לבה. AdBlue לדגמי Euro 6.',
        120: 'רצועת תזמון K9K — החלפה חובה ב-120,000 ק״מ.',
      },
    },
    // 19. Skoda Kodiaq 2017–2022 Gasoline (TSI DSG)
    {
      prefix: 'kodiaq-gas', make: 'Skoda', model: 'Kodiaq',
      yearFrom: 2017, yearTo: 2022, fuelType: 'GASOLINE', transmission: 'AUTOMATIC',
      opts: { sparkPlugPrice: 290, oilPrice: 200 },
      notes: {
        60: 'TSI 1.5 / 2.0 — מצתים נדרשים. שמן DSG 7 — מומלץ בדיקה.',
        120: 'בדיקת שרשרת תזמון + מגן עצמי של גיר DSG.',
      },
    },
    // 20. Nissan X-Trail 2014–2021 Diesel (dCi)
    {
      prefix: 'xtrail-diesel', make: 'Nissan', model: 'X-Trail',
      yearFrom: 2014, yearTo: 2021, fuelType: 'DIESEL', transmission: 'CVT',
      opts: { hasTimingBelt: true, glowPlugPrice: 290 },
      notes: {
        60: 'R9M 1.6 dCi — פילטר דלק + נרות לבה. AdBlue נדרש.',
        120: 'רצועת תזמון R9M — החלפה חובה ב-120,000 ק״מ.',
      },
    },
    // Bonus 21. Subaru XV 2017–2023 Gasoline (CVT)
    {
      prefix: 'subaru-xv-gas', make: 'Subaru', model: 'XV',
      yearFrom: 2017, yearTo: 2023, fuelType: 'GASOLINE', transmission: 'CVT',
      opts: { oilName: 'שמן מנוע 0W-20 Subaru', oilPrice: 200, sparkPlugPrice: 290 },
      notes: {
        60: 'FB20 Boxer — שמן Subaru Genuine 0W-20. CVT Lineartronic — בדיקת שמן.',
        120: 'אטימות תחתית מנוע Boxer + בדיקת שמן CVT.',
      },
    },
  ]

  // ── Seed all vehicle-specific schedules ───────────────────────────────────────
  for (const v of VEHICLES) {
    await seedVehicle(v)
  }

  // ── Generic fallback schedules (3 fuel types × 5 intervals) ──────────────────
  const GENERICS = [
    { fuelType: 'GASOLINE', notes: { 60: 'לוח זמנים כללי לבנזין — לא נמצאה התאמה ספציפית.' } },
    { fuelType: 'DIESEL',   notes: { 60: 'לוח זמנים כללי לדיזל — לא נמצאה התאמה ספציפית.' } },
    { fuelType: 'HYBRID',   notes: { 60: 'לוח זמנים כללי להיברידי — לא נמצאה התאמה ספציפית.' } },
  ]

  for (const g of GENERICS) {
    await seedVehicle({
      prefix:   `generic-${g.fuelType.toLowerCase()}`,
      make:     '__generic__',
      model:    '__generic__',
      yearFrom: 1990,
      yearTo:   2035,
      fuelType: g.fuelType,
      opts:     {},
      notes:    g.notes,
    })
  }

  // ── Quote Requests (PERIODIC_SERVICE demo records) ───────────────────────
  // Requires dedicated work orders so the workOrderId unique constraint is met.

  // WO for Skoda Octavia 2018 (veh-9) — gasoline, 88,000 km → generic fallback demo
  await prisma.workOrder.upsert({
    where: { id: 'wo-qr-1' },
    update: {},
    create: {
      id: 'wo-qr-1', organizationId: orgId,
      workOrderNumber: 'WO-2026-0101',
      status: 'PENDING',
      complaint: 'טיפול תקופתי — 90,000 ק״מ',
      laborHours: 0, laborRate: 295, partsTotal: 0, totalPrice: 0,
      mileage: 90000,
      customerId: david.id, vehicleId: 'veh-9',
    },
  })
  await prisma.quoteRequest.upsert({
    where:  { id: 'qr-1' },
    update: {},
    create: {
      id: 'qr-1', organizationId: orgId,
      workOrderId: 'wo-qr-1',
      serviceType: 'PERIODIC_SERVICE',
      description: 'טיפול תקופתי — 90,000 ק״מ. שמן, פילטרים ומצתים.',
      urgency: 'NORMAL',
      status: 'PENDING',
    },
  })

  // WO for Kia Sportage 2022 (veh-5) — GASOLINE, specific schedule match
  await prisma.workOrder.upsert({
    where: { id: 'wo-qr-2' },
    update: {},
    create: {
      id: 'wo-qr-2', organizationId: orgId,
      workOrderNumber: 'WO-2026-0102',
      status: 'PENDING',
      complaint: 'טיפול תקופתי — 60,000 ק״מ',
      laborHours: 0, laborRate: 295, partsTotal: 0, totalPrice: 0,
      mileage: 60000,
      customerId: sara.id, vehicleId: sportage.id,
    },
  })
  await prisma.quoteRequest.upsert({
    where:  { id: 'qr-2' },
    update: {},
    create: {
      id: 'qr-2', organizationId: orgId,
      workOrderId: 'wo-qr-2',
      serviceType: 'PERIODIC_SERVICE',
      description: 'טיפול תקופתי — 60,000 ק״מ. ספורטאג׳ — בקשת לקוח.',
      urgency: 'NORMAL',
      status: 'PENDING',
    },
  })

  // WO for Toyota Corolla 2019 (veh-1) — GASOLINE (specific Toyota Corolla schedule)
  await prisma.workOrder.upsert({
    where: { id: 'wo-qr-3' },
    update: {},
    create: {
      id: 'wo-qr-3', organizationId: orgId,
      workOrderNumber: 'WO-2026-0103',
      status: 'PENDING',
      complaint: 'טיפול תקופתי — 60,000 ק״מ',
      laborHours: 0, laborRate: 295, partsTotal: 0, totalPrice: 0,
      mileage: 62000,
      customerId: david.id, vehicleId: corolla.id,
    },
  })
  await prisma.quoteRequest.upsert({
    where:  { id: 'qr-3' },
    update: {},
    create: {
      id: 'qr-3', organizationId: orgId,
      workOrderId: 'wo-qr-3',
      serviceType: 'PERIODIC_SERVICE',
      description: 'טיפול תקופתי — 62,000 ק״מ. קורולה — כולל בדיקת רצועת טיימינג.',
      urgency: 'NORMAL',
      status: 'PENDING',
    },
  })

  console.log('✓ Seed complete — org: מוסך הדגמה')
  console.log('  Users (all password: admin123):')
  console.log('    owner@garage.com        → OWNER')
  console.log('    manager@garage.com      → MANAGER')
  console.log('    tech@garage.com         → TECHNICIAN')
  console.log('    advisor@garage.com      → SERVICE_ADVISOR')
  console.log('    accountant@garage.com   → ACCOUNTANT')
  console.log('  Data: 6 customers, 10 vehicles, 8 work orders, 4 suppliers, 10 parts, 3 quotes, 4 notes, 2 diagnostics, 6 audit entries')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
