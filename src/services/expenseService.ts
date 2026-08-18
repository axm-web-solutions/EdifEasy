import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { runList } from './query'
import type { ExpenseCategoryRow, ExpenseRow, TablesInsert, TablesUpdate } from '@/types/database'
import type { ExpenseWithRelations, ListParams, ListResult } from '@/types/models'

const SELECT = `
  *,
  category:expense_categories(id, name, color),
  author:profiles!expenses_created_by_fkey(id, full_name, email, avatar_url, phone)
`

export interface MonthlySeriesPoint {
  period: string
  total: number
}

export interface CategoryTotal {
  category: string
  color: string
  total: number
}

export const expenseService = {
  async list(condominiumId: string, params: ListParams): Promise<ListResult<ExpenseWithRelations>> {
    const query = supabase
      .from('expenses')
      .select(SELECT, { count: 'exact' })
      .eq('condominium_id', condominiumId)
    return runList<ExpenseWithRelations>(query, params, {
      searchColumns: ['concept', 'provider', 'invoice_number', 'description'],
      defaultSort: { column: 'expense_date', ascending: false },
      dateColumn: 'expense_date',
    })
  },

  async getById(id: string): Promise<ExpenseWithRelations | null> {
    const { data, error } = await supabase
      .from('expenses')
      .select(SELECT)
      .eq('id', id)
      .returns<ExpenseWithRelations[]>()
      .maybeSingle()
    if (error) throw toAppError(error)
    return data
  },

  async create(values: TablesInsert<'expenses'>): Promise<ExpenseRow> {
    const { data, error } = await supabase.from('expenses').insert(values).select('*').single()
    if (error) throw toAppError(error)
    return data
  },

  async update(id: string, values: TablesUpdate<'expenses'>): Promise<ExpenseRow> {
    const { data, error } = await supabase
      .from('expenses')
      .update(values)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw toAppError(error)
  },

  // -------------------------------------------------------------------------
  // Categorias
  // -------------------------------------------------------------------------
  async categories(condominiumId: string): Promise<ExpenseCategoryRow[]> {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('condominium_id', condominiumId)
      .order('name', { ascending: true })
    if (error) throw toAppError(error)
    return data
  },

  async createCategory(values: TablesInsert<'expense_categories'>): Promise<ExpenseCategoryRow> {
    const { data, error } = await supabase
      .from('expense_categories')
      .insert(values)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async updateCategory(
    id: string,
    values: TablesUpdate<'expense_categories'>,
  ): Promise<ExpenseCategoryRow> {
    const { data, error } = await supabase
      .from('expense_categories')
      .update(values)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw toAppError(error)
    return data
  },

  async removeCategory(id: string): Promise<void> {
    const { error } = await supabase.from('expense_categories').delete().eq('id', id)
    if (error) throw toAppError(error)
  },

  // -------------------------------------------------------------------------
  // Series para graficas
  // -------------------------------------------------------------------------
  async monthlySeries(condominiumId: string, months = 6): Promise<MonthlySeriesPoint[]> {
    const { data, error } = await supabase.rpc('expenses_monthly_series', {
      p_condominium: condominiumId,
      p_months: months,
    })
    if (error) throw toAppError(error)
    const rows = (data ?? []) as MonthlySeriesPoint[]
    return rows.map((row) => ({ period: row.period, total: Number(row.total) }))
  },

  async byCategory(condominiumId: string): Promise<CategoryTotal[]> {
    const { data, error } = await supabase.rpc('expenses_by_category', {
      p_condominium: condominiumId,
    })
    if (error) throw toAppError(error)
    const rows = (data ?? []) as CategoryTotal[]
    return rows.map((row) => ({
      category: row.category,
      color: row.color,
      total: Number(row.total),
    }))
  },
}
