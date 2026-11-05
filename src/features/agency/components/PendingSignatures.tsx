import { Alert, Button } from 'antd'
import { FileSignature } from 'lucide-react'
import { usePendingSignaturesViewModel } from '../viewmodels/usePendingSignaturesViewModel'

/** Aviso de contratos por firmar (se oculta si no hay ninguno). */
export function PendingSignatures() {
  const vm = usePendingSignaturesViewModel()
  if (vm.items.length === 0) return null
  return (
    <div className="mb-4 space-y-2">
      {vm.items.map((item) => (
        <Alert
          key={item.id}
          type="warning"
          showIcon
          icon={<FileSignature size={18} />}
          message={`Tienes un contrato para firmar: ${item.title}`}
          description={`Firmas como ${item.role}. Lo lees y lo firmas aqui mismo, desde el celular o el computador.`}
          action={
            <Button type="primary" size="small" loading={vm.opening} onClick={() => vm.open(item.id)}>
              Leer y firmar
            </Button>
          }
        />
      ))}
    </div>
  )
}
