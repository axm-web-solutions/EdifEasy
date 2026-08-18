import { describe, expect, it } from 'vitest'
import { PERMISSIONS, ROLES, ROLE_OPTIONS, roleLabel } from './roles'
import type { RoleCode } from '@/types/database'

function can(role: RoleCode, permission: keyof typeof PERMISSIONS): boolean {
  return (PERMISSIONS[permission] as RoleCode[]).includes(role)
}

describe('catalogo de roles', () => {
  it('define los siete roles del sistema', () => {
    expect(Object.keys(ROLES)).toEqual([
      'SUPER_ADMIN',
      'ADMINISTRATOR',
      'SPOKESPERSON',
      'OWNER',
      'TENANT',
      'SECURITY',
      'SERVICE_STAFF',
    ])
  })

  it('no ofrece SUPER_ADMIN al vincular usuarios a un condominio', () => {
    expect(ROLE_OPTIONS.some((option) => option.value === 'SUPER_ADMIN')).toBe(false)
    expect(ROLE_OPTIONS).toHaveLength(6)
  })

  it('devuelve etiquetas legibles', () => {
    expect(roleLabel('ADMINISTRATOR')).toBe('Administrador')
    expect(roleLabel(null)).toBe('Sin rol')
  })
})

describe('matriz de permisos', () => {
  it('solo SUPER_ADMIN y ADMINISTRATOR administran la estructura', () => {
    expect(can('SUPER_ADMIN', 'manageStructure')).toBe(true)
    expect(can('ADMINISTRATOR', 'manageStructure')).toBe(true)
    expect(can('SPOKESPERSON', 'manageStructure')).toBe(false)
    expect(can('OWNER', 'manageStructure')).toBe(false)
    expect(can('TENANT', 'manageStructure')).toBe(false)
    expect(can('SECURITY', 'manageStructure')).toBe(false)
  })

  it('el arrendatario nunca accede a informacion financiera', () => {
    expect(can('TENANT', 'viewFinance')).toBe(false)
    expect(can('TENANT', 'manageFinance')).toBe(false)
    expect(can('OWNER', 'viewFinance')).toBe(true)
    expect(can('OWNER', 'manageFinance')).toBe(false)
  })

  it('celaduria no accede a finanzas pero si gestiona incidentes y residentes', () => {
    expect(can('SECURITY', 'viewFinance')).toBe(false)
    expect(can('SECURITY', 'manageIncidents')).toBe(true)
    expect(can('SECURITY', 'viewResidents')).toBe(true)
  })

  it('el vocero puede publicar alertas y comunicados pero no gestionar multas', () => {
    expect(can('SPOKESPERSON', 'manageAlerts')).toBe(true)
    expect(can('SPOKESPERSON', 'manageAnnouncements')).toBe(true)
    expect(can('SPOKESPERSON', 'manageFines')).toBe(false)
  })

  it('el personal de servicios solo gestiona solicitudes', () => {
    expect(can('SERVICE_STAFF', 'manageRequests')).toBe(true)
    expect(can('SERVICE_STAFF', 'manageMembers')).toBe(false)
    expect(can('SERVICE_STAFF', 'viewFinance')).toBe(false)
  })
})
