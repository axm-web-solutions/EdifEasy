import { useState } from 'react'
import { useFieldArray, useForm, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { useSurveyMutations, useSurveys } from '@/hooks/useSurveys'
import { getErrorMessage } from '@/lib/errors'
import { surveyDraftSchema, type SurveyDraftFormValues } from '@/schemas/surveys'
import { EMPTY_DRAFT, formToDraft, surveyToForm } from './surveys.logic'

/** Crear o editar el borrador de una encuesta (preguntas y opciones). */
export function useSurveyEditorViewModel() {
  const { currentCondominiumId } = useAuth()
  const listQuery = useSurveys(currentCondominiumId)
  const { create, update } = useSurveyMutations()

  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const form = useForm<SurveyDraftFormValues>({
    resolver: zodResolver(surveyDraftSchema),
    defaultValues: EMPTY_DRAFT,
  })
  const questions = useFieldArray({ control: form.control, name: 'questions' })

  const openNew = () => {
    form.reset(EMPTY_DRAFT)
    setEditingId(null)
    create.reset()
    setOpen(true)
  }

  const openEdit = (id: string) => {
    const survey = listQuery.data?.find((item) => item.id === id)
    if (!survey) return
    form.reset(surveyToForm(survey))
    setEditingId(id)
    update.reset()
    setOpen(true)
  }

  const submit = form.handleSubmit((values) => {
    if (!currentCondominiumId) return
    const input = formToDraft(values)
    const onSuccess = () => setOpen(false)
    if (editingId) update.mutate({ surveyId: editingId, input }, { onSuccess })
    else create.mutate({ condominiumId: currentCondominiumId, input }, { onSuccess })
  })

  const error = create.error ?? update.error
  const questionsError =
    form.formState.errors.questions?.root?.message ?? form.formState.errors.questions?.message

  return {
    open,
    title: editingId ? 'Editar borrador' : 'Nueva encuesta',
    openNew,
    openEdit,
    close: () => setOpen(false),
    control: form.control,
    questions: questions.fields.map((field, index) => ({ key: field.id, index })),
    addQuestion: () =>
      questions.append({ text: '', multiple: false, options: [{ text: '' }, { text: '' }] }),
    removeQuestion: (index: number) => questions.remove(index),
    canRemoveQuestion: questions.fields.length > 1,
    questionsError: questionsError ?? null,
    submit,
    submitting: create.isPending || update.isPending,
    submitError: error ? getErrorMessage(error) : null,
  }
}

export type SurveyEditorViewModel = ReturnType<typeof useSurveyEditorViewModel>

/** Opciones de una pregunta (cada pregunta maneja su propio arreglo). */
export function useQuestionOptionsViewModel(
  control: Control<SurveyDraftFormValues>,
  questionIndex: number,
) {
  const options = useFieldArray({ control, name: `questions.${questionIndex}.options` })
  return {
    options: options.fields.map((field, index) => ({ key: field.id, index })),
    add: () => options.append({ text: '' }),
    remove: (index: number) => options.remove(index),
    canAdd: options.fields.length < 12,
    canRemove: options.fields.length > 2,
  }
}
