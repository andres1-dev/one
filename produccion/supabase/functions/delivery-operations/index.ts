// Función COMPLETA - Maneja UPLOAD SIESA, ENTREGAS, CONSULTAS y ACTUALIZACIONES
// 🔒 SEGURIDAD: Validación de autenticación y permisos por rol
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
}

// Jerarquía de roles
const ROLE_HIERARCHY = {
  'OWNER': 5,
  'ADMIN': 4,
  'MODERATOR': 3,
  'USER': 2,
  'DELIVERY': 2,
  'GUEST': 1
}

// Validar autenticación y obtener usuario
async function validateAuth(req: Request, supabaseClient: any) {
  const authHeader = req.headers.get('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No autorizado - Token requerido')
  }

  const token = authHeader.replace('Bearer ', '')
  
  const { data: { user }, error } = await supabaseClient.auth.getUser(token)
  
  if (error || !user) {
    throw new Error('Token inválido o expirado')
  }

  const userRole = user.user_metadata?.role || 'GUEST'
  const roleLevel = ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] || 0

  return {
    user,
    role: userRole,
    roleLevel,
    userId: user.user_metadata?.legacy_id || user.id
  }
}

// Verificar permisos
function checkPermission(userRoleLevel: number, requiredLevel: number, action: string) {
  if (userRoleLevel < requiredLevel) {
    throw new Error(`Permisos insuficientes para ${action}. Se requiere nivel ${requiredLevel}, tienes ${userRoleLevel}`)
  }
}

interface ConsolidatedRecord {
  estado?: string
  fecha?: string
  razon_social_cliente_factura?: string
  docto_referencia?: string
  notas?: string
  compania?: string
  op?: string
  tipo?: string
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 🔒 CREAR CLIENTE CON SERVICE ROLE (para operaciones administrativas)
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  try {
    // 🔒 VALIDAR AUTENTICACIÓN (excepto para OPTIONS)
    const authData = await validateAuth(req, supabaseAdmin)
    console.log(`👤 Usuario autenticado: ${authData.userId} (${authData.role})`)

    const url = new URL(req.url)
    const action = url.searchParams.get('action')

  // ========================================
  // POST - MÚLTIPLES ACCIONES
  // ========================================
  if (req.method === 'POST') {
    
    // POST action=upsert - CREAR/ACTUALIZAR ENTREGAS
    // 🔒 Requiere: USER o superior (nivel 2+)
    if (action === 'upsert') {
      checkPermission(authData.roleLevel, 2, 'crear entregas')
      
      try {
        const { entregas } = await req.json()

        if (!entregas || !Array.isArray(entregas)) {
          return new Response(
            JSON.stringify({ error: 'Se requiere un array de entregas' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log(`📦 ${authData.userId} (${authData.role}) - Recibidas ${entregas.length} entregas para upsert`)

        // Validar campos requeridos
        for (const entrega of entregas) {
          if (!entrega.Documento || !entrega.Lote || !entrega.Referencia || !entrega.Factura || !entrega.Nit) {
            return new Response(
              JSON.stringify({ 
                error: 'Campos requeridos: Documento, Lote, Referencia, Factura, Nit' 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }

        // Preparar entregas para inserción (agregar usuario que las crea)
        const entregasToInsert = entregas.map(e => ({
          "Documento": e.Documento,
          "Lote": e.Lote,
          "Referencia": e.Referencia,
          "Cantidad": e.Cantidad || 0,
          "Factura": e.Factura,
          "Nit": e.Nit,
          "SoporteID": e.SoporteID || null,
          "Url_Ih3": e.Url_Ih3 || null,
          "Usuario": e.Usuario || authData.userId // Registrar quién creó la entrega
        }))

        const results = {
          total: entregasToInsert.length,
          success: 0,
          failed: 0,
          errors: [] as string[]
        }

        // Insertar entregas
        const { data, error } = await supabaseAdmin
          .from('ENTREGAS')
          .insert(entregasToInsert)
          .select()

        if (error) {
          console.error('❌ Error insertando entregas:', error)
          results.failed = entregasToInsert.length
          results.errors.push(error.message)
        } else {
          results.success = data?.length || 0
          console.log(`✅ ${results.success} entregas insertadas por ${authData.userId}`)
        }

        return new Response(
          JSON.stringify(results),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (error: any) {
        console.error('❌ Error en upsert:', error)
        return new Response(
          JSON.stringify({ 
            total: 0,
            success: 0,
            failed: 0,
            errors: [error.message]
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // POST action=delete - ELIMINAR ENTREGAS Y SUS IMÁGENES
    // 🔒 Requiere: ADMIN o superior (nivel 4+)
    if (action === 'delete') {
      checkPermission(authData.roleLevel, 4, 'eliminar entregas')
      
      try {
        const { registros, facturas } = await req.json()

        // Soportar eliminación por Registro (timestamp) o por Factura
        if (!registros && !facturas) {
          return new Response(
            JSON.stringify({ error: 'Se requiere un array de registros o facturas' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Primero, obtener las entregas para saber qué imágenes eliminar
        let querySelect = supabaseAdmin.from('ENTREGAS').select('*')

        if (registros && Array.isArray(registros)) {
          console.log(`🗑️ Buscando ${registros.length} entregas por Registro para eliminar`)
          querySelect = querySelect.in('Registro', registros)
        } else if (facturas && Array.isArray(facturas)) {
          console.log(`🗑️ Buscando ${facturas.length} entregas por Factura para eliminar`)
          querySelect = querySelect.in('Factura', facturas)
        }

        const { data: entregasAEliminar, error: selectError } = await querySelect

        if (selectError) throw selectError

        if (!entregasAEliminar || entregasAEliminar.length === 0) {
          return new Response(
            JSON.stringify({
              success: true,
              deleted: 0,
              imagesDeleted: 0,
              message: 'No se encontraron entregas para eliminar'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log(`📦 Encontradas ${entregasAEliminar.length} entregas para eliminar`)

        // Eliminar imágenes del Storage
        const imagenesAEliminar: string[] = []
        
        entregasAEliminar.forEach(entrega => {
          if (entrega.Url_Ih3 && entrega.Url_Ih3.includes('supabase.co/storage')) {
            // Extraer la ruta del archivo desde la URL
            // URL formato: https://iladaofarozipitwaeti.supabase.co/storage/v1/object/public/soportes-entregas/2026/04/29/filename.jpg
            const urlParts = entrega.Url_Ih3.split('/soportes-entregas/')
            if (urlParts.length > 1) {
              const filePath = urlParts[1]
              imagenesAEliminar.push(filePath)
            }
          }
        })

        let imagenesEliminadas = 0

        if (imagenesAEliminar.length > 0) {
          console.log(`🖼️ Eliminando ${imagenesAEliminar.length} imágenes del Storage...`)
          
          const { data: deletedFiles, error: storageError } = await supabaseAdmin
            .storage
            .from('soportes-entregas')
            .remove(imagenesAEliminar)

          if (storageError) {
            console.error('⚠️ Error eliminando imágenes del Storage:', storageError)
            // No lanzamos error, continuamos con la eliminación de registros
          } else {
            imagenesEliminadas = deletedFiles?.length || imagenesAEliminar.length
            console.log(`✅ ${imagenesEliminadas} imágenes eliminadas del Storage`)
          }
        }

        // Ahora eliminar los registros de la base de datos
        let queryDelete = supabaseAdmin.from('ENTREGAS').delete()

        if (registros && Array.isArray(registros)) {
          queryDelete = queryDelete.in('Registro', registros)
        } else if (facturas && Array.isArray(facturas)) {
          queryDelete = queryDelete.in('Factura', facturas)
        }

        const { error: deleteError, count } = await queryDelete

        if (deleteError) throw deleteError

        const registrosEliminados = count || entregasAEliminar.length

        console.log(`✅ ${registrosEliminados} registros eliminados de la base de datos`)

        return new Response(
          JSON.stringify({
            success: true,
            deleted: registrosEliminados,
            imagesDeleted: imagenesEliminadas,
            message: `${registrosEliminados} entregas y ${imagenesEliminadas} imágenes eliminadas correctamente`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (error: any) {
        console.error('❌ Error eliminando:', error)
        return new Response(
          JSON.stringify({ 
            success: false,
            error: error.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // POST sin action - SUBIR DATOS SIESA (UPLOAD)
    // 🔒 Requiere: OWNER o ADMIN (nivel 4+)
    if (!action) {
      checkPermission(authData.roleLevel, 4, 'subir datos SIESA')
      
      try {
        const { records } = await req.json()

        if (!records || !Array.isArray(records)) {
          return new Response(
            JSON.stringify({ error: 'Se requiere un array de registros' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log(`📦 Recibidos ${records.length} registros SIESA para procesar`)

        // Consolidar registros por nro_documento
        const consolidatedMap = new Map<string, ConsolidatedRecord>()

        for (const record of records) {
          const nroDoc = String(record.nro_documento).trim()
          
          if (!consolidatedMap.has(nroDoc)) {
            consolidatedMap.set(nroDoc, {
              estado: record.estado || undefined,
              fecha: record.fecha || undefined,
              razon_social_cliente_factura: record.razon_social_cliente_factura || undefined,
              docto_referencia: record.docto_referencia || undefined,
              notas: record.notas || undefined,
              compania: record.compania || undefined,
              op: record.op || undefined,
              tipo: record.tipo || undefined,
              nro_documento: nroDoc,
              referencia: record.referencia,
              valor_subtotal_total: parseFloat(record.valor_subtotal) || 0,
              cantidad_total: parseFloat(record.cantidad) || 0,
              referencias_detalle: record.referencias_detalle || [{
                referencia: record.referencia,
                cantidad: parseFloat(record.cantidad) || 0,
                valor_subtotal: parseFloat(record.valor_subtotal) || 0
              }]
            })
          } else {
            const existing = consolidatedMap.get(nroDoc)!
            if (existing.referencia !== 'REFVAR') {
              existing.referencia = 'REFVAR'
            }
            existing.valor_subtotal_total += parseFloat(record.valor_subtotal) || 0
            existing.cantidad_total += parseFloat(record.cantidad) || 0
            existing.referencias_detalle!.push({
              referencia: record.referencia,
              cantidad: parseFloat(record.cantidad) || 0,
              valor_subtotal: parseFloat(record.valor_subtotal) || 0
            })
          }
        }

        const consolidatedRecords = Array.from(consolidatedMap.values())
        console.log(`✅ Consolidados ${records.length} registros en ${consolidatedRecords.length} documentos únicos`)

        const recordsToInsert = consolidatedRecords.map(record => ({
          "Estado": record.estado || null,
          "Nro documento": record.nro_documento,
          "Fecha": record.fecha || null,
          "Razón social cliente factura": record.razon_social_cliente_factura || null,
          "Docto. referencia": record.docto_referencia || null,
          "Notas": record.notas || null,
          "Compáa": (record.compania && !isNaN(Number(record.compania))) ? Number(record.compania) : null,
          "op": record.op || null,
          "tipo": record.tipo || null,
          "Valor subtotal local": record.valor_subtotal_total != null ? String(record.valor_subtotal_total) : null,
          "Referencia": record.referencia,
          "Cantidad inv.": record.cantidad_total,
          "referencias_detalle": record.referencia === 'REFVAR' ? record.referencias_detalle : null
        }))

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
            
            const { data, error } = await supabaseAdmin
              .from('SIESA')
              .upsert(batch, { 
                onConflict: 'Nro documento',
                ignoreDuplicates: true
              })
              .select('"Nro documento"')

            if (error) throw error

            const insertedCount = data ? data.length : 0
            const duplicateCount = batch.length - insertedCount
            
            results.success += insertedCount
            results.ignored += duplicateCount
            
            console.log(`✅ Lote ${batchNum}: ${insertedCount} insertados, ${duplicateCount} duplicados`)

          } catch (error: any) {
            console.error(`❌ Error en lote ${batchNum}:`, error)
            results.failed += batch.length
            results.errors.push(`Lote ${batchNum}: ${error.message}`)
          }
        }

        console.log(`🎉 Completado: ${results.success} exitosos, ${results.failed} fallidos`)

        return new Response(
          JSON.stringify(results),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (error: any) {
        console.error('❌ Error en POST SIESA:', error)
        return new Response(
          JSON.stringify({ 
            total: 0,
            success: 0,
            failed: 0,
            errors: [error.message]
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
  }

  // ========================================
  // PATCH - ACTUALIZAR ESTADO/OP
  // 🔒 Requiere: ADMIN o superior (nivel 4+)
  // ========================================
  if (req.method === 'PATCH') {
    checkPermission(authData.roleLevel, 4, 'actualizar documentos SIESA')
    
    try {
      const { documento, nuevoEstado, nuevaOP } = await req.json()
      
      if (!documento) {
        return new Response(
          JSON.stringify({ success: false, error: 'Documento es requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const updates: any = {}
      if (nuevoEstado !== undefined) updates.Estado = nuevoEstado
      if (nuevaOP !== undefined) updates.op = nuevaOP

      if (Object.keys(updates).length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No se enviaron datos para actualizar' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`📝 ${authData.userId} (${authData.role}) - Actualizando documento ${documento}:`, updates)

      const { error } = await supabaseAdmin
        .from('SIESA')
        .update(updates)
        .eq('Nro documento', documento)

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, message: 'Estado actualizado correctamente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (error: any) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  // ========================================
  // GET - MÚLTIPLES ACCIONES
  // 🔒 Requiere: USER o superior (nivel 2+) para consultas
  // ========================================
  checkPermission(authData.roleLevel, 2, 'consultar datos')
  
  try {
    
    // GET action=stats - ESTADÍSTICAS
    if (action === 'stats') {
      console.log(`📊 ${authData.userId} (${authData.role}) - Calculando estadísticas...`)

      const { data: facturas, error: facturasError } = await supabaseAdmin
        .from('SIESA')
        .select('"Nro documento"')
        .neq('Estado', 'Anuladas')

      if (facturasError) throw facturasError

      const { data: entregas, error: entregasError } = await supabaseAdmin
        .from('ENTREGAS')
        .select('Factura')

      if (entregasError) throw entregasError

      const totalFacturas = facturas?.length || 0
      const facturasConEntregas = new Set(entregas?.map(e => e.Factura)).size
      const facturasSinEntregas = totalFacturas - facturasConEntregas
      const totalEntregas = entregas?.length || 0
      const porcentajeEntregado = totalFacturas > 0 
        ? ((facturasConEntregas / totalFacturas) * 100).toFixed(2) 
        : '0.00'
      const promedioEntregasPorFactura = facturasConEntregas > 0
        ? (totalEntregas / facturasConEntregas).toFixed(2)
        : '0.00'

      return new Response(
        JSON.stringify({
          totalFacturas,
          facturasConEntregas,
          facturasSinEntregas,
          totalEntregas,
          porcentajeEntregado: `${porcentajeEntregado}%`,
          promedioEntregasPorFactura
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET action=by-factura - ENTREGAS POR FACTURA
    if (action === 'by-factura') {
      const factura = url.searchParams.get('factura')
      
      if (!factura) {
        return new Response(
          JSON.stringify({ error: 'Se requiere el parámetro factura' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`📦 Buscando entregas para factura ${factura}`)

      const { data: entregas, error } = await supabaseAdmin
        .from('ENTREGAS')
        .select('*')
        .eq('Factura', factura)
        .order('Registro', { ascending: false })

      if (error) throw error

      return new Response(
        JSON.stringify({
          factura,
          entregas: entregas || [],
          count: entregas?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET action=get - OBTENER TODAS LAS FACTURAS CON ENTREGAS
    if (action === 'get') {
      console.log('📦 Cargando todas las entregas con paginación...')

      // Cargar TODAS las entregas con paginación
      let todasEntregas: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data: batchEntregas, error: entregasError } = await supabaseAdmin
          .from('ENTREGAS')
          .select('*')
          .order('Registro', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (entregasError) throw entregasError
        
        if (batchEntregas && batchEntregas.length > 0) {
          todasEntregas = todasEntregas.concat(batchEntregas)
          hasMore = batchEntregas.length === pageSize
          page++
          console.log(`📄 Página ${page}: ${batchEntregas.length} entregas (total: ${todasEntregas.length})`)
        } else {
          hasMore = false
        }
      }

      console.log(`✅ Total entregas cargadas: ${todasEntregas.length}`)

      return new Response(
        JSON.stringify({
          entregas: todasEntregas,
          total: todasEntregas.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET sin action - CONSULTAR FACTURAS CON ENTREGAS POR RANGO DE FECHAS
    const fechaInicio = url.searchParams.get('fechaInicio')
    const fechaFin = url.searchParams.get('fechaFin')
    
    if (!fechaInicio || !fechaFin) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Se requieren fechaInicio y fechaFin en formato YYYY-MM-DD'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const startTime = Date.now()
    console.log(`📦 Cargando datos desde ${fechaInicio} hasta ${fechaFin}...`)

    // Cargar facturas con paginación
    let facturas: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data: batch, error: facturasError } = await supabaseAdmin
        .from('SIESA')
        .select(`
          *,
          PROVEEDORES!SIESA_Compáa_fkey (
            PROVEEDOR,
            ID_PROVEEDOR
          )
        `)
        .gte('Fecha', fechaInicio)
        .lte('Fecha', fechaFin)
        .neq('Estado', 'Anuladas')
        .order('Fecha', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (facturasError) throw facturasError
      
      if (batch && batch.length > 0) {
        // Aplanar el objeto PROVEEDORES
        const batchConProveedor = batch.map(f => ({
          ...f,
          proveedor: f.PROVEEDORES?.PROVEEDOR || null,
          id_proveedor: f.PROVEEDORES?.ID_PROVEEDOR || null,
          PROVEEDORES: undefined
        }))
        facturas = facturas.concat(batchConProveedor)
        hasMore = batch.length === pageSize
        page++
        console.log(`📄 Página ${page}: ${batch.length} facturas (total: ${facturas.length})`)
      } else {
        hasMore = false
      }
    }

    console.log(`✅ ${facturas.length} facturas encontradas`)

    const nrosDocumento = facturas.map(f => f['Nro documento'])

    if (nrosDocumento.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: [],
          stats: {
            totalFacturas: 0,
            totalEntregas: 0,
            facturasConEntregas: 0,
            tiempoCarga: `${Date.now() - startTime}ms`,
            rangoFechas: `${fechaInicio} - ${fechaFin}`
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cargar entregas
    let entregas: any[] = []
    
    if (nrosDocumento.length > 100) {
      console.log(`⚡ Muchas facturas (${nrosDocumento.length}), cargando todas las entregas...`)
      
      let todasEntregas: any[] = []
      let entregasPage = 0
      let hasMoreEntregas = true

      while (hasMoreEntregas) {
        const { data: batchEntregas, error: entregasError } = await supabaseAdmin
          .from('ENTREGAS')
          .select('*')
          .range(entregasPage * pageSize, (entregasPage + 1) * pageSize - 1)

        if (entregasError) throw entregasError
        
        if (batchEntregas && batchEntregas.length > 0) {
          todasEntregas = todasEntregas.concat(batchEntregas)
          hasMoreEntregas = batchEntregas.length === pageSize
          entregasPage++
          console.log(`📦 Entregas página ${entregasPage}: ${batchEntregas.length} (total: ${todasEntregas.length})`)
        } else {
          hasMoreEntregas = false
        }
      }
      
      const nrosSet = new Set(nrosDocumento)
      entregas = todasEntregas.filter(e => nrosSet.has(e.Factura))
      
    } else {
      console.log(`⚡ Pocas facturas (${nrosDocumento.length}), usando filtro .in()...`)
      const { data: entregasFiltradas, error: entregasError } = await supabaseAdmin
        .from('ENTREGAS')
        .select('*')
        .in('Factura', nrosDocumento)

      if (entregasError) throw entregasError
      entregas = entregasFiltradas || []
    }

    const loadTime = Date.now() - startTime
    console.log(`✅ ${facturas.length} facturas, ${entregas.length} entregas en ${loadTime}ms`)

    // Agrupar entregas por factura
    const entregasPorFactura = new Map<string, any[]>()
    entregas.forEach(e => {
      const factura = e.Factura
      if (!entregasPorFactura.has(factura)) {
        entregasPorFactura.set(factura, [])
      }
      entregasPorFactura.get(factura)!.push(e)
    })

    // Combinar facturas con entregas
    const data = facturas.map(f => {
      const factura = f['Nro documento']
      const entregasFactura = entregasPorFactura.get(factura) || []
      
      return {
        ...f,
        entregas: entregasFactura
      }
    })

    const totalTime = Date.now() - startTime
    console.log(`🎉 ${data.length} facturas procesadas en ${totalTime}ms`)

    return new Response(
      JSON.stringify({
        success: true,
        data: data,
        stats: {
          totalFacturas: data.length,
          totalEntregas: entregas.length,
          facturasConEntregas: data.filter(f => f.entregas.length > 0).length,
          tiempoCarga: `${totalTime}ms`,
          rangoFechas: `${fechaInicio} - ${fechaFin}`
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Error en GET:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  
  } catch (authError: any) {
    // Error de autenticación o permisos
    console.error('❌ Error de autenticación:', authError)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: authError.message
      }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
