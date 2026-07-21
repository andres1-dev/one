import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface HRItem {
  codigo: string;
  color: string;
  talla: string;
  cantidad: number;
  codigo_color?: string;
}

interface DistribucionItem {
  color: string;
  talla: string;
  codigo: string;
  cantidad: number;
}

interface ClienteDistrib {
  id: string;
  porcentaje?: string;
  distribucion: DistribucionItem[];
}

interface ClienteEnriquecido extends ClienteDistrib {
  razonSocial?: string;
  nombreCorto?: string;
  tipoCliente?: string;
  tipoEmpresa?: string | null;
  estado?: boolean;
  direccion?: string;
  telefono?: string;
  email?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGestorByLinea(linea: string): string {
  const l = linea.toUpperCase();
  if (l.includes("ANGELES"))    return "VILLAMIZAR GOMEZ LUIS";
  if (l.includes("MODAFRESCA")) return "FABIAN MARIN FLOREZ";
  if (l.includes("BASICO"))     return "CESAR AUGUSTO LOPEZ GIRALDO";
  if (l.includes("INTIMA"))     return "KELLY GIOVANA ZULUAGA HOYOS";
  if (l.includes("URBANO"))     return "MARYI ANDREA GONZALEZ SILVA";
  if (l.includes("DEPORTIVO"))  return "JOHAN STEPHANIE ESPÍNOSA RAMIREZ";
  if (l.includes("PRONTAMODA")) return "SANCHEZ LOPEZ YULIETH";
  if (l.includes("ESPECIALES")) return "JUAN ESTEBAN ZULUAGA HOYOS";
  if (l.includes("BOGOTA"))     return "JUAN ESTEBAN ZULUAGA HOYOS";
  return "GESTOR NO ASIGNADO";
}

function getProveedorByLinea(linea: string): string {
  return linea.toUpperCase().includes("ANGELES")
    ? "TEXTILES Y CREACIONES LOS ANGELES SAS"
    : "TEXTILES Y CREACIONES EL UNIVERSO SAS";
}

function getProveedorNIT(proveedor: string): string {
  if (proveedor.includes("UNIVERSO"))  return "900616124";
  if (proveedor.includes("ANGELES"))   return "900692469";
  return "";
}

function getClaseByPVP(pvp: string | number): string {
  const v = parseFloat(String(pvp));
  if (isNaN(v))   return "NO DEFINIDO";
  if (v <= 39900) return "LINEA";
  if (v <= 59900) return "MODA";
  return "PRONTAMODA";
}

// ─── Enriquecer clientes con datos maestro ────────────────────────────────────

function enrichClientes(
  clientesDistrib: Record<string, ClienteDistrib>,
  clientesMap: Record<string, Record<string, unknown>>
): Record<string, ClienteEnriquecido> {
  const enriched: Record<string, ClienteEnriquecido> = {};

  for (const [nombre, datos] of Object.entries(clientesDistrib)) {
    const maestro = clientesMap[datos.id];
    if (maestro) {
      enriched[nombre] = {
        // Campos del maestro en camelCase (la plantilla usa razonSocial)
        id:           String(maestro.id_cliente   ?? datos.id),
        razonSocial:  String(maestro.razon_social  ?? nombre),
        nombreCorto:  String(maestro.nombre_corto  ?? nombre),
        tipoCliente:  String(maestro.tipo_cliente  ?? ""),
        tipoEmpresa:  maestro.tipo_empresa != null ? String(maestro.tipo_empresa) : null,
        estado:       Boolean(maestro.estado),
        direccion:    String(maestro.direccion     ?? ""),
        telefono:     String(maestro.telefono      ?? ""),
        email:        String(maestro.email         ?? ""),
        // Datos de la distribución
        distribucion: datos.distribucion || [],
        ...(datos.porcentaje ? { porcentaje: datos.porcentaje } : {}),
      };
    } else {
      // Cliente no encontrado en maestro — usar nombre corto como fallback
      enriched[nombre] = {
        id:           datos.id,
        razonSocial:  nombre,
        nombreCorto:  nombre,
        distribucion: datos.distribucion || [],
        ...(datos.porcentaje ? { porcentaje: datos.porcentaje } : {}),
      };
    }
  }

  return enriched;
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, apikey, Content-Type",
      },
    });
  }

  try {
    // Usar service_role para saltear RLS por completo
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Parámetro opcional ?id= para refrescar un documento específico
    const url         = new URL(req.url);
    const filtroId    = url.searchParams.get("id");
    const inclFinaliz = url.searchParams.get("finalizado") === "true";

    // ── 1. Traer las 3 tablas en paralelo ──────────────────────────────────
    // Solo estados activos del módulo de separación (a menos que se pida ?finalizado=true)
    const ESTADOS_ACTIVOS = ['PENDIENTE', 'DIRECTO', 'ELABORACION', 'PAUSADO'];

    let distQuery = supabase.from("distribuciones").select("*");

    if (filtroId) {
      // Cuando se pide un ID específico, traer sin filtro de estado
      // para permitir consultar FINALIZADO desde la búsqueda de finalizados
      distQuery = distQuery.eq("id_distribucion", filtroId);
      if (!inclFinaliz) {
        distQuery = distQuery.in("estado", ESTADOS_ACTIVOS);
      }
    } else {
      distQuery = distQuery.in("estado", ESTADOS_ACTIVOS);
    }

    // Primero obtener distribuciones para saber qué ingresos necesitamos
    const { data: distribuciones, error: eDist } = await distQuery;
    if (eDist) throw new Error("distribuciones: " + eDist.message);

    // Extraer solo los IDs de ingresos necesarios
    const idsNecesarios = (distribuciones ?? []).map(d => String(d.id_distribucion));

    const [
      { data: ingresos, error: eIng },
      { data: clientes, error: eCli },
      { data: siesa, error: eSiesa },
    ] = await Promise.all([
      idsNecesarios.length > 0
        ? supabase.from("ingresos").select("*").in("id_ingreso", idsNecesarios)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("clientes").select("*"),
      idsNecesarios.length > 0
        ? supabase.from("SIESA").select("*").in("op", idsNecesarios)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (eIng)  throw new Error("ingresos: " + eIng.message);
    if (eCli)  throw new Error("clientes: " + eCli.message);
    if (eSiesa) throw new Error("SIESA: " + eSiesa.message);

    // ── 2. Índices para lookup O(1) ────────────────────────────────────────

    // Mapa id_cliente → fila completa del maestro
    const clientesMap: Record<string, Record<string, unknown>> = {};
    for (const c of clientes!) {
      clientesMap[c.id_cliente] = c;
    }

    // Mapa id_ingreso → fila ingreso
    const ingresosMap: Record<string, Record<string, unknown>> = {};
    for (const ing of ingresos!) {
      ingresosMap[String(ing.id_ingreso)] = ing;
    }

    // Mapa op → array de facturas de SIESA
    const siesaMap: Record<string, Record<string, unknown>[]> = {};
    for (const factura of siesa!) {
      const op = String(factura.op);
      if (!siesaMap[op]) {
        siesaMap[op] = [];
      }
      siesaMap[op].push(factura);
    }

    // ── 3. Construir array de documentos enriquecidos ──────────────────────
    //
    //  Por cada distribución (≠ FINALIZADO):
    //    - tomamos los datos operativos (estado, colaborador, tiempos)
    //    - cruzamos con ingreso para datos de la prenda
    //    - enriquecemos cada cliente con datos del maestro
    //    - armamos el objeto final compatible con lo que espera el frontend

    const resultado = [];

    for (const dist of distribuciones!) {
      const docId   = String(dist.id_distribucion);
      const ingreso = ingresosMap[docId];
      const facturasSIESA = siesaMap[docId] ?? [];

      // datos_distribucion ya es JSONB en Supabase
      const datosDistrib = dist.datos_distribucion as {
        Clientes?: Record<string, ClienteDistrib>;
        Documento?: string;
      } | null;

      const clientesDistrib = datosDistrib?.Clientes ?? {};

      // Extraer información de facturación de SIESA
      const tieneFactura = facturasSIESA.length > 0;
      const nroFactura = tieneFactura
        ? facturasSIESA.map(f => String(f["Nro documento"] || "")).join(", ")
        : "";
      const facturasDetalle = facturasSIESA.map(f => ({
        nroDocumento: String(f["Nro documento"] || ""),
        estado: String(f["Estado"] || ""),
        fecha: String(f["Fecha"] || ""),
        valorSubtotal: Number(f["Valor subtotal local"] || 0),
        razonSocial: String(f["Razón social cliente factura"] || ""),
      }));

      // Enriquecer clientes con maestro
      const clientesEnriquecidos = enrichClientes(clientesDistrib, clientesMap);

      // Datos del ingreso (puede no existir si aún no se cargó)
      const linea     = String(ingreso?.linea    ?? "");
      const pvp       = String(ingreso?.pvp      ?? "0");
      const proveedor = String(ingreso?.proveedor ?? getProveedorByLinea(linea));

      // HR del ingreso: ya es JSONB con forma [{color,talla,cantidad,codigo_color}]
      // Lo convertimos al formato array [codigo, color, talla, cantidad] que espera el frontend
      const hrRaw = (ingreso?.hr ?? []) as HRItem[];
      const hrFormatted: [string, string, string, number][] = hrRaw.map((h) => [
        h.codigo_color ?? "",
        h.color,
        h.talla,
        h.cantidad,
      ]);

      // Anexos del ingreso: ya es JSONB
      const anexos = ingreso?.anexos ?? null;

      const item = {
        // ── Identificadores ───────────────────────────────────────────
        DOCUMENTO:    docId,
        REC:          docId,

        // ── Datos de la prenda (de ingresos) ──────────────────────────
        FECHA:        ingreso?.fecha_ingreso
                        ? String(ingreso.fecha_ingreso).split("T")[0]
                        : dist.fecha_distribucion
                          ? String(dist.fecha_distribucion).split("T")[0]
                          : null,
        TALLER:       ingreso?.taller       ?? "",
        LINEA:        linea,
        AUDITOR:      ingreso?.auditor      ?? "",
        ESCANER:      ingreso?.escaner      ?? "",
        LOTE:         ingreso?.lote         ?? 0,
        REFPROV:      ingreso?.refprov      ?? "",
        DESCRIPCIÓN:  ingreso?.descripcion  ?? "",
        DESCRIPCION:  ingreso?.descripcion  ?? "",
        CANTIDAD:     ingreso?.cantidad     ?? 0,
        REFERENCIA:   ingreso?.referencia   ?? "",
        TIPO:         ingreso?.tipo         ?? "FULL",
        PVP:          pvp,
        PRENDA:       ingreso?.prenda       ?? "",
        GENERO:       ingreso?.genero       ?? "",
        MARCA:        ingreso?.marca        ?? "",
        CLASE:        getClaseByPVP(pvp),
        GESTOR:       ingreso?.gestor       ?? getGestorByLinea(linea),
        PROVEEDOR:    proveedor,
        PROVEEDOR_NIT: getProveedorNIT(proveedor),
        FUENTE:       ingreso?.fuente       ?? "SUPABASE",

        // HR y ANEXOS
        HR:     hrFormatted,
        ANEXOS: anexos,

        // ── Datos operativos (de distribuciones) ──────────────────────
        ESTADO:      dist.estado      ?? "PENDIENTE",
        COLABORADOR: dist.colaborador ?? "",

        // ── Datos de facturación (de SIESA) ───────────────────────────
        TIENE_FACTURA:     tieneFactura,
        NRO_FACTURA:       nroFactura,
        FACTURAS_DETALLE:  facturasDetalle,

        // Tiempos
        INICIO:               dist.inicio                ?? null,
        FIN:                  dist.fin                   ?? null,
        DURACION:             dist.duracion              ?? "00:00:00",
        DURACION_PAUSAS:      dist.duracion_pausas       ?? "00:00:00",
        DATETIME_ULTIMA_PAUSA: dist.datetime_ultima_pausa ?? null,
        PAUSAS:               dist.pausas                ?? null,

        // Timestamps
        FECHA_DISTRIBUCION: dist.fecha_distribucion,
        CREATED_AT:         dist.created_at,
        UPDATED_AT:         dist.updated_at,
        PRODUCTORA:         dist.productora ?? null,

        // ── Clientes enriquecidos ──────────────────────────────────────
        CLIENTES: clientesEnriquecidos,

        // Objeto DISTRIBUCION (compatibilidad con frontend existente)
        DISTRIBUCION: {
          Documento:   docId,
          Clientes:    clientesEnriquecidos,
          Colaborador: dist.colaborador ?? "",
        },
      };

      resultado.push(item);
    }

    // ── 4. Respuesta ───────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        total:   resultado.length,
        data:    resultado,
      }),
      {
        status: 200,
        headers: {
          "Content-Type":                "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ success: false, message: msg }),
      {
        status: 500,
        headers: {
          "Content-Type":                "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
