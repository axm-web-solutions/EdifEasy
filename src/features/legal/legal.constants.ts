import type { DataRequestStatus, DataRequestType } from '@/types/database'

/** Solicitudes de titulares (Ley 1581 de 2012, arts. 8, 14 y 15). */
export const DATA_REQUEST_TYPES: Record<DataRequestType, { label: string; hint: string }> = {
  ACCESS: {
    label: 'Consulta: conocer mis datos',
    hint: 'Te respondemos que datos tenemos, para que los usamos y con quien los compartimos. Plazo: 10 dias habiles.',
  },
  RECTIFY: {
    label: 'Actualizar o corregir mis datos',
    hint: 'Indica que dato esta mal y cual es el correcto. Plazo: 15 dias habiles.',
  },
  DELETE: {
    label: 'Suprimir mis datos',
    hint: 'Borramos tus datos salvo los que la ley obliga a conservar (pagos, contabilidad). Tu cuenta se cierra. Plazo: 15 dias habiles.',
  },
  REVOKE: {
    label: 'Revocar la autorizacion',
    hint: 'Dejamos de tratar tus datos para las finalidades que indiques. Plazo: 15 dias habiles.',
  },
  COMPLAINT: {
    label: 'Reclamo por el uso de mis datos',
    hint: 'Cuentanos que paso. Plazo: 15 dias habiles. Si no quedas conforme, puedes acudir a la SIC.',
  },
}

export const DATA_REQUEST_STATUS: Record<DataRequestStatus, { label: string; color: string }> = {
  OPEN: { label: 'Radicada', color: 'blue' },
  IN_PROGRESS: { label: 'En tramite', color: 'gold' },
  RESOLVED: { label: 'Respondida', color: 'green' },
  REJECTED: { label: 'No procedente', color: 'red' },
}
