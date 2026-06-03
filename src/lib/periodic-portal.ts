/**
 * Shared types for the periodic-service quote portal view.
 * Stored as `Quote.periodicData` (Json?) and rendered in the customer portal.
 */

export type PeriodicItemData = {
  nameHe:     string
  unitPrice:  number
  quantity:   number
  laborHours: number
  category:   string
  notes?:     string
}

export type PeriodicPortalData = {
  vehicleName:        string            // "קיה ספורטאג׳ 2022"
  mileage:            number            // current km reading
  intervalLabel:      string            // "טיפול 60,000 ק״מ"
  laborRate:          number            // e.g. 295
  required:           PeriodicItemData[]
  recommended:        PeriodicItemData[]
  safety:             PeriodicItemData[]
  initialRecommended: number[]          // indices garage selected in PeriodicServicePanel
  initialSafety:      number[]          // indices garage selected
}
