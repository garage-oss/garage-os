# GarageOS — Pilot Tracker

**Goal:** 5 real customers of מרכז שירות דוד מלכה using GarageOS and providing feedback  
**Updated:** 2026-11-11  
**Status:** 🔴 NOT STARTED — blocked on SMS + NESHER sync

---

## Pilot Acceptance Criteria

The pilot is complete ONLY when ALL of the following are verified:

- [ ] 5 real customers manually approved by owner
- [ ] All 5 received approved invitations
- [ ] All 5 logged in successfully (OTP via SMS)
- [ ] All 5 see only their own vehicles
- [ ] All 5 verified their service history (NESHER data)
- [ ] All 5 tested quotation flow
- [ ] All 5 tested appointment booking
- [ ] Document upload tested (optional feature)
- [ ] Feedback collected from all 5
- [ ] Critical issues fixed
- [ ] Production stable throughout
- [ ] NESHER remained read-only throughout

---

## Customer Slots

### Customer 1
| Field | Value |
|-------|-------|
| Name | _Not yet selected_ |
| Phone | — |
| NESHER CLI No | — |
| Vehicles | — |
| Invited | ⬜ |
| Logged in | ⬜ |
| Saw vehicles | ⬜ |
| Saw history | ⬜ |
| Tested quotes | ⬜ |
| Tested booking | ⬜ |
| Feedback | ⬜ |
| Notes | — |

### Customer 2
| Field | Value |
|-------|-------|
| Name | _Not yet selected_ |
| Phone | — |
| NESHER CLI No | — |
| Vehicles | — |
| Invited | ⬜ |
| Logged in | ⬜ |
| Saw vehicles | ⬜ |
| Saw history | ⬜ |
| Tested quotes | ⬜ |
| Tested booking | ⬜ |
| Feedback | ⬜ |
| Notes | — |

### Customer 3
| Field | Value |
|-------|-------|
| Name | _Not yet selected_ |
| Phone | — |
| NESHER CLI No | — |
| Vehicles | — |
| Invited | ⬜ |
| Logged in | ⬜ |
| Saw vehicles | ⬜ |
| Saw history | ⬜ |
| Tested quotes | ⬜ |
| Tested booking | ⬜ |
| Feedback | ⬜ |
| Notes | — |

### Customer 4
| Field | Value |
|-------|-------|
| Name | _Not yet selected_ |
| Phone | — |
| NESHER CLI No | — |
| Vehicles | — |
| Invited | ⬜ |
| Logged in | ⬜ |
| Saw vehicles | ⬜ |
| Saw history | ⬜ |
| Tested quotes | ⬜ |
| Tested booking | ⬜ |
| Feedback | ⬜ |
| Notes | — |

### Customer 5
| Field | Value |
|-------|-------|
| Name | _Not yet selected_ |
| Phone | — |
| NESHER CLI No | — |
| Vehicles | — |
| Invited | ⬜ |
| Logged in | ⬜ |
| Saw vehicles | ⬜ |
| Saw history | ⬜ |
| Tested quotes | ⬜ |
| Tested booking | ⬜ |
| Feedback | ⬜ |
| Notes | — |

---

## Pilot Timeline

| Phase | Target | Status |
|-------|--------|--------|
| SMS configured | ASAP | ❌ Blocked |
| NESHER connector deployed | ASAP | ❌ Blocked |
| Staff login working | ASAP | ❌ Blocked |
| NESHER full sync | After above | ⬜ |
| 5 customers selected | After sync | ⬜ |
| E2E test with owner | After sync | ⬜ |
| Invitations sent | After E2E test | ⬜ |
| All 5 onboarded | Within 1 week of invite | ⬜ |
| Feedback collected | Within 2 weeks of invite | ⬜ |
| Critical issues fixed | Before closing pilot | ⬜ |

---

## Customer Selection Criteria (for Owner Reference)

When selecting pilot customers from the NESHER database, prefer customers who:
1. **Have a valid mobile phone number** — pilot login requires SMS OTP
2. **Have service history** — at least 2-3 past visits, so the portal has data to show
3. **Have at least 1 vehicle registered** — the vehicles page should show something
4. **Are comfortable with technology** — can receive SMS and use a web link on mobile
5. **Are regular customers** — relationship exists, so they're likely to give honest feedback
6. **Have diverse vehicle types** — mix of different makes/models for better test coverage

**Selection process:**
1. Run NESHER sync first (brings customers into GarageOS)
2. Go to Dashboard → Customers → filter by those with phone numbers + service history
3. Tell AI which 5 customers you've selected (name + phone)
4. AI will add them to CustomerPilot table (requires explicit approval)
5. AI will prepare personalized invitation messages in Hebrew
6. Owner reviews and approves each message before sending

---

## Invitation Template (Hebrew)

```
שלום [שם לקוח],

אנחנו שמחים להזמין אותך לנסות את מערכת הלקוחות החדשה שלנו ב-מרכז שירות דוד מלכה.

דרך המערכת תוכל/י:
• לצפות בהיסטוריית השירות של הרכב/ים שלך
• לבקש הצעת מחיר לתיקון
• לקבוע תור נוח

לכניסה: https://garage-os-eta.vercel.app/portal/login
הזן/י את מספר הטלפון שלך וקבל/י קוד כניסה ב-SMS.

נשמח לשמוע מה דעתך!

[חתימה]
```

---

## Feedback Questions

After pilot customers have used the system, collect feedback on:

1. **כניסה (Login):** האם הכניסה עם SMS הייתה קלה ונוחה?
2. **רכבים (Vehicles):** האם ראית את הרכב/ים שלך? האם הפרטים נכונים?
3. **היסטוריה (History):** האם ראית את היסטוריית השירות שלך? האם הנתונים מדויקים?
4. **הצעת מחיר (Quotes):** האם ניסית לבקש הצעת מחיר? האם התהליך היה ברור?
5. **תור (Booking):** האם ניסית לקבוע תור? האם היה נוח?
6. **כללי (Overall):** מה הדבר הטוב ביותר? מה היית משפר?
7. **המלצה:** האם תמליץ לחבר להשתמש במערכת?
