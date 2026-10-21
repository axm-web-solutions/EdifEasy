import { describe, expect, it } from 'vitest'
import {
  buildAccountingRows,
  fromAlegraInvoice,
  fromAlegraPayment,
  fromSiigoInvoice,
  fromSiigoVoucher,
  syncStartDate,
  unitCodeFromName,
} from './accounting'

describe('codigo de unidad en el nombre del cliente', () => {
  it('reconoce los formatos comunes', () => {
    expect(unitCodeFromName('T1-301 Ana Perez')).toBe('T1-301')
    expect(unitCodeFromName('Torre 2 Apto 504 - Carlos Ruiz')).toBe('T2-504')
    expect(unitCodeFromName('Bloque 3 # 201')).toBe('T3-201')
    expect(unitCodeFromName('Casa 07 Familia Gomez')).toBe('07')
    expect(unitCodeFromName('Apartamento 1203')).toBe('1203')
    expect(unitCodeFromName('Interior 4 apto 102')).toBe('T4-102')
    expect(unitCodeFromName('2-301 Maria')).toBe('2-301')
    expect(unitCodeFromName('Proveedor de aseo SAS')).toBeNull()
  })
})

describe('Alegra', () => {
  const invoice = {
    id: 55,
    date: '2026-09-01',
    dueDate: '2026-09-10',
    status: 'open',
    total: 320000,
    balance: 320000,
    numberTemplate: { fullNumber: 'FV-55' },
    client: { name: 'T1-101 Ana', identification: '1020' },
    items: [{ name: 'Cuota de administracion septiembre' }],
  }
  it('factura y pago', () => {
    expect(fromAlegraInvoice(invoice)).toMatchObject({
      kind: 'CHARGE',
      id: 'alegra-inv-55',
      document: 'FV-55',
      concept: 'Cuota de administracion septiembre',
      balance: 320000,
    })
    expect(fromAlegraInvoice({ ...invoice, status: 'void' })).toBeNull()
    expect(
      fromAlegraPayment({
        id: 9,
        date: '2026-10-02',
        amount: '320000',
        type: 'in',
        client: { name: 'T1-101 Ana' },
      }),
    ).toMatchObject({ kind: 'PAYMENT', amount: 320000, id: 'alegra-pay-9' })
    expect(fromAlegraPayment({ id: 10, date: '2026-10-02', amount: 5, type: 'out' })).toBeNull()
  })
})

describe('Siigo', () => {
  it('factura con vencimiento en pagos y recibo de caja', () => {
    expect(
      fromSiigoInvoice({
        id: 'abc',
        name: 'FV-1-120',
        date: '2026-09-01',
        total: 400000,
        balance: 100000,
        customer: { identification: '900123', name: 'T2-504 Carlos' },
        payments: [{ due_date: '2026-09-15', value: 400000 }],
        items: [{ description: 'Cuota septiembre' }],
      }),
    ).toMatchObject({
      id: 'siigo-inv-abc',
      dueDate: '2026-09-15',
      balance: 100000,
      customerIdentification: '900123',
    })
    expect(
      fromSiigoVoucher({
        id: 'r1',
        name: 'RC-1-5',
        date: '2026-10-03',
        customer: { identification: '900123' },
        items: [{ value: 150000 }, { value: 150000 }],
      }),
    ).toMatchObject({ kind: 'PAYMENT', amount: 300000 })
    expect(fromSiigoInvoice({ id: 'x', date: '2026-09-01', annulled: true })).toBeNull()
  })
})

describe('estado de cuenta desde documentos', () => {
  it('suma saldos, vencido y ultimo pago por unidad', () => {
    const docs = [
      fromAlegraInvoice({
        id: 1,
        date: '2026-08-01',
        dueDate: '2026-08-10',
        status: 'open',
        total: 320000,
        balance: 320000,
        client: { name: 'T1-101 Ana' },
      }),
      fromAlegraInvoice({
        id: 2,
        date: '2026-10-01',
        dueDate: '2026-10-30',
        status: 'open',
        total: 320000,
        balance: 320000,
        client: { name: 'T1-101 Ana' },
      }),
      fromAlegraInvoice({
        id: 3,
        date: '2026-09-01',
        dueDate: '2026-09-10',
        status: 'closed',
        total: 320000,
        balance: 0,
        client: { name: 'T1-101 Ana' },
      }),
      fromAlegraPayment({
        id: 7,
        date: '2026-09-05',
        amount: 320000,
        type: 'in',
        client: { name: 'T1-101 Ana' },
      }),
      fromAlegraPayment({
        id: 8,
        date: '2026-07-05',
        amount: 100000,
        type: 'in',
        client: { name: 'T1-101 Ana' },
      }),
      fromAlegraInvoice({
        id: 4,
        date: '2026-10-01',
        status: 'open',
        total: 50000,
        balance: 50000,
        client: { name: 'Proveedor SAS' },
      }),
    ]
    const result = buildAccountingRows(docs, { today: '2026-10-20' })
    expect(result.statements).toEqual([
      {
        unit: 'T1-101',
        balance: 640000,
        overdue: 320000,
        interest: 0,
        last_payment_date: '2026-09-05',
        last_payment_amount: 320000,
      },
    ])
    expect(result.movements).toHaveLength(5)
    expect(result.movements.find((m) => m.external_id === 'alegra-pay-7')).toMatchObject({
      debit: 0,
      credit: 320000,
    })
    expect(result.withoutUnit).toEqual(['Proveedor SAS'])
  })

  it('por identificacion usa el documento del cliente', () => {
    const docs = [
      fromSiigoInvoice({
        id: 'a',
        date: '2026-10-01',
        total: 10,
        balance: 10,
        customer: { identification: '900123' },
      }),
    ]
    expect(
      buildAccountingRows(docs, { today: '2026-10-20', matchBy: 'IDENTIFICATION' }).statements[0]
        .unit,
    ).toBe('900123')
  })

  it('ventana de sincronizacion', () => {
    expect(syncStartDate('2026-10-20', 12)).toBe('2025-10-20')
    expect(syncStartDate('2026-10-20', 0)).toBe('2026-09-20')
  })
})
