import type { ListParams } from '@/types/models'

/** Claves de cache centralizadas para TanStack Query. */
export const queryKeys = {
  userContext: (userId: string | null) => ['user-context', userId] as const,

  condominiums: {
    all: ['condominiums'] as const,
    list: (params: ListParams) => ['condominiums', 'list', params] as const,
    detail: (id: string) => ['condominiums', 'detail', id] as const,
    adminStats: (id: string) => ['condominiums', 'admin-stats', id] as const,
    residentStats: (id: string) => ['condominiums', 'resident-stats', id] as const,
  },

  buildings: {
    all: (condominiumId: string) => ['buildings', condominiumId] as const,
    list: (condominiumId: string, params: ListParams) =>
      ['buildings', condominiumId, 'list', params] as const,
    withCounts: (condominiumId: string) => ['buildings', condominiumId, 'with-counts'] as const,
    detail: (id: string) => ['buildings', 'detail', id] as const,
  },

  apartments: {
    all: (condominiumId: string) => ['apartments', condominiumId] as const,
    list: (condominiumId: string, params: ListParams) =>
      ['apartments', condominiumId, 'list', params] as const,
    byBuilding: (buildingId: string) => ['apartments', 'by-building', buildingId] as const,
    detail: (id: string) => ['apartments', 'detail', id] as const,
    owners: (id: string) => ['apartments', id, 'owners'] as const,
    tenants: (id: string) => ['apartments', id, 'tenants'] as const,
    timeline: (id: string) => ['apartments', id, 'timeline'] as const,
  },

  residents: {
    list: (condominiumId: string, params: ListParams) =>
      ['residents', condominiumId, 'list', params] as const,
    byApartment: (apartmentId: string) => ['residents', 'by-apartment', apartmentId] as const,
  },

  vehicles: {
    list: (condominiumId: string, params: ListParams) =>
      ['vehicles', condominiumId, 'list', params] as const,
    byApartment: (apartmentId: string) => ['vehicles', 'by-apartment', apartmentId] as const,
  },

  pets: {
    list: (condominiumId: string, params: ListParams) =>
      ['pets', condominiumId, 'list', params] as const,
    byApartment: (apartmentId: string) => ['pets', 'by-apartment', apartmentId] as const,
  },

  members: {
    list: (condominiumId: string, params: ListParams) =>
      ['members', condominiumId, 'list', params] as const,
    all: (condominiumId: string) => ['members', condominiumId, 'all'] as const,
    roles: ['roles'] as const,
  },

  alerts: {
    list: (condominiumId: string, params: ListParams) =>
      ['alerts', condominiumId, 'list', params] as const,
    active: (condominiumId: string) => ['alerts', condominiumId, 'active'] as const,
    detail: (id: string) => ['alerts', 'detail', id] as const,
  },

  announcements: {
    list: (condominiumId: string, params: ListParams) =>
      ['announcements', condominiumId, 'list', params] as const,
    published: (condominiumId: string) => ['announcements', condominiumId, 'published'] as const,
    detail: (id: string) => ['announcements', 'detail', id] as const,
  },

  notifications: {
    list: (userId: string, condominiumId: string | null) =>
      ['notifications', userId, condominiumId] as const,
    unread: (userId: string, condominiumId: string | null) =>
      ['notifications', 'unread', userId, condominiumId] as const,
  },

  conversations: {
    list: (condominiumId: string) => ['conversations', condominiumId] as const,
    detail: (id: string) => ['conversations', 'detail', id] as const,
    messages: (conversationId: string) => ['messages', conversationId] as const,
  },

  requests: {
    list: (condominiumId: string, params: ListParams) =>
      ['requests', condominiumId, 'list', params] as const,
    recent: (condominiumId: string) => ['requests', condominiumId, 'recent'] as const,
    detail: (id: string) => ['requests', 'detail', id] as const,
    comments: (id: string) => ['requests', id, 'comments'] as const,
  },

  incidents: {
    list: (condominiumId: string, params: ListParams) =>
      ['incidents', condominiumId, 'list', params] as const,
    recent: (condominiumId: string) => ['incidents', condominiumId, 'recent'] as const,
    detail: (id: string) => ['incidents', 'detail', id] as const,
  },

  expenses: {
    list: (condominiumId: string, params: ListParams) =>
      ['expenses', condominiumId, 'list', params] as const,
    categories: (condominiumId: string) => ['expense-categories', condominiumId] as const,
    monthly: (condominiumId: string, months: number) =>
      ['expenses', condominiumId, 'monthly', months] as const,
    byCategory: (condominiumId: string) => ['expenses', condominiumId, 'by-category'] as const,
  },

  purchases: {
    list: (condominiumId: string, params: ListParams) =>
      ['purchases', condominiumId, 'list', params] as const,
    detail: (id: string) => ['purchases', 'detail', id] as const,
  },

  fines: {
    list: (condominiumId: string, params: ListParams) =>
      ['fines', condominiumId, 'list', params] as const,
    byApartment: (apartmentId: string) => ['fines', 'by-apartment', apartmentId] as const,
    detail: (id: string) => ['fines', 'detail', id] as const,
  },

  documents: {
    list: (condominiumId: string, params: ListParams) =>
      ['documents', condominiumId, 'list', params] as const,
    categories: (condominiumId: string) => ['document-categories', condominiumId] as const,
  },

  reports: {
    requestsByStatus: (condominiumId: string) => ['reports', condominiumId, 'requests-status'] as const,
    requestsByType: (condominiumId: string) => ['reports', condominiumId, 'requests-type'] as const,
    incidentsByType: (condominiumId: string) => ['reports', condominiumId, 'incidents-type'] as const,
    incidentsByStatus: (condominiumId: string) =>
      ['reports', condominiumId, 'incidents-status'] as const,
    finesByStatus: (condominiumId: string) => ['reports', condominiumId, 'fines-status'] as const,
    finesAmount: (condominiumId: string) => ['reports', condominiumId, 'fines-amount'] as const,
    alertsByType: (condominiumId: string) => ['reports', condominiumId, 'alerts-type'] as const,
    activity: (condominiumId: string) => ['reports', condominiumId, 'activity'] as const,
    audit: (condominiumId: string, params: ListParams) =>
      ['reports', condominiumId, 'audit', params] as const,
  },

  search: (condominiumId: string, term: string) => ['global-search', condominiumId, term] as const,
} as const
