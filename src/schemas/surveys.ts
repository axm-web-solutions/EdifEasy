import { z } from 'zod'

export const surveyDraftSchema = z.object({
  title: z.string().trim().min(5, 'Escribe un titulo claro').max(140),
  description: z.string().trim().max(2000),
  vote_scope: z.enum(['PERSON', 'UNIT']),
  anonymous: z.boolean(),
  show_results: z.boolean(),
  closes_on: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Fecha invalida')
    .nullable(),
  questions: z
    .array(
      z.object({
        text: z.string().trim().min(3, 'Escribe la pregunta').max(300),
        multiple: z.boolean(),
        options: z
          .array(z.object({ text: z.string().trim().min(1, 'Escribe la opcion').max(200) }))
          .min(2, 'Agrega al menos 2 opciones')
          .max(12, 'Maximo 12 opciones'),
      }),
    )
    .min(1, 'Agrega al menos una pregunta')
    .max(20, 'Maximo 20 preguntas'),
})

export type SurveyDraftFormValues = z.infer<typeof surveyDraftSchema>
