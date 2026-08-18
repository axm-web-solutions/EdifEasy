import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import type { PurchaseItemRow, PurchaseRow, TablesInsert, TablesUpdate } from '@/types/database'
import type { ListParams, ListResult, PurchaseWithRelations } from '@/types/models'

const SELECT = `
  *,
  items:purchase_items(*),
  author:profiles!purchases_created_by_fkey(id, full_name, email, avatar_url, phone)
`

export interface PurchaseItemInput {
  id?: string
  product: string
  description?: string | null
  quantity: number
  unit_price: number
}

export const purchaseService = {
  async list(condominiumId: string, params: ListParams): Promise<ListResult<PurchaseWithRelations>> {
    const query = supabase
      .from('purchases')
      .select(SELECT, { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<PurchaseWithRelations>(query, params, {
      searchColumns: ['provider', 'code', 'invoice_number', 'notes'],
      defaultSort: { column: 'purchase_date', ascending: false },
      dateColumn: 'purchase_date',
    })
  },

  async getById(id: string): Promise<PurchaseWithRelations | null> {
    const { data, error } = await supabase
      .from('purchases')
      .select(SELECT)
      .eq('id', id)
      .returns<PurchaseWithRelations[]>()
      .maybeSingle()
    if (error) throw toAppError(error)
    return data
  },

  /** Crea la compra y sus items en una sola operacion. */
  async create(
    values: TablesInsert<'purchases'>,
    items: PurchaseItemInput[],
  ): Promise<PurchaseRow> {
    const { data, error } = await supabase.from('purchases').insert(values).select('*').single()
    if (error) throw toAppError(error)

    if (items.length > 0) {
      const { error: itemsError } = await supabase.from('purchase_items').insert(
        items.map((item) => ({
          purchase_id: data.id,
          product: item.product,
          description: item.description ?? null,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      )
      if (itemsError) {
        // Rollback manual: la compra sin items quedaria inconsistente.
        await supabase.from('purchases').delete().eq('id', data.id)
        throw toAppError(itemsError)
      }
    }

    return data
  },

  /** Actualiza la compra y reemplaza sus items. El total lo recalcula un trigger. */
  async update(
    id: string,
    values: TablesUpdate<'purchases'>,
    items: PurchaseItemInput[],
  ): Promise<PurchaseRow> {
    const { data, error } = await supabase
      .from('purchases')
      .update(values)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)

    const { error: deleteError } = await supabase.from('purchase_items').delete().eq('purchase_id', id)
    if (deleteError) throw toAppError(deleteError)

    if (items.length > 0) {
      const { error: itemsError } = await supabase.from('purchase_items').insert(
        items.map((item) => ({
          purchase_id: id,
          product: item.product,
          description: item.description ?? null,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      )
      if (itemsError) throw toAppError(itemsError)
    }

    return data
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('purchases').delete().eq('id', id)
    if (error) throw toAppError(error)
  },

  async items(purchaseId: string): Promise<PurchaseItemRow[]> {
    const { data, error } = await supabase
      .from('purchase_items')
      .select('*')
      .eq('purchase_id', purchaseId)
      .order('created_at', { ascending: true })
    if (error) throw toAppError(error)
    return data
  },
}
