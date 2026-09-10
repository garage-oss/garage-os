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
      error: 'SUPABASE_URL and SUPABASE_SERVICE_KEY must be set',
      hasUrl: !!supabaseUrl,
      hasKey: !!serviceKey,
    }, { status: 503 })
  }

  // Normalize: strip trailing slash
  const normalUrl = supabaseUrl.replace(/\/+$/, '')

  // Quick connectivity check before using the JS client
  let pingStatus = 0
  try {
    const r = await fetch(`${normalUrl}/storage/v1/bucket`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    })
    pingStatus = r.status
  } catch { pingStatus = -1 }

  if (pingStatus === -1) {
    return NextResponse.json({
      error: 'Supabase host unreachable (fetch failed). Check SUPABASE_URL.',
      pingStatus,
    }, { status: 503 })
  }

  const sb = createClient(normalUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const results: string[] = [`ping: HTTP ${pingStatus}`]

  // List existing buckets
  const { data: buckets, error: listErr } = await sb.storage.listBuckets()
  if (listErr) {
    return NextResponse.json({
      error: `listBuckets: ${listErr.message}`,
      pingStatus,
      results,
    }, { status: 500 })
  }

  const existing = (buckets ?? []).find(b => b.name === bucket)
  if (existing) {
    results.push(`bucket '${bucket}': already exists (public=${existing.public})`)
    if (existing.public) {
      const { error: updateErr } = await sb.storage.updateBucket(bucket, { public: false })
      results.push(updateErr
        ? `  → update to private: FAILED — ${updateErr.message}`
        : `  → updated to private: ok`)
    }
  } else {
    const { error: createErr } = await sb.storage.createBucket(bucket, {
      public:           false,
      fileSizeLimit:    10 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    })
    if (createErr) {
      return NextResponse.json({ error: `createBucket: ${createErr.message}`, results }, { status: 500 })
    }
    results.push(`bucket '${bucket}': created (private)`)
  }

  // Verify private
  const { data: bkt } = await sb.storage.getBucket(bucket)
  results.push(`bucket.public=${bkt?.public ?? 'unknown'} (expected: false)`)

  // Round-trip test
  const testPath = `_setup-test/verify-${Date.now()}.txt`
  const { error: upErr } = await sb.storage.from(bucket).upload(
    testPath, Buffer.from('setup-check'), { contentType: 'text/plain', upsert: true }
  )
  if (upErr) {
    results.push(`test upload: FAILED — ${upErr.message}`)
  } else {
    results.push('test upload: ok')
    const { data: sig, error: sigErr } = await sb.storage.from(bucket).createSignedUrl(testPath, 10)
    results.push(sigErr || !sig?.signedUrl ? `test signed-url: FAILED — ${sigErr?.message}` : 'test signed-url: ok')
    const { error: delErr } = await sb.storage.from(bucket).remove([testPath])
    results.push(delErr ? `test delete: FAILED — ${delErr.message}` : 'test delete: ok')
  }

  return NextResponse.json({ ok: true, bucket, bucketPublic: bkt?.public ?? null, results })
}
