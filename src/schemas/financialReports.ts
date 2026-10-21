import { z } from 'zod'

export const financialReportSchema = z
  .object({
    title: z.string().trim().min(3, 'Escribe un titulo').max(140),
    category: z.enum([
      'FINANCIAL_STATEMENTS',
      'BUDGET',
      'PORTFOLIO',
      'TAXES',
      'AUDIT',
      'ASSEMBLY',
      'OTHER',
    ]),
    report_type: z.enum(['BALANCE', 'RESULTS', 'BUDGET', 'PORTFOLIO', 'DOCUMENT']),
    period: z.string(),
    year: z.number().int().nullable(),
    summary: z.string().trim().max(4000),
    publish: z.boolean(),
  })
  .refine((v) => !['BALANCE', 'RESULTS'].includes(v.report_type) || v.period !== '', {
    path: ['period'],
    message: 'Elige el mes',
  })
  .refine((v) => v.report_type !== 'BUDGET' || v.year !== null, {
    path: ['year'],
    message: 'Elige el ano',
  })

export type FinancialReportFormValues = z.infer<typeof financialReportSchema>

export const taxObligationSchema = z.object({
  name: z.string().trim().min(3, 'Escribe la obligacion').max(140),
  authority: z.enum(['DIAN', 'MUNICIPIO', 'UGPP', 'SUPERSOLIDARIA', 'OTRA']),
  period_label: z.string().trim().max(60),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha de vencimiento'),
  status: z.enum(['PENDING', 'FILED', 'PAID', 'NOT_APPLICABLE']),
  amount: z.number().min(0).nullable(),
  reference: z.string().trim().max(80),
  notes: z.string().trim().max(1000),
})

export type TaxObligationFormValues = z.infer<typeof taxObligationSchema>
