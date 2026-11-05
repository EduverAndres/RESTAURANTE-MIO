#!/usr/bin/env node
/**
 * Limpia datos de prueba ("Perros Clientes Eduver", etc.) de la base de datos.
 * Ejecutar: node scripts/cleanup-test-data.mjs
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const TEST_PATTERNS = [
  'Perros Clientes Eduver',
  'Test Restaurant',
  'Restaurante Test',
  'Dummy',
  'Placeholder',
]

async function cleanup() {
  console.log('🧹 Iniciando limpieza de datos de prueba...')

  // 1. Buscar stores con nombres de prueba
  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('id, name, slug')
    .or(TEST_PATTERNS.map(p => `name.ilike.%${p}%`).join(','))

  if (storesError) {
    console.error('❌ Error buscando stores:', storesError)
    return
  }

  if (!stores || stores.length === 0) {
    console.log('✅ No se encontraron stores de prueba')
    return
  }

  console.log(`🔍 Encontrados ${stores.length} stores de prueba:`)
  stores.forEach(s => console.log(`   - ${s.name} (${s.slug})`))

  const storeIds = stores.map(s => s.id)

  // 2. Eliminar datos relacionados (orders, menu_items, categories, etc.)
  const tables = [
    'orders',
    'order_items',
    'menu_items',
    'categories',
    'favorites',
    'reviews',
    'tables',
    'store_assets',
  ]

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .in('store_id', storeIds)

    if (error) {
      console.warn(`⚠️ Error limpiando ${table}:`, error.message)
    } else {
      console.log(`   ✅ ${table} limpiado`)
    }
  }

  // 3. Eliminar los stores
  const { error: deleteError } = await supabase
    .from('stores')
    .delete()
    .in('id', storeIds)

  if (deleteError) {
    console.error('❌ Error eliminando stores:', deleteError)
  } else {
    console.log(`✅ ${stores.length} stores de prueba eliminados`)
  }

  console.log('🎉 Limpieza completada')
}

cleanup().catch(console.error)