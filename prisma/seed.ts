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
