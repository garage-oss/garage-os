/**
 * Read-only queries against the NESHER SQL Server database.
 * Uses the shared Hanesher connection pool (same server / credentials).
 */

import { query } from '@/lib/mssql'

export interface NesherClient {
  id: number
  cli_no: string | null
  cli_name: string | null
  cli_addr: string | null
  cli_city: string | null
  cli_phone: string | null
  cli_pele: string | null
  cli_email: string | null
  cli_note: string | null
}

export interface NesherCar {
  LINE_ID: number
  car_no: string | null
  cli_no: string | null
  car_code: string | null
  car_model: string | null
  body_no: string | null
  LAST_KM: number | null
  eng_no: string | null
  shana: number | null
  CAR_DESC: string | null
}

export interface NesherCard {
  card_id: number
  card_no: string | null
  open_dt: Date | null
  close_dt: Date | null
  car_no: string | null
  cli_no: string | null
  cli_name: string | null
  car_code: string | null
  car_model: string | null
  car_desc: string | null
  part_tot: number | null
  work_tot: number | null
  tarif: number | null
  card_st: string | number | null
  card_status: string | null
  card_km: number | null
  cli_email: string | null
  adviser: string | null
  drv_name: string | null
  drv_phone: string | null
}

export async function countTable(table: 'ca_clients' | 'ca_cars' | 'ca_cards'): Promise<number> {
  const rows = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM dbo.${table}`)
  return Number(rows[0]?.n ?? 0)
}

export async function fetchClients(limit = 999999): Promise<NesherClient[]> {
  return query<NesherClient>(`
    SELECT TOP (${limit})
      id, cli_no, cli_name, cli_addr, cli_city,
      cli_phone, cli_pele, cli_email, cli_note
    FROM dbo.ca_clients
    ORDER BY id
  `)
}

export async function fetchCars(limit = 999999): Promise<NesherCar[]> {
  return query<NesherCar>(`
    SELECT TOP (${limit})
      LINE_ID, car_no, cli_no, car_code, car_model,
      body_no, LAST_KM, eng_no, shana, CAR_DESC
    FROM dbo.ca_cars
    ORDER BY LINE_ID
  `)
}

export async function fetchCards(limit = 999999): Promise<NesherCard[]> {
  return query<NesherCard>(`
    SELECT TOP (${limit})
      card_id, card_no, open_dt, close_dt, car_no, cli_no, cli_name,
      car_code, car_model, car_desc, part_tot, work_tot, tarif,
      card_st, card_status, card_km, cli_email, adviser, drv_name, drv_phone
    FROM dbo.ca_cards
    ORDER BY card_id
  `)
}
