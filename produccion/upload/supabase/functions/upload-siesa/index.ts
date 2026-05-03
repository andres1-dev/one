// Función para subir datos SIESA consolidados a Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConsolidatedRecord {
  // Campos del CSV
  estado?: string
  fecha?: string
  razon_social_cliente_factura?: string
  docto_referencia?: string
  notas?: string
  compania?: string
  op?: string
  tipo?: string
  // Campos del XLSX
  nro_documento: string
  referencia: string
  valor_subtotal_total: number
  cantidad_total: number
  referencias_detalle?: Array<{
    referencia: string
    cantidad: number
    valor_subtotal: number
  }>
}

Deno.serve(async (req) => {
  // Manejar preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Crear cliente Supabase con la service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Obtener los registros del body
    const { records } = await req.json()

    if (!records || !Array.isArray(records)) {
      return new Response(
        JSON.stringify({ error: 'Se requiere un array de registros' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📦 Recibidos ${records.length} registros para procesar`)

    // PASO 1: Consolidar registros por nro_documento
    const consolidatedMap = new Map<string, ConsolidatedRecord>()

    for (const record of records) {
      const nroDoc = String(record.nro_documento).trim()
      
      if (!consolidatedMap.has(nroDoc)) {
        // Primera vez que vemos este documento: copiar TODOS los campos
        consolidatedMap.set(nroDoc, {
          // Campos del CSV
          estado: record.estado || undefined,
          fecha: record.fecha || undefined,
          razon_social_cliente_factura: record.razon_social_cliente_factura || undefined,
          docto_referencia: record.docto_referencia || undefined,
          notas: record.notas || undefined,
          compania: record.compania || undefined,
          op: record.op || undefined,
          tipo: record.tipo || undefined,
          // Campos del XLSX
          nro_documento: nroDoc,
          referencia: record.referencia,
          valor_subtotal_total: parseFloat(record.valor_subtotal) || 0,
          cantidad_total: parseFloat(record.cantidad) || 0,
          // Preservar el detalle original enviado por el frontend
          referencias_detalle: record.referencias_detalle || [{
            referencia: record.referencia,
            cantidad: parseFloat(record.cantidad) || 0,
            valor_subtotal: parseFloat(record.valor_subtotal) || 0
          }]
        })
      } else {
        // Ya existe este documento, consolidar
        const existing = consolidatedMap.get(nroDoc)!
        
        // Cambiar referencia a REFVAR si hay múltiples referencias
        if (existing.referencia !== 'REFVAR') {
          existing.referencia = 'REFVAR'
        }
        
        // Sumar valores
        existing.valor_subtotal_total += parseFloat(record.valor_subtotal) || 0
        existing.cantidad_total += parseFloat(record.cantidad) || 0
        
        // Agregar al detalle
        existing.referencias_detalle!.push({
          referencia: record.referencia,
          cantidad: parseFloat(record.cantidad) || 0,
          valor_subtotal: parseFloat(record.valor_subtotal) || 0
        })
      }
    }

    const consolidatedRecords = Array.from(consolidatedMap.values())
    console.log(`✅ Consolidados ${records.length} registros en ${consolidatedRecords.length} documentos únicos`)

    // PASO 2: Preparar registros para inserción con nombres EXACTOS de columnas
    const recordsToInsert = consolidatedRecords.map(record => ({
      // Datos del CSV (nombres exactos de la tabla)
      "Estado": record.estado || null,
      "Nro documento": record.nro_documento,
      "Fecha": record.fecha || null,
      "Razón social cliente factura": record.razon_social_cliente_factura || null,
      "Docto. referencia": record.docto_referencia || null,
      "Notas": record.notas || null,
      "Compáa": (record.compania && !isNaN(Number(record.compania))) ? Number(record.compania) : null,
      "op": record.op || null,
      "tipo": record.tipo || null,
      
      // Datos del XLSX (usar los campos consolidados correctos)
      "Valor subtotal local": record.valor_subtotal_total != null ? String(record.valor_subtotal_total) : null,
      "Referencia": record.referencia,
      "Cantidad inv.": record.cantidad_total,
      
      // Consolidación: SOLO guardar el detalle si es REFVAR
      "referencias_detalle": record.referencia === 'REFVAR' ? record.referencias_detalle : null
    }))

    // PASO 3: Insertar en lotes de 250
    const batchSize = 250
    const results = {
      total: recordsToInsert.length,
      success: 0,
      ignored: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (let i = 0; i < recordsToInsert.length; i += batchSize) {
      const batch = recordsToInsert.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(recordsToInsert.length / batchSize)
      
      try {
        console.log(`📤 Procesando lote ${batchNum}/${totalBatches} (${batch.length} registros)`)
        
        const { data, error } = await supabaseClient
          .from('SIESA')
          .upsert(batch, { 
            onConflict: 'Nro documento',
            ignoreDuplicates: true  // Ignorar si ya existe
          })
          .select('"Nro documento"')

        if (error) {
          console.error(`❌ Error en lote ${batchNum}:`, error)
          throw error
        }

        const insertedCount = data ? data.length : 0
        const duplicateCount = batch.length - insertedCount
        
        results.success += insertedCount
        results.ignored += duplicateCount
        
        console.log(`✅ Lote ${batchNum}: ${insertedCount} insertados, ${duplicateCount} duplicados/ignorados`)

      } catch (error: any) {
        console.error(`❌ Error en lote ${batchNum}:`, error)
        results.failed += batch.length
        results.errors.push(`Lote ${batchNum}: ${error.message}`)
      }
    }

    console.log(`🎉 Completado: ${results.success} exitosos, ${results.failed} fallidos`)

    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: any) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ 
        total: 0,
        success: 0,
        failed: 0,
        errors: [error.message]
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
