/**
 * TEMPORARY — one-shot Supabase Storage setup endpoint.
 * Creates the vehicle-documents bucket (private) and verifies configuration.
 * Protected by INTERNAL_RESET_SECRET. Remove after setup is complete.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_RESET_SECRET
  if (!secret || req.headers.get('x-reset-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY
  const bucket      = process.env.SUPABASE_STORAGE_BUCKET ?? 'vehicle-documents'

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({
      error: 'SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in Vercel environment',
      supabaseUrl:  !!supabaseUrl,
      serviceKey:   !!serviceKey,
      bucket,
    }, { status: 503 })
  }

  // Diagnostic: show sanitized URL info (project ref only, never the key)
  const urlDiag = {
    startsWithHttps: supabaseUrl.startsWith('https://'),
    endsWithSlash:   supabaseUrl.endsWith('/'),
    projRef:         supabaseUrl.replace(/^https?:\/\//, '').split('.')[0].slice(0, 20),
    keyLength:       serviceKey.length,
    keyPrefix:       serviceKey.slice(0, 6),
  }

  // Normalize URL: strip trailing slash
  const normalUrl = supabaseUrl.replace(/\/+$/, '')

  const sb = createClient(normalUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const results: string[] = []

  // Verify storage endpoint directly first (normalUrl contains no secrets)
  const storageUrl = `${normalUrl}/storage/v1/bucket`
  let rawStatus = 0
  let rawBody = ''
  try {
    const r = await fetch(storageUrl, { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } })
    rawStatus = r.status
    rawBody = await r.text()
  } catch (e: unknown) { rawBody = String(e) }

  // Check if bucket exists
  const { data: buckets, error: listErr } = await sb.storage.listBuckets()
  if (listErr) {
    return NextResponse.json({
      error: `listBuckets: ${listErr.message}`,
      urlDiag,
      normalUrl,           // safe: no credentials
      storageUrl,          // safe: no credentials
      rawStatus,
      rawBody: rawBody.slice(0, 400),
    }, { status: 500 })
  }

  const existing = (buckets ?? []).find(b => b.name === bucket)
  if (existing) {
    results.push(`bucket '${bucket}': already exists (public=${existing.public})`)
    if (existing.public) {
      // Update to private
      const { error: updateErr } = await sb.storage.updateBucket(bucket, { public: false })
      if (updateErr) results.push(`  → update to private: FAILED — ${updateErr.message}`)
      else results.push(`  → updated to private: ok`)
    }
  } else {
    // Create private bucket
    const { error: createErr } = await sb.storage.createBucket(bucket, {
      public:          false,
      fileSizeLimit:   10 * 1024 * 1024, // 10 MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    })
    if (createErr) {
      return NextResponse.json({ error: `createBucket: ${createErr.message}`, results }, { status: 500 })
    }
    results.push(`bucket '${bucket}': created (private)`)
  }

  // Verify bucket is private
  const { data: updated } = await sb.storage.getBucket(bucket)
  results.push(`bucket public=${updated?.public ?? 'unknown'} (should be false)`)

  // Test round-trip: write a tiny test object, create signed URL, delete it
  const testPath = `_setup-test/verify-${Date.now()}.txt`
  const testBody = Buffer.from('supabase-storage-setup-check')

  const { error: uploadErr } = await sb.storage.from(bucket).upload(testPath, testBody, {
    contentType: 'text/plain', upsert: true,
  })
  if (uploadErr) {
    results.push(`test upload: FAILED — ${uploadErr.message}`)
  } else {
    results.push('test upload: ok')

    const { data: signedData, error: signErr } = await sb.storage.from(bucket).createSignedUrl(testPath, 10)
    if (signErr || !signedData?.signedUrl) {
      results.push(`test signed URL: FAILED — ${signErr?.message}`)
    } else {
      results.push('test signed URL: ok')
    }

    const { error: delErr } = await sb.storage.from(bucket).remove([testPath])
    results.push(delErr ? `test delete: FAILED — ${delErr.message}` : 'test delete: ok')
  }

  // Return DB host (project ref only — never the password)
  let dbHost = ''
  try {
    const dbUrl = process.env.DATABASE_URL ?? ''
    const match = dbUrl.match(/@([^:/?]+)/)
    dbHost = match?.[1] ?? 'unknown'
  } catch { /* ignore */ }

  return NextResponse.json({
    ok:          true,
    bucket,
    dbHost,
    supabaseUrl: supabaseUrl.replace(/https?:\/\//, '').split('.')[0], // project ref only
    results,
  })
}
