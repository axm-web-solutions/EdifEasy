import { Alert, Button, Card } from 'antd'
import { Plus, Trash2, X } from 'lucide-react'
import type { Control } from 'react-hook-form'
import { FormDrawer } from '@/components/ui/FormDrawer'
import {
  DateField,
  SelectField,
  SwitchField,
  TextAreaField,
  TextField,
} from '@/components/forms/fields'
import type { SurveyDraftFormValues } from '@/schemas/surveys'
import {
  useQuestionOptionsViewModel,
  type SurveyEditorViewModel,
} from '../viewmodels/useSurveyEditorViewModel'

function QuestionEditor({
  control,
  index,
  onRemove,
  canRemove,
}: {
  control: Control<SurveyDraftFormValues>
  index: number
  onRemove: () => void
  canRemove: boolean
}) {
  const vm = useQuestionOptionsViewModel(control, index)
  return (
    <Card size="small" className="!mb-3 !bg-slate-50">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">Pregunta {index + 1}</span>
        {canRemove ? (
          <Button
            size="small"
            type="text"
            icon={<Trash2 size={14} />}
            aria-label={`Quitar pregunta ${index + 1}`}
            onClick={onRemove}
          />
        ) : null}
      </div>
      <TextField
        control={control}
        name={`questions.${index}.text`}
        label="Pregunta"
        required
        placeholder="Ej: Esta de acuerdo con pintar la fachada?"
      />
      <p className="mb-1 text-sm text-slate-700">Opciones</p>
      {vm.options.map((option) => (
        <div key={option.key} className="flex items-start gap-1">
          <TextField
            control={control}
            name={`questions.${index}.options.${option.index}.text`}
            label=""
            className="flex-1"
            placeholder={`Opcion ${option.index + 1}`}
          />
          {vm.canRemove ? (
            <Button
              type="text"
              icon={<X size={14} />}
              aria-label={`Quitar opcion ${option.index + 1}`}
              onClick={() => vm.remove(option.index)}
            />
          ) : null}
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {vm.canAdd ? (
          <Button size="small" icon={<Plus size={14} />} onClick={vm.add}>
            Opcion
          </Button>
        ) : (
          <span />
        )}
        <SwitchField
          control={control}
          name={`questions.${index}.multiple`}
          label="Permite varias respuestas"
          className="!mb-0"
        />
      </div>
    </Card>
  )
}

export function SurveyEditorDrawer({ vm }: { vm: SurveyEditorViewModel }) {
  return (
    <FormDrawer
      open={vm.open}
      title={vm.title}
      description="Se guarda como borrador. Nadie la ve hasta que la abras."
      onClose={vm.close}
      onSubmit={vm.submit}
      submitting={vm.submitting}
      submitLabel="Guardar borrador"
      width={600}
    >
      <form onSubmit={vm.submit} noValidate>
        {vm.submitError ? (
          <Alert type="error" showIcon message={vm.submitError} className="!mb-4" />
        ) : null}
        <TextField control={vm.control} name="title" label="Titulo" required maxLength={140} />
        <TextAreaField
          control={vm.control}
          name="description"
          label="Contexto"
          rows={3}
          maxLength={2000}
          placeholder="Explica por que se pregunta y que se hara con el resultado."
        />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <SelectField
            control={vm.control}
            name="vote_scope"
            label="Quien vota"
            showSearch={false}
            options={[
              { value: 'PERSON', label: 'Cada persona' },
              { value: 'UNIT', label: 'Un voto por apartamento' },
            ]}
          />
          <DateField
            control={vm.control}
            name="closes_on"
            label="Cierra automaticamente"
            help="Opcional. Tambien la puedes cerrar a mano."
          />
          <SwitchField control={vm.control} name="anonymous" label="Votos anonimos" />
          <SwitchField
            control={vm.control}
            name="show_results"
            label="Mostrar resultados a quien vote"
          />
        </div>

        <h4 className="mb-2 mt-2 text-sm font-semibold text-slate-700">Preguntas</h4>
        {vm.questionsError ? (
          <Alert type="warning" showIcon message={vm.questionsError} className="!mb-3" />
        ) : null}
        {vm.questions.map((question) => (
          <QuestionEditor
            key={question.key}
            control={vm.control}
            index={question.index}
            canRemove={vm.canRemoveQuestion}
            onRemove={() => vm.removeQuestion(question.index)}
          />
        ))}
        <Button block type="dashed" icon={<Plus size={14} />} onClick={vm.addQuestion}>
          Agregar pregunta
        </Button>
      </form>
    </FormDrawer>
  )
}
