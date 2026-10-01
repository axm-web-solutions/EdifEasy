import type { TourConfig } from '@/hooks/useDriver'

/**
 * Definición de todos los tours guiados de la aplicación.
 * Cada tour se enfoca en una sección específica del sistema.
 */
export const TOURS: TourConfig[] = [
  {
    id: 'dashboard-admin',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Dashboard Administrativo',
          description:
            'Bienvenido al panel de control. Aquí encontrarás un resumen completo de la operación y finanzas del condominio.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="stat-card"]',
        popover: {
          title: 'Métricas clave',
          description:
            'Estas tarjetas muestran los indicadores principales: apartamentos, residentes, alertas, solicitudes, incidentes, multas y más. Haz clic en cada una para ir a su sección.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="chart-card"]',
        popover: {
          title: 'Gráficos y reportes',
          description:
            'Visualiza tendencias de gastos mensuales, distribución por categorías, solicitudes por estado, incidentes por tipo y multas por estado.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '[data-tour="activity-card"]',
        popover: {
          title: 'Actividad reciente',
          description:
            'Aquí verás las últimas acciones realizadas en el condominio: quién hizo qué y cuándo. También encontrarás las alertas activas más importantes.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'dashboard-resident',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Tu Dashboard',
          description:
            'Hola. Este es tu panel personal donde verás la información relevante para ti como residente.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="apartment-card"]',
        popover: {
          title: 'Mi apartamento',
          description:
            'Aquí verás los detalles de tu apartamento: bloque, piso, área, habitaciones y más. Haz clic en "Ver detalle" para ver la ficha completa.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="stat-card"]',
        popover: {
          title: 'Resumen personal',
          description:
            'Estas tarjetas muestran tus alertas, comunicados, solicitudes, mensajes sin leer, multas pendientes, documentos, vehículos y mascotas.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="alerts-card"]',
        popover: {
          title: 'Alertas y comunicados',
          description:
            'Aquí encontrarás las alertas activas del condominio y los comunicados recientes de la administración.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'dashboard-operational',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Dashboard Operativo',
          description:
            'Bienvenido al panel operativo. Aquí verás la información relevante para el personal de seguridad y servicios.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="stat-card"]',
        popover: {
          title: 'Métricas operativas',
          description:
            'Estas tarjetas muestran los indicadores clave para tu trabajo: visitantes, alertas, solicitudes, incidentes y más.',
          side: 'bottom',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'condominiums',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Condominios',
          description:
            'Aquí puedes ver todos los condominios a los que tienes acceso. Como superadministrador, puedes crear nuevos condominios.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="data-table"]',
        popover: {
          title: 'Lista de condominios',
          description:
            'Esta tabla muestra todos los condominios con su información básica. Puedes buscar, filtrar, ordenar y exportar los datos.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '[data-tour="create-button"]',
        popover: {
          title: 'Crear condominio',
          description:
            'Haz clic aquí para crear un nuevo condominio. Deberás ingresar el nombre, NIT, dirección, ciudad y otros datos.',
          side: 'left',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'buildings',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Bloques',
          description:
            'Aquí puedes gestionar los bloques o torres del condominio. Cada bloque contiene apartamentos.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="data-table"]',
        popover: {
          title: 'Lista de bloques',
          description:
            'Esta tabla muestra todos los bloques con su información. Puedes crear, editar o eliminar bloques según tus permisos.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'apartments',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Apartamentos',
          description:
            'Aquí puedes gestionar todos los apartamentos del condominio. Cada apartamento pertenece a un bloque y puede tener propietarios y arrendatarios.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="data-table"]',
        popover: {
          title: 'Lista de apartamentos',
          description:
            'Esta tabla muestra todos los apartamentos con su información. Haz clic en uno para ver su ficha completa (CRM).',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'users',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Usuarios',
          description:
            'Aquí puedes gestionar los usuarios del condominio: propietarios, arrendatarios, administradores, personal de seguridad y servicios.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="data-table"]',
        popover: {
          title: 'Lista de usuarios',
          description:
            'Esta tabla muestra todos los usuarios con su información. Puedes buscar, filtrar por rol y gestionar sus accesos.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'approvals',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Aprobaciones',
          description:
            'Aquí puedes revisar y aprobar las solicitudes de inscripción de nuevos miembros al condominio.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="data-table"]',
        popover: {
          title: 'Solicitudes pendientes',
          description:
            'Esta tabla muestra las solicitudes esperando revisión. Puedes aprobarlas o rechazarlas según corresponda.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'residents',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Residentes',
          description:
            'Aquí puedes ver el directorio completo de personas que habitan el condominio, con su información de contacto y relación con el apartamento.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="data-table"]',
        popover: {
          title: 'Directorio de residentes',
          description:
            'Esta tabla muestra todos los residentes. Puedes buscar por nombre, documento, correo o teléfono. También puedes filtrar por apartamento o relación.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '[data-tour="create-button"]',
        popover: {
          title: 'Nuevo residente',
          description:
            'Haz clic aquí para registrar un nuevo residente. Deberás ingresar sus datos personales y asignarlo a un apartamento.',
          side: 'left',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'visitors',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Visitantes',
          description:
            'Aquí puedes gestionar el control de ingreso de visitas, domicilios y proveedores por apartamento.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="data-table"]',
        popover: {
          title: 'Registro de visitantes',
          description:
            'Esta tabla muestra todos los visitantes registrados. Puedes ver su estado (esperando, dentro, salió) y registrar su entrada o salida.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '[data-tour="create-button"]',
        popover: {
          title: 'Registrar visitante',
          description:
            'Haz clic aquí para registrar un nuevo visitante. Deberás ingresar sus datos, el apartamento que visita y la fecha programada.',
          side: 'left',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'alerts',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Alertas',
          description:
            'Aquí puedes gestionar la comunicación urgente en tiempo real con los residentes del condominio.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="data-table"]',
        popover: {
          title: 'Lista de alertas',
          description:
            'Esta tabla muestra todas las alertas con su tipo, prioridad, destinatarios y vigencia. Puedes filtrar por estado, tipo o prioridad.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '[data-tour="create-button"]',
        popover: {
          title: 'Nueva alerta',
          description:
            'Haz clic aquí para crear una nueva alerta. Deberás ingresar el título, descripción, tipo, prioridad y destinatarios.',
          side: 'left',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'announcements',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Comunicados',
          description:
            'Aquí puedes publicar comunicados oficiales para todos los residentes o grupos específicos del condominio.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="data-table"]',
        popover: {
          title: 'Lista de comunicados',
          description:
            'Esta tabla muestra todos los comunicados publicados. Puedes ver su estado, destinatarios y fecha de publicación.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'messages',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Mensajes',
          description:
            'Aquí puedes comunicarte directamente con la administración u otros residentes a través de conversaciones privadas.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="conversations-list"]',
        popover: {
          title: 'Conversaciones',
          description:
            'Esta lista muestra todas tus conversaciones. Haz clic en una para ver los mensajes y responder.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="chat-area"]',
        popover: {
          title: 'Área de chat',
          description:
            'Aquí puedes ver los mensajes de la conversación seleccionada y escribir nuevos mensajes. Usa Enter para enviar.',
          side: 'left',
          align: 'start',
        },
      },
      {
        element: '[data-tour="new-conversation-button"]',
        popover: {
          title: 'Nueva conversación',
          description:
            'Haz clic aquí para iniciar una nueva conversación. Deberás seleccionar los destinatarios y escribir el primer mensaje.',
          side: 'left',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'requests',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Solicitudes',
          description:
            'Aquí puedes gestionar las solicitudes de los residentes: permisos, reservas, mantenimiento y más.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="data-table"]',
        popover: {
          title: 'Lista de solicitudes',
          description:
            'Esta tabla muestra todas las solicitudes con su estado, prioridad y fecha. Puedes filtrar por estado o tipo.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'incidents',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Incidentes',
          description:
            'Aquí puedes registrar y gestionar los incidentes reportados en el condominio: daños, problemas de seguridad, etc.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="data-table"]',
        popover: {
          title: 'Lista de incidentes',
          description:
            'Esta tabla muestra todos los incidentes con su tipo, estado, prioridad y fecha. Puedes filtrar por estado o tipo.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'fines',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Multas',
          description:
            'Aquí puedes gestionar las multas aplicadas a residentes por incumplimiento de normas del condominio.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="data-table"]',
        popover: {
          title: 'Lista de multas',
          description:
            'Esta tabla muestra todas las multas con su estado, monto y fecha. Puedes filtrar por estado o residente.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'expenses',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Gastos',
          description:
            'Aquí puedes gestionar los gastos del condominio: mantenimiento, servicios, nómina y más.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="data-table"]',
        popover: {
          title: 'Lista de gastos',
          description:
            'Esta tabla muestra todos los gastos con su categoría, monto, fecha y estado. Puedes filtrar por categoría o estado.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'purchases',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Compras',
          description:
            'Aquí puedes gestionar las compras realizadas por el condominio: proveedores, órdenes de compra y pagos.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="data-table"]',
        popover: {
          title: 'Lista de compras',
          description:
            'Esta tabla muestra todas las compras con su proveedor, monto, fecha y estado. Puedes filtrar por estado o proveedor.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'documents',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Documentos',
          description:
            'Aquí puedes gestionar los documentos del condominio: reglamentos, actas, contratos y más.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="data-table"]',
        popover: {
          title: 'Lista de documentos',
          description:
            'Esta tabla muestra todos los documentos con su tipo, tamaño y fecha. Puedes subir, descargar y eliminar documentos.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'reports',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Reportes',
          description:
            'Aquí puedes generar reportes detallados del condominio: financieros, operativos y de gestión.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="report-filters"]',
        popover: {
          title: 'Filtros de reporte',
          description:
            'Aquí puedes configurar los filtros para generar reportes personalizados: rango de fechas, tipo de reporte, formato de exportación.',
          side: 'bottom',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'activity',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Auditoría',
          description:
            'Aquí puedes ver el registro completo de todas las acciones realizadas en el condominio: quién hizo qué y cuándo.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="data-table"]',
        popover: {
          title: 'Registro de actividad',
          description:
            'Esta tabla muestra todas las acciones realizadas en el sistema. Puedes filtrar por usuario, acción, entidad o fecha.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'settings',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Configuración',
          description:
            'Aquí puedes gestionar tu perfil, ver tus roles y condominios, y editar los datos del condominio si tienes permisos.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="profile-tab"]',
        popover: {
          title: 'Mi perfil',
          description:
            'En esta pestaña puedes actualizar tu información personal: nombre, documento, teléfono y foto de perfil.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="memberships-tab"]',
        popover: {
          title: 'Mis roles',
          description:
            'En esta pestaña puedes ver todos los condominios a los que perteneces y tu rol en cada uno.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="condominium-tab"]',
        popover: {
          title: 'Datos del condominio',
          description:
            'En esta pestaña puedes ver y editar los datos del condominio activo si tienes permisos de administración.',
          side: 'bottom',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 'my-apartment',
    once: true,
    steps: [
      {
        element: '[data-tour="page-header"]',
        popover: {
          title: 'Mi apartamento',
          description:
            'Aquí puedes ver la ficha completa de tu apartamento, incluyendo vehículos, mascotas y residentes asociados.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="apartment-card"]',
        popover: {
          title: 'Detalles del apartamento',
          description:
            'Aquí verás toda la información de tu apartamento: bloque, piso, área, habitaciones, baños y estado.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="vehicles-pets"]',
        popover: {
          title: 'Vehículos y mascotas',
          description:
            'Aquí puedes gestionar los vehículos y mascotas asociados a tu apartamento. Puedes agregar, editar o eliminar registros.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
]

/**
 * Obtiene un tour por su ID
 */
export function getTourById(id: string): TourConfig | undefined {
  return TOURS.find((tour) => tour.id === id)
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON']
const OPERATIONAL_ROLES = ['SECURITY', 'SERVICE_STAFF']

/**
 * Devuelve el ID del tour correspondiente a la ruta actual, considerando el
 * rol activo en el dashboard (cada rol tiene su propia variante).
 */
export function getTourIdForRoute(pathname: string, role?: string | null): string | undefined {
  if (pathname === '/dashboard') {
    if (role && ADMIN_ROLES.includes(role)) return 'dashboard-admin'
    if (role && OPERATIONAL_ROLES.includes(role)) return 'dashboard-operational'
    return 'dashboard-resident'
  }

  const routeMap: Record<string, string> = {
    '/condominiums': 'condominiums',
    '/buildings': 'buildings',
    '/apartments': 'apartments',
    '/users': 'users',
    '/approvals': 'approvals',
    '/residents': 'residents',
    '/visitors': 'visitors',
    '/alerts': 'alerts',
    '/announcements': 'announcements',
    '/messages': 'messages',
    '/requests': 'requests',
    '/incidents': 'incidents',
    '/fines': 'fines',
    '/expenses': 'expenses',
    '/purchases': 'purchases',
    '/documents': 'documents',
    '/reports': 'reports',
    '/activity': 'activity',
    '/settings': 'settings',
    '/my-apartment': 'my-apartment',
  }

  return routeMap[pathname]
}

/**
 * Obtiene el tour correspondiente a una ruta y rol dados.
 */
export function getTourForRoute(pathname: string, role?: string | null): TourConfig | undefined {
  const tourId = getTourIdForRoute(pathname, role)
  return tourId ? getTourById(tourId) : undefined
}
