import {
  Alert,
  Button,
  Card,
  Checkbox,
  Drawer,
  Modal,
  Progress,
  Radio,
  Segmented,
  Skeleton,
  Tag,
} from 'antd'
import { BarChart3, Lock, Pencil, Play, Plus, Square, Trash2, Vote } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { confirmDelete } from '@/components/ui/FormDrawer'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { SurveyEditorDrawer } from '../components/SurveyEditorDrawer'
import type { SurveyFilter, SurveyView } from '../viewmodels/surveys.logic'
import { useSurveyEditorViewModel } from '../viewmodels/useSurveyEditorViewModel'
import { useSurveysViewModel, type SurveysViewModel } from '../viewmodels/useSurveysViewModel'

function SurveyCard({
  item,
  vm,
  onEdit,
}: {
  item: SurveyView
  vm: SurveysViewModel
  onEdit: (id: string) => void
}) {
  return (
    <Card size="small" className="surface-card" styles={{ body: { padding: 16 } }}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-slate-800">{item.title}</span>
            <Tag color={item.statusColor} bordered={false} className="!m-0">
              {item.statusLabel}
            </Tag>
            {item.voted ? (
              <Tag color="green" bordered={false} className="!m-0">
                Ya votaste
              </Tag>
            ) : null}
          </div>
          {item.description ? (
            <p className="m-0 mt-1 line-clamp-2 text-sm text-slate-600">{item.description}</p>
          ) : null}
          <p className="m-0 mt-1 text-xs text-slate-500">
            {item.questionCount} {item.questionCount === 1 ? 'pregunta' : 'preguntas'} · {item.meta}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          {item.canVote ? (
            <Button type="primary" icon={<Vote size={16} />} onClick={() => vm.openVote(item.id)}>
              Votar
            </Button>
          ) : null}
          {item.canSeeResults ? (
            <Button icon={<BarChart3 size={16} />} onClick={() => vm.openResults(item.id)}>
              Resultados
            </Button>
          ) : null}
          {item.canEdit ? (
            <Button icon={<Pencil size={16} />} onClick={() => onEdit(item.id)}>
              Editar
            </Button>
          ) : null}
          {item.canOpen ? (
            <Button
              type="primary"
              icon={<Play size={16} />}
              loading={vm.busyId === item.id}
              onClick={() =>
                Modal.confirm({
                  title: 'Abrir encuesta',
                  content:
                    'Se notificara a los miembros del conjunto y ya no podras editar las preguntas.',
                  okText: 'Abrir',
                  cancelText: 'Volver',
                  onOk: () => vm.open(item.id),
                })
              }
            >
              Abrir
            </Button>
          ) : null}
          {item.canClose ? (
            <Button
              icon={<Square size={16} />}
              loading={vm.busyId === item.id}
              onClick={() =>
                Modal.confirm({
                  title: 'Cerrar encuesta',
                  content: 'Nadie mas podra votar.',
                  okText: 'Cerrar',
                  cancelText: 'Volver',
                  onOk: () => vm.close(item.id),
                })
              }
            >
              Cerrar
            </Button>
          ) : null}
          {item.canEdit ? (
            <Button
              type="text"
              danger
              icon={<Trash2 size={16} />}
              aria-label="Eliminar borrador"
              onClick={async () => {
                if (await confirmDelete({ title: 'Eliminar borrador' })) vm.remove(item.id)
              }}
            />
          ) : null}
        </div>
      </div>
    </Card>
  )
}

function VoteModal({ vm }: { vm: SurveysViewModel }) {
  const voting = vm.voting
  return (
    <Modal
      open={Boolean(voting)}
      title={voting?.title}
      onCancel={vm.closeVote}
      onOk={vm.submitVote}
      okText="Enviar voto"
      cancelText="Cancelar"
      confirmLoading={vm.submittingVote}
      destroyOnClose
      width={560}
    >
      {voting ? (
        <div className="space-y-4">
          {voting.description ? (
            <p className="m-0 whitespace-pre-line text-sm text-slate-600">{voting.description}</p>
          ) : null}
          {voting.questions.map((question, index) => (
            <fieldset key={question.id} className="m-0 border-0 p-0">
              <legend className="mb-2 text-sm font-semibold text-slate-800">
                {index + 1}. {question.text}
                {question.multiple ? (
                  <span className="ml-1 font-normal text-slate-500">(puedes elegir varias)</span>
                ) : null}
              </legend>
              {question.multiple ? (
                <Checkbox.Group
                  className="flex flex-col gap-2"
                  value={question.selected}
                  options={question.options}
                  onChange={(values) => vm.answer(question.id, values as string[])}
                />
              ) : (
                <Radio.Group
                  className="flex flex-col gap-2"
                  value={question.selected[0]}
                  options={question.options}
                  onChange={(event) => vm.answer(question.id, [event.target.value as string])}
                />
              )}
            </fieldset>
          ))}
          <p className="m-0 flex items-center gap-1 text-xs text-slate-500">
            {voting.anonymous ? <Lock size={12} /> : null}
            {voting.anonymous ? 'Voto anonimo. ' : ''}
            {voting.scopeNote} El voto no se puede cambiar.
          </p>
          {vm.voteError ? <Alert type="error" showIcon message={vm.voteError} /> : null}
        </div>
      ) : null}
    </Modal>
  )
}

function ResultsDrawer({ vm }: { vm: SurveysViewModel }) {
  const isMobile = useIsMobile()
  return (
    <Drawer
      open={vm.resultsOpen}
      onClose={vm.closeResults}
      title={vm.resultsTitle}
      width={isMobile ? '100%' : 520}
      destroyOnClose
    >
      {vm.resultsLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : vm.resultsError ? (
        <Alert type="error" showIcon message={vm.resultsError} />
      ) : vm.results?.hidden ? (
        <EmptyState
          title="Resultados reservados"
          description="La administracion los publicara al cerrar la encuesta."
        />
      ) : vm.results ? (
        <div className="space-y-5">
          <p className="m-0 text-sm text-slate-600">{vm.results.ballotsLabel}</p>
          {vm.results.questions.map((question, index) => (
            <section key={question.id}>
              <h4 className="mb-2 text-sm font-semibold text-slate-800">
                {index + 1}. {question.text}
              </h4>
              <ul className="m-0 list-none space-y-2 p-0">
                {question.options.map((option) => (
                  <li key={option.id}>
                    <div className="flex justify-between text-sm">
                      <span
                        className={
                          option.leading ? 'font-semibold text-slate-800' : 'text-slate-700'
                        }
                      >
                        {option.text}
                      </span>
                      <span className="text-slate-500">
                        {option.votes} · {option.percent}%
                      </span>
                    </div>
                    <Progress
                      percent={option.percent}
                      showInfo={false}
                      size="small"
                      strokeColor={option.leading ? 'var(--edifeasy-brand)' : undefined}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </Drawer>
  )
}

export function SurveysPage() {
  const vm = useSurveysViewModel()
  const editor = useSurveyEditorViewModel()

  return (
    <div>
      <PageHeader
        title="Encuestas"
        subtitle="Pregunta a la comunidad y decide con datos."
        dataTour="surveys-header"
        actions={
          vm.canManage ? (
            <Button type="primary" icon={<Plus size={16} />} onClick={editor.openNew}>
              Nueva encuesta
            </Button>
          ) : null
        }
      />

      <Segmented
        className="!mb-4"
        value={vm.filter}
        onChange={(value) => vm.setFilter(value as SurveyFilter)}
        options={vm.filterOptions}
      />

      {vm.status === 'loading' ? (
        <Card className="surface-card">
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      ) : vm.status === 'error' ? (
        <ErrorState onRetry={vm.retry} />
      ) : vm.status === 'empty' ? (
        <EmptyState
          title="Nada por aqui"
          description={vm.emptyText}
          action={
            vm.canManage ? (
              <Button type="primary" onClick={editor.openNew}>
                Crear encuesta
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {vm.surveys.map((item) => (
            <SurveyCard key={item.id} item={item} vm={vm} onEdit={editor.openEdit} />
          ))}
        </div>
      )}

      <VoteModal vm={vm} />
      <ResultsDrawer vm={vm} />
      {vm.canManage ? <SurveyEditorDrawer vm={editor} /> : null}
    </div>
  )
}
