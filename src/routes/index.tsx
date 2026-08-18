import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Spin } from 'antd'
import { AuthLayout } from '@/layouts/AuthLayout'
import { AppLayout } from '@/layouts/AppLayout'
import { ProtectedRoute, PublicOnlyRoute, RoleGuard } from '@/components/routing/guards'

// --- Auth (carga inmediata: es la primera pantalla) -------------------------
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage'
import { NoCondominiumPage, NotFoundPage } from '@/features/misc/pages/MiscPages'

// --- Modulos (code splitting) ----------------------------------------------
const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const CondominiumsPage = lazy(() =>
  import('@/features/condominiums/pages/CondominiumsPage').then((m) => ({
    default: m.CondominiumsPage,
  })),
)
const BuildingsPage = lazy(() =>
  import('@/features/buildings/pages/BuildingsPage').then((m) => ({ default: m.BuildingsPage })),
)
const ApartmentsPage = lazy(() =>
  import('@/features/apartments/pages/ApartmentsPage').then((m) => ({ default: m.ApartmentsPage })),
)
const ApartmentDetailPage = lazy(() =>
  import('@/features/apartments/pages/ApartmentDetailPage').then((m) => ({
    default: m.ApartmentDetailPage,
  })),
)
const MyApartmentPage = lazy(() =>
  import('@/features/apartments/pages/MyApartmentPage').then((m) => ({ default: m.MyApartmentPage })),
)
const UsersPage = lazy(() =>
  import('@/features/users/pages/UsersPage').then((m) => ({ default: m.UsersPage })),
)
const ApprovalsPage = lazy(() =>
  import('@/features/approvals/pages/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })),
)
const ResidentsPage = lazy(() =>
  import('@/features/residents/pages/ResidentsPage').then((m) => ({ default: m.ResidentsPage })),
)
const AlertsPage = lazy(() =>
  import('@/features/alerts/pages/AlertsPage').then((m) => ({ default: m.AlertsPage })),
)
const AnnouncementsPage = lazy(() =>
  import('@/features/announcements/pages/AnnouncementsPage').then((m) => ({
    default: m.AnnouncementsPage,
  })),
)
const MessagesPage = lazy(() =>
  import('@/features/messages/pages/MessagesPage').then((m) => ({ default: m.MessagesPage })),
)
const RequestsPage = lazy(() =>
  import('@/features/requests/pages/RequestsPage').then((m) => ({ default: m.RequestsPage })),
)
const IncidentsPage = lazy(() =>
  import('@/features/incidents/pages/IncidentsPage').then((m) => ({ default: m.IncidentsPage })),
)
const ExpensesPage = lazy(() =>
  import('@/features/expenses/pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })),
)
const PurchasesPage = lazy(() =>
  import('@/features/purchases/pages/PurchasesPage').then((m) => ({ default: m.PurchasesPage })),
)
const FinesPage = lazy(() =>
  import('@/features/fines/pages/FinesPage').then((m) => ({ default: m.FinesPage })),
)
const DocumentsPage = lazy(() =>
  import('@/features/documents/pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })),
)
const ReportsPage = lazy(() =>
  import('@/features/reports/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
const ActivityPage = lazy(() =>
  import('@/features/activity/pages/ActivityPage').then((m) => ({ default: m.ActivityPage })),
)
const SettingsPage = lazy(() =>
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
                <RoleGuard permission="viewResidents">
                  <ResidentsPage />
                </RoleGuard>
              }
            />

            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/fines" element={<FinesPage />} />

            <Route
              path="/expenses"
              element={
                <RoleGuard permission="viewFinance">
                  <ExpensesPage />
                </RoleGuard>
              }
            />
            <Route
              path="/purchases"
              element={
                <RoleGuard permission="viewFinance">
                  <PurchasesPage />
                </RoleGuard>
              }
            />

            <Route path="/documents" element={<DocumentsPage />} />

            <Route
              path="/reports"
              element={
                <RoleGuard permission="viewReports">
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
