// Edge Function para subir entregas con imágenes comprimidas
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { decode } from 'https://deno.land/std@0.177.0/encoding/base64.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EntregaData {
  Documento: string
  Lote: string
  Referencia: string
  Cantidad: number
  Factura: string
  Nit: string
  Usuario?: string
  imagen?: string // Base64 de la imagen
  imagenNombre?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    const { entrega }: { entrega: EntregaData } = await req.json()

    // Validar campos requeridos
    if (!entrega.Documento || !entrega.Lote || !entrega.Referencia || !entrega.Factura || !entrega.Nit) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Campos requeridos: Documento, Lote, Referencia, Factura, Nit' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ⭐ VERIFICAR SI YA EXISTE EL REGISTRO
    console.log(`🔍 Verificando si existe registro para factura: ${entrega.Factura}`)
    
    const { data: existingRecord, error: checkError } = await supabaseClient
      .from('ENTREGAS')
      .select('Factura, SoporteID, Url_Ih3')
      .eq('Factura', entrega.Factura)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found (OK)
      console.error('❌ Error verificando registro existente:', checkError)
      throw checkError
    }

    // Si el registro ya existe
    if (existingRecord) {
      console.log('📋 Registro existente encontrado:', existingRecord)
      
      // Verificar si ya tiene imagen
      const hasImage = existingRecord.Url_Ih3 && existingRecord.Url_Ih3.trim() !== ''
      
      if (hasImage) {
        // ✅ Ya existe con imagen completa - retornar éxito sin hacer nada
        console.log('✅ Registro ya existe con imagen completa - omitiendo subida')
        return new Response(
          JSON.stringify({
            success: true,
            data: existingRecord,
            soporteID: existingRecord.SoporteID,
            urlImagen: existingRecord.Url_Ih3,
            alreadyExists: true,
            message: 'Registro ya existe con imagen'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else if (entrega.imagen) {
        // ⚠️ Existe pero sin imagen - actualizar con la nueva imagen
        console.log('⚠️ Registro existe sin imagen - actualizando...')
        // Continuar con el flujo normal para subir la imagen y actualizar
      } else {
        // Existe sin imagen y no se envió imagen nueva
        console.log('⚠️ Registro existe sin imagen y no se envió imagen nueva')
        return new Response(
          JSON.stringify({
            success: true,
            data: existingRecord,
            soporteID: existingRecord.SoporteID,
            urlImagen: existingRecord.Url_Ih3,
            alreadyExists: true,
            message: 'Registro existe sin imagen'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    let soporteID = null
    let urlImagen = null

    // Si hay imagen, procesarla y subirla
    if (entrega.imagen) {
      try {
        console.log('📸 Procesando imagen...')

        // Extraer el base64 (remover el prefijo data:image/... si existe)
        const base64Data = entrega.imagen.includes(',') 
          ? entrega.imagen.split(',')[1] 
          : entrega.imagen

        // Decodificar base64 a bytes
        const imageBytes = decode(base64Data)

        // Generar nombre único para la imagen con estructura de carpetas por fecha
        // Usar hora de Colombia (UTC-5)
        const now = new Date()
        const colombiaOffset = -5 * 60 // Colombia es UTC-5 en minutos
        const colombiaTime = new Date(now.getTime() + (colombiaOffset * 60 * 1000))
        
        const year = colombiaTime.getUTCFullYear()
        const month = String(colombiaTime.getUTCMonth() + 1).padStart(2, '0')
        const day = String(colombiaTime.getUTCDate()).padStart(2, '0')
        const timestamp = Date.now()
        
        // Limpiar nombre de archivo y obtener extensión
        let extension = 'jpg'
        if (entrega.imagenNombre) {
          const parts = entrega.imagenNombre.toLowerCase().split('.')
          if (parts.length > 1) {
            extension = parts[parts.length - 1]
          }
        }
        
        // Limpiar factura y documento de caracteres especiales
        const facturaLimpia = entrega.Factura.replace(/[^a-zA-Z0-9]/g, '-')
        const documentoLimpio = entrega.Documento.replace(/[^a-zA-Z0-9]/g, '-')
        
        // Estructura: 2026/04/29/FEV-12345_DOC-001_1714348800000.jpg
        const fileName = `${facturaLimpia}_${documentoLimpio}_${timestamp}.${extension}`
        const filePath = `${year}/${month}/${day}/${fileName}`

        console.log(`📤 Subiendo imagen: ${filePath}`)

        // Subir a Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseClient
          .storage
          .from('soportes-entregas')
          .upload(filePath, imageBytes, {
            contentType: `image/${extension}`,
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('❌ Error subiendo imagen:', uploadError)
          throw uploadError
        }

        // Obtener URL pública
        const { data: urlData } = supabaseClient
          .storage
          .from('soportes-entregas')
          .getPublicUrl(filePath)

        soporteID = fileName
        urlImagen = urlData.publicUrl

        console.log(`✅ Imagen subida: ${urlImagen}`)

      } catch (error: any) {
        console.error('❌ Error procesando imagen:', error)
        return new Response(
          JSON.stringify({ 
            success: false,
            error: `Error procesando imagen: ${error.message}` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Insertar o actualizar registro en ENTREGAS
    // Generar fecha en zona horaria de Colombia (UTC-5) sin milisegundos
    const now = new Date()
    const colombiaOffset = -5 * 60 // Colombia es UTC-5 en minutos
    const colombiaTime = new Date(now.getTime() + (colombiaOffset * 60 * 1000))
    
    // Formatear como YYYY-MM-DD HH:MM:SS
    const year = colombiaTime.getUTCFullYear()
    const month = String(colombiaTime.getUTCMonth() + 1).padStart(2, '0')
    const day = String(colombiaTime.getUTCDate()).padStart(2, '0')
    const hours = String(colombiaTime.getUTCHours()).padStart(2, '0')
    const minutes = String(colombiaTime.getUTCMinutes()).padStart(2, '0')
    const seconds = String(colombiaTime.getUTCSeconds()).padStart(2, '0')
    
    const registroFecha = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    
    const entregaRecord = {
      "Registro": registroFecha, // Timestamp en hora de Colombia sin milisegundos
      "Documento": entrega.Documento,
      "Lote": entrega.Lote,
      "Referencia": entrega.Referencia,
      "Cantidad": entrega.Cantidad || 0,
      "Factura": entrega.Factura,
      "Nit": entrega.Nit,
      "SoporteID": soporteID,
      "Url_Ih3": urlImagen,
      "Usuario": entrega.Usuario || null
    }

    console.log('💾 Guardando registro en ENTREGAS...')

    let data, error

    if (existingRecord && !existingRecord.Url_Ih3) {
      // ACTUALIZAR registro existente que no tiene imagen
      console.log('🔄 Actualizando registro existente con imagen...')
      const updateResult = await supabaseClient
        .from('ENTREGAS')
        .update({
          "SoporteID": soporteID,
          "Url_Ih3": urlImagen,
          "Usuario": entrega.Usuario || existingRecord.Usuario
        })
        .eq('Factura', entrega.Factura)
        .select()

      data = updateResult.data
      error = updateResult.error
    } else {
      // INSERTAR nuevo registro
      console.log('➕ Insertando nuevo registro...')
      const insertResult = await supabaseClient
        .from('ENTREGAS')
        .insert([entregaRecord])
        .select()

      data = insertResult.data
      error = insertResult.error
    }

    if (error) {
      console.error('❌ Error guardando entrega:', error)
      
      // Si falla el guardado, eliminar la imagen subida
      if (soporteID) {
        const now = new Date()
        const colombiaOffset = -5 * 60
        const colombiaTime = new Date(now.getTime() + (colombiaOffset * 60 * 1000))
        const year = colombiaTime.getUTCFullYear()
        const month = String(colombiaTime.getUTCMonth() + 1).padStart(2, '0')
        const day = String(colombiaTime.getUTCDate()).padStart(2, '0')
        await supabaseClient
          .storage
          .from('soportes-entregas')
          .remove([`${year}/${month}/${day}/${soporteID}`])
      }
      
      throw error
    }

    console.log('✅ Entrega guardada exitosamente')

    return new Response(
      JSON.stringify({
        success: true,
        data: data[0],
        soporteID,
        urlImagen,
        wasUpdated: existingRecord && !existingRecord.Url_Ih3
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
