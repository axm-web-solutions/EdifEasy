import { describe, expect, it } from 'vitest'
import {
  agingBuckets,
  contractTemplate,
  lateInterest,
  leaseCurrentEnd,
  numberToWords,
  pesos,
  renewalInfo,
  rentIncreasePreview,
  settlementPreview,
  type ContractInput,
} from './management.logic'

const terms = {
  start_date: '2025-03-01',
  end_date: null,
  term_months: 12,
  auto_renew: true,
  notice_months: 3,
  notice_given_at: null,
  last_increase_at: null,
  policy_expires_at: null,
  status: 'ACTIVE' as const,
}
const at = (value: string) => new Date(`${value}T12:00:00`)

describe('vencimientos', () => {
  it('fin del periodo con y sin prorroga', () => {
    expect(leaseCurrentEnd(terms, at('2025-06-01'))).toBe('2026-02-28')
    expect(leaseCurrentEnd(terms, at('2026-11-04'))).toBe('2027-02-28')
    expect(leaseCurrentEnd({ ...terms, auto_renew: false }, at('2026-11-04'))).toBe('2026-02-28')
    expect(leaseCurrentEnd({ ...terms, end_date: '2026-12-31' }, at('2026-11-04'))).toBe(
      '2026-12-31',
    )
  })

  it('preaviso, incremento y poliza', () => {
    const info = renewalInfo(
      { ...terms, end_date: '2027-01-31', policy_expires_at: '2026-11-20' },
      at('2026-11-04'),
    )
    expect(info.daysLeft).toBe(88)
    expect(info.bucket).toBe('D90')
    expect(info.noticeDeadline).toBe('2026-10-31')
    expect(info.noticeUrgent).toBe(true)
    expect(info.nextIncrease).toBe('2026-03-01')
    expect(info.increaseDue).toBe(true)
    expect(info.policyExpiring).toBe(true)
    const calm = renewalInfo({ ...terms, last_increase_at: '2026-03-01' }, at('2026-11-04'))
    expect(calm.increaseDue).toBe(false)
    expect(calm.bucket).toBeNull()
  })
})

describe('incremento del canon', () => {
  it('vivienda: tope del IPC aunque se pacten puntos', () => {
    expect(
      rentIncreasePreview({ rent: 2000000, indexPct: 5.2, rule: 'IPC', points: 0, use: 'VIVIENDA' }),
    ).toEqual({ pct: 5.2, newRent: 2104000, capped: false })
    expect(
      rentIncreasePreview({
        rent: 2000000,
        indexPct: 5.2,
        rule: 'IPC_PLUS',
        points: 2,
        use: 'VIVIENDA',
      }),
    ).toEqual({ pct: 5.2, newRent: 2104000, capped: true })
  })
  it('comercial: IPC + puntos', () => {
    expect(
      rentIncreasePreview({
        rent: 4000000,
        indexPct: 5,
        rule: 'IPC_PLUS',
        points: 2,
        use: 'COMERCIAL',
      }).newRent,
    ).toBe(4280000)
  })
})

describe('mora y cartera', () => {
  it('interes proporcional a los dias', () => {
    expect(lateInterest(2000000, 1.5, 30)).toBe(30000)
    expect(lateInterest(2000000, 1.5, 15)).toBe(15000)
    expect(lateInterest(2000000, 0, 15)).toBe(0)
  })
  it('agrupa lo vencido por edades', () => {
    const buckets = agingBuckets(
      [
        { amount: 100, dueDate: '2026-10-25', isPending: true },
        { amount: 200, dueDate: '2026-09-20', isPending: true },
        { amount: 300, dueDate: '2026-05-01', isPending: true },
        { amount: 999, dueDate: '2026-05-01', isPending: false },
        { amount: 50, dueDate: '2026-12-01', isPending: true },
      ],
      at('2026-11-04'),
    )
    expect(buckets.map((bucket) => bucket.total)).toEqual([100, 200, 0, 300])
  })
})

describe('liquidacion', () => {
  it('misma cuenta que la base', () => {
    expect(
      settlementPreview(
        2104000,
        { commission_pct: 10, charges_vat: true, vat_pct: 19, withholding_pct: 0 },
        180000,
      ),
    ).toEqual({
      gross: 2104000,
      commission: 210400,
      vat: 39976,
      withholding: 0,
      expenses: 180000,
      net: 1673624,
    })
    expect(
      settlementPreview(3000000, {
        commission_pct: 10,
        charges_vat: false,
        vat_pct: 19,
        withholding_pct: 3.5,
      }).net,
    ).toBe(2595000)
  })
})

describe('numeros en letras', () => {
  it('pesos colombianos', () => {
    expect(numberToWords(2500000)).toBe('dos millones quinientos mil')
    expect(numberToWords(1000000)).toBe('un millon')
    expect(numberToWords(350000)).toBe('trescientos cincuenta mil')
    expect(numberToWords(21000)).toBe('veintiun mil')
    expect(numberToWords(101)).toBe('ciento uno')
    expect(numberToWords(100)).toBe('cien')
    expect(numberToWords(1980450)).toBe('un millon novecientos ochenta mil cuatrocientos cincuenta')
    expect(pesos(2000000)).toContain('dos millones de pesos m/cte')
  })
})

describe('plantilla del contrato', () => {
  const input: ContractInput = {
    city: 'Bogota',
    agency: { name: 'Inmobiliaria Sol', document: '900123456' },
    ownerName: 'Pedro Propietario',
    tenant: { name: 'Ana Arrendataria', document: '52111222', email: 'ana@x.com' },
    guarantors: [{ name: 'Carlos Codeudor', document: '80111222' }],
    property: { title: 'Apartamento Cedritos', address: 'Calle 147 # 12-30', city: 'Bogota' },
    lease: {
      lease_use: 'VIVIENDA',
      start_date: '2026-11-01',
      term_months: 12,
      auto_renew: true,
      monthly_rent: 2500000,
      admin_fee: 350000,
      due_day: 5,
      increase_rule: 'IPC',
      increase_points: 0,
      notice_months: 3,
      late_interest_pct: 1.5,
      insurer: 'El Libertador',
      policy_number: 'P-1',
      deposit: null,
    },
  }
  it('vivienda: Ley 820, sin deposito, codeudor y firma electronica', () => {
    const text = contractTemplate(input)
    expect(text).toMatch(/^CONTRATO DE ARRENDAMIENTO DE VIVIENDA URBANA/)
    expect(text).toContain('(dos millones quinientos mil pesos m/cte)')
    expect(text).toContain('articulo 20 de la Ley 820')
    expect(text).toContain('no se exige deposito')
    expect(text).toContain('Carlos Codeudor')
    expect(text).toContain('El Libertador')
    expect(text).toContain('Ley 527 de 1999')
    expect(text).toContain('en nombre de su propietario Pedro Propietario')
    expect(text.length).toBeGreaterThan(200)
  })
  it('comercial: desahucio y deposito', () => {
    const text = contractTemplate({
      ...input,
      guarantors: [],
      lease: {
        ...input.lease,
        lease_use: 'COMERCIAL',
        increase_rule: 'IPC_PLUS',
        increase_points: 2,
        notice_months: 6,
        deposit: 5000000,
      },
    })
    expect(text).toMatch(/^CONTRATO DE ARRENDAMIENTO DE LOCAL COMERCIAL/)
    expect(text).toContain('articulo 520 del Codigo de Comercio')
    expect(text).toContain('mas 2 puntos')
    expect(text).toContain('deposito de $')
  })
})
