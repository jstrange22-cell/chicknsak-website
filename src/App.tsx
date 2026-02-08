import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ProtectedRoute, PublicRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { Loader2 } from 'lucide-react';

// Lightweight loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );
}

// Lazy-loaded Pages (only loaded when navigated to)
const Index = lazy(() => import('@/pages/Index'));
const Projects = lazy(() => import('@/pages/Projects'));
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'));
const Camera = lazy(() => import('@/pages/Camera'));
const MyStuff = lazy(() => import('@/pages/MyStuff'));
const Messages = lazy(() => import('@/pages/Messages'));
const Timeclock = lazy(() => import('@/pages/Timeclock'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const Search = lazy(() => import('@/pages/Search'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Settings = lazy(() => import('@/pages/Settings'));
const UsersPage = lazy(() => import('@/pages/UsersPage'));
const UserGroupsPage = lazy(() => import('@/pages/UserGroupsPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const ChecklistsPage = lazy(() => import('@/pages/ChecklistsPage'));
const PaymentsPage = lazy(() => import('@/pages/PaymentsPage'));
const MapPage = lazy(() => import('@/pages/MapPage'));
const ReviewsPage = lazy(() => import('@/pages/ReviewsPage'));
const PortfolioPage = lazy(() => import('@/pages/PortfolioPage'));
const IntegrationsPage = lazy(() => import('@/pages/IntegrationsPage'));
const TemplatesPage = lazy(() => import('@/pages/TemplatesPage'));
const VoiceNotesPage = lazy(() => import('@/pages/VoiceNotesPage'));
const AIChatPage = lazy(() => import('@/pages/AIChatPage'));

// Admin Pages
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminTimeclock = lazy(() => import('@/pages/admin/AdminTimeclock'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminProjects = lazy(() => import('@/pages/admin/AdminProjects'));
const AdminInvoicing = lazy(() => import('@/pages/admin/AdminInvoicing'));
const AdminReports = lazy(() => import('@/pages/admin/AdminReports'));
const AdminScheduling = lazy(() => import('@/pages/admin/AdminScheduling'));
const AdminVendors = lazy(() => import('@/pages/admin/AdminVendors'));

// Auth Pages
const Login = lazy(() => import('@/pages/auth/Login'));
const Signup = lazy(() => import('@/pages/auth/Signup'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));

// Public Share Pages
const ShareReport = lazy(() => import('@/pages/ShareReport'));
const ShareGallery = lazy(() => import('@/pages/ShareGallery'));
const ShareTimeline = lazy(() => import('@/pages/ShareTimeline'));
const GuestProjectView = lazy(() => import('@/pages/GuestProjectView'));
const SignDocument = lazy(() => import('@/pages/SignDocument'));
const CustomerPayment = lazy(() => import('@/pages/CustomerPayment'));
const PublicShowcase = lazy(() => import('@/pages/PublicShowcase'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30,   // Keep cached data for 30 minutes
      retry: 2,                  // Retry twice on failure (helps on mobile)
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnReconnect: true,  // Refresh when network comes back
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Auth Routes (Public) */}
              <Route path="/auth/login" element={
                <PublicRoute><Login /></PublicRoute>
              } />
              <Route path="/auth/signup" element={
                <PublicRoute><Signup /></PublicRoute>
              } />
              <Route path="/auth/forgot-password" element={
                <PublicRoute><ForgotPassword /></PublicRoute>
              } />

              {/* Public Share Routes (no auth required) */}
              <Route path="/share/report/:token" element={<ShareReport />} />
              <Route path="/share/gallery/:token" element={<ShareGallery />} />
              <Route path="/share/timeline/:token" element={<ShareTimeline />} />
              <Route path="/project-guest/:token" element={<GuestProjectView />} />
              <Route path="/sign/:token" element={<SignDocument />} />
              <Route path="/pay/:token" element={<CustomerPayment />} />
              <Route path="/showcase/:slug" element={<PublicShowcase />} />

              {/* Protected Routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Index />} />
                <Route path="projects" element={<Projects />} />
                <Route path="projects/:id" element={<ProjectDetail />} />
                <Route path="camera" element={<Camera />} />
                <Route path="my-stuff" element={<MyStuff />} />
                <Route path="messages" element={<Messages />} />
                <Route path="timeclock" element={<Timeclock />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="search" element={<Search />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="settings" element={<Settings />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="user-groups" element={<UserGroupsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="checklists" element={<ChecklistsPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="map" element={<MapPage />} />
                <Route path="reviews" element={<ReviewsPage />} />
                <Route path="portfolio" element={<PortfolioPage />} />
                <Route path="integrations" element={<IntegrationsPage />} />
                <Route path="templates" element={<TemplatesPage />} />
                <Route path="voice-notes" element={<VoiceNotesPage />} />
                <Route path="ai-chat" element={<AIChatPage />} />
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<AdminTimeclock />} />
                  <Route path="timeclock" element={<AdminTimeclock />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="projects" element={<AdminProjects />} />
                  <Route path="invoicing" element={<AdminInvoicing />} />
                  <Route path="reports" element={<AdminReports />} />
                  <Route path="scheduling" element={<AdminScheduling />} />
                  <Route path="vendors" element={<AdminVendors />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
