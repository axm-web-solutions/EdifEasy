import { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Spin } from 'antd'
import { AuthLayout } from '@/layouts/AuthLayout'
import { AppLayout } from '@/layouts/AppLayout'
import { ProtectedRoute, PublicOnlyRoute, RoleGuard } from '@/components/routing/guards'
import { lazyPage } from './lazyPage'

// --- Auth (carga inmediata: es la primera pantalla) -------------------------
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage'
import { NoCondominiumPage, NotFoundPage } from '@/features/misc/pages/MiscPages'

// --- Modulos (code splitting) ----------------------------------------------
const DashboardPage = lazyPage(() =>
  import('@/features/dashboard/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const CondominiumsPage = lazyPage(() =>
  import('@/features/condominiums/pages/CondominiumsPage').then((m) => ({
    default: m.CondominiumsPage,
  })),
)
const BuildingsPage = lazyPage(() =>
  import('@/features/buildings/pages/BuildingsPage').then((m) => ({ default: m.BuildingsPage })),
)
const ApartmentsPage = lazyPage(() =>
  import('@/features/apartments/pages/ApartmentsPage').then((m) => ({ default: m.ApartmentsPage })),
)
const ApartmentDetailPage = lazyPage(() =>
  import('@/features/apartments/pages/ApartmentDetailPage').then((m) => ({
    default: m.ApartmentDetailPage,
  })),
)
const MyApartmentPage = lazyPage(() =>
  import('@/features/apartments/pages/MyApartmentPage').then((m) => ({
    default: m.MyApartmentPage,
  })),
)
const UsersPage = lazyPage(() =>
  import('@/features/users/pages/UsersPage').then((m) => ({ default: m.UsersPage })),
)
const ApprovalsPage = lazyPage(() =>
  import('@/features/approvals/pages/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })),
)
const ResidentsPage = lazyPage(() =>
  import('@/features/residents/pages/ResidentsPage').then((m) => ({ default: m.ResidentsPage })),
)
const VisitorsPage = lazyPage(() =>
  import('@/features/visitors/pages/VisitorsPage').then((m) => ({ default: m.VisitorsPage })),
)
const AlertsPage = lazyPage(() =>
  import('@/features/alerts/pages/AlertsPage').then((m) => ({ default: m.AlertsPage })),
)
const AnnouncementsPage = lazyPage(() =>
  import('@/features/announcements/pages/AnnouncementsPage').then((m) => ({
    default: m.AnnouncementsPage,
  })),
)
const MessagesPage = lazyPage(() =>
  import('@/features/messages/pages/MessagesPage').then((m) => ({ default: m.MessagesPage })),
)
const RequestsPage = lazyPage(() =>
  import('@/features/requests/pages/RequestsPage').then((m) => ({ default: m.RequestsPage })),
)
const IncidentsPage = lazyPage(() =>
  import('@/features/incidents/pages/IncidentsPage').then((m) => ({ default: m.IncidentsPage })),
)
const ExpensesPage = lazyPage(() =>
  import('@/features/expenses/pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })),
)
const PurchasesPage = lazyPage(() =>
  import('@/features/purchases/pages/PurchasesPage').then((m) => ({ default: m.PurchasesPage })),
)
const FinesPage = lazyPage(() =>
  import('@/features/fines/pages/FinesPage').then((m) => ({ default: m.FinesPage })),
)
const PlatformPage = lazyPage(() =>
  import('@/features/platform/pages/PlatformPage').then((m) => ({ default: m.PlatformPage })),
)
const RoleModulesPage = lazyPage(() =>
  import('@/features/platform/pages/RoleModulesPage').then((m) => ({ default: m.RoleModulesPage })),
)
const CreateFromRutPage = lazyPage(() =>
  import('@/features/platform/pages/CreateFromRutPage').then((m) => ({
    default: m.CreateFromRutPage,
  })),
)
const CompliancePage = lazyPage(() =>
  import('@/features/legal/pages/CompliancePage').then((m) => ({ default: m.CompliancePage })),
)
const LegalPage = lazyPage(() =>
  import('@/features/legal/pages/LegalPage').then((m) => ({ default: m.LegalPage })),
)
const FeedPage = lazyPage(() =>
  import('@/features/feed/pages/FeedPage').then((m) => ({ default: m.FeedPage })),
)
const MarketplacePage = lazyPage(() =>
  import('@/features/marketplace/pages/MarketplacePage').then((m) => ({
    default: m.MarketplacePage,
  })),
)
const NearbyPage = lazyPage(() =>
  import('@/features/nearby/pages/NearbyPage').then((m) => ({ default: m.NearbyPage })),
)
const LogbookPage = lazyPage(() =>
  import('@/features/logbook/pages/LogbookPage').then((m) => ({ default: m.LogbookPage })),
)
const StaffPage = lazyPage(() =>
  import('@/features/staff/pages/StaffPage').then((m) => ({ default: m.StaffPage })),
)
const SurveysPage = lazyPage(() =>
  import('@/features/surveys/pages/SurveysPage').then((m) => ({ default: m.SurveysPage })),
)
const AdminFeesPage = lazyPage(() =>
  import('@/features/payments/pages/AdminFeesPage').then((m) => ({ default: m.AdminFeesPage })),
)
const PlansPage = lazyPage(() =>
  import('@/features/payments/pages/PlansPage').then((m) => ({ default: m.PlansPage })),
)
const PaymentResultPage = lazyPage(() =>
  import('@/features/payments/pages/PaymentResultPage').then((m) => ({
    default: m.PaymentResultPage,
  })),
)
const DocumentsPage = lazyPage(() =>
  import('@/features/documents/pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })),
)
const ReportsPage = lazyPage(() =>
  import('@/features/reports/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
const ActivityPage = lazyPage(() =>
  import('@/features/activity/pages/ActivityPage').then((m) => ({ default: m.ActivityPage })),
)
const SettingsPage = lazyPage(() =>
  import('@/features/settings/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spin size="large" />
    </div>
  )
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Publicas */}
        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>
        </Route>

        {/* Reset password funciona con la sesion temporal del enlace de correo */}
        <Route element={<AuthLayout />}>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        <Route path="/sin-condominio" element={<NoCondominiumPage />} />

        {/* Documentos legales: publicos, con o sin sesion. */}
        <Route path="/legal" element={<Navigate to="/legal/terminos" replace />} />
        <Route path="/legal/:doc" element={<LegalPage />} />

        {/* Privadas */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route
              path="/condominiums"
              element={
                <RoleGuard roles={['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON']}>
                  <CondominiumsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/buildings"
              element={
                <RoleGuard roles={['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON']}>
                  <BuildingsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/apartments"
              element={
                <RoleGuard roles={['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY']}>
                  <ApartmentsPage />
                </RoleGuard>
              }
            />
            <Route path="/apartments/:id" element={<ApartmentDetailPage />} />
            <Route
              path="/my-apartment"
              element={
                <RoleGuard roles={['OWNER', 'TENANT', 'SUPER_ADMIN', 'ADMINISTRATOR']}>
                  <MyApartmentPage />
                </RoleGuard>
              }
            />
            <Route
              path="/users"
              element={
                <RoleGuard permission="manageMembers">
                  <UsersPage />
                </RoleGuard>
              }
            />
            <Route
              path="/approvals"
              element={
                <RoleGuard permission="manageMembers">
                  <ApprovalsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/residents"
              element={
                <RoleGuard permission="viewResidents" module="residents">
                  <ResidentsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/visitors"
              element={
                <RoleGuard permission="viewVisitors" module="visitors">
                  <VisitorsPage />
                </RoleGuard>
              }
            />

            <Route
              path="/alerts"
              element={
                <RoleGuard module="alerts">
                  <AlertsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/announcements"
              element={
                <RoleGuard module="announcements">
                  <AnnouncementsPage />
                </RoleGuard>
              }
            />
            {/* Feed: home de residentes (/dashboard) y pagina propia para el resto. */}
            <Route path="/feed" element={<FeedPage />} />
            <Route
              path="/marketplace"
              element={
                <RoleGuard module="marketplace">
                  <MarketplacePage />
                </RoleGuard>
              }
            />
            <Route
              path="/messages"
              element={
                <RoleGuard module="messages">
                  <MessagesPage />
                </RoleGuard>
              }
            />
            <Route path="/nearby" element={<NearbyPage />} />
            <Route
              path="/surveys"
              element={
                <RoleGuard module="surveys">
                  <SurveysPage />
                </RoleGuard>
              }
            />
            <Route
              path="/logbook"
              element={
                <RoleGuard
                  roles={['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY']}
                  module="logbook"
                >
                  <LogbookPage />
                </RoleGuard>
              }
            />
            <Route
              path="/staff"
              element={
                <RoleGuard
                  roles={['SUPER_ADMIN', 'ADMINISTRATOR', 'SPOKESPERSON', 'SECURITY', 'SERVICE_STAFF']}
                  module="staff"
                >
                  <StaffPage />
                </RoleGuard>
              }
            />
            <Route
              path="/requests"
              element={
                <RoleGuard module="requests">
                  <RequestsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/incidents"
              element={
                <RoleGuard module="incidents">
                  <IncidentsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/fines"
              element={
                <RoleGuard module="fines">
                  <FinesPage />
                </RoleGuard>
              }
            />

            <Route
              path="/expenses"
              element={
                <RoleGuard permission="viewFinance" module="expenses">
                  <ExpensesPage />
                </RoleGuard>
              }
            />
            <Route
              path="/purchases"
              element={
                <RoleGuard permission="viewFinance" module="purchases">
                  <PurchasesPage />
                </RoleGuard>
              }
            />

            <Route
              path="/platform"
              element={
                <RoleGuard roles={['SUPER_ADMIN']}>
                  <PlatformPage />
                </RoleGuard>
              }
            />
            <Route
              path="/platform/new"
              element={
                <RoleGuard roles={['SUPER_ADMIN']}>
                  <CreateFromRutPage />
                </RoleGuard>
              }
            />
            <Route
              path="/platform/legal"
              element={
                <RoleGuard roles={['SUPER_ADMIN']}>
                  <CompliancePage />
                </RoleGuard>
              }
            />
            <Route
              path="/platform/modules"
              element={
                <RoleGuard roles={['SUPER_ADMIN']}>
                  <RoleModulesPage />
                </RoleGuard>
              }
            />
            <Route
              path="/admin-fees"
              element={
                <RoleGuard roles={['ADMINISTRATOR', 'OWNER']} module="admin_fees">
                  <AdminFeesPage />
                </RoleGuard>
              }
            />
            <Route
              path="/plans"
              element={
                <RoleGuard roles={['ADMINISTRATOR']}>
                  <PlansPage />
                </RoleGuard>
              }
            />
            {/* Retorno desde Wompi: lo usan propietarios y administradores. */}
            <Route path="/payments/result" element={<PaymentResultPage />} />

            <Route
              path="/documents"
              element={
                <RoleGuard module="documents">
                  <DocumentsPage />
                </RoleGuard>
              }
            />

            <Route
              path="/reports"
              element={
                <RoleGuard permission="viewReports" module="reports">
                  <ReportsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/activity"
              element={
                <RoleGuard permission="viewAudit">
                  <ActivityPage />
                </RoleGuard>
              }
            />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
