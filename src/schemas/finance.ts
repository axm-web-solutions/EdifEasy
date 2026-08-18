import { z } from 'zod'

const optionalText = (max: number) => z.string().max(max).optional().or(z.literal(''))
const optionalUuid = z.string().uuid().optional().nullable().or(z.literal(''))

export const expenseSchema = z.object({
  concept: z.string().min(3, 'El concepto debe tener al menos 3 caracteres').max(150),
  category_id: optionalUuid,
  provider: optionalText(150),
  amount: z.coerce.number().min(0, 'El valor no puede ser negativo').max(999_999_999_999),
  expense_date: z.string().min(1, 'La fecha es obligatoria'),
  invoice_number: optionalText(60),
  document_url: z.string().url('URL invalida').optional().or(z.literal('')),
  description: optionalText(1000),
  status: z.enum(['PENDING', 'APPROVED', 'PAID', 'REJECTED']).default('PENDING'),
})

export const expenseCategorySchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio').max(80),
  code: optionalText(10),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Usa un color hexadecimal, por ejemplo #2559eb')
    .default('#2559eb'),
  description: optionalText(300),
})

const purchaseItemSchema = z.object({
  id: z.string().uuid().optional(),
  product: z.string().min(2, 'El producto es obligatorio').max(150),
  description: optionalText(300),
  quantity: z.coerce.number().min(0.01, 'La cantidad debe ser mayor a 0').max(999_999),
  unit_price: z.coerce.number().min(0, 'El precio no puede ser negativo').max(999_999_999),
})

export const purchaseSchema = z.object({
  provider: z.string().min(2, 'El proveedor es obligatorio').max(150),
  purchase_date: z.string().min(1, 'La fecha es obligatoria'),
  status: z.enum(['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED']).default('DRAFT'),
  invoice_number: optionalText(60),
  document_url: z.string().url('URL invalida').optional().or(z.literal('')),
  notes: optionalText(1000),
  items: z.array(purchaseItemSchema).min(1, 'Agrega al menos un producto'),
})

export type ExpenseFormValues = z.infer<typeof expenseSchema>
export type ExpenseCategoryFormValues = z.infer<typeof expenseCategorySchema>
export type PurchaseItemFormValues = z.infer<typeof purchaseItemSchema>
export type PurchaseFormValues = z.infer<typeof purchaseSchema>
