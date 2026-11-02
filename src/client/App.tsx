import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth-context';
import { LandingPage } from './pages/LandingPage';
import { LoginPage, SignUpPage, ForgotPasswordPage } from './pages/auth/AuthPages';
import { FeedPage } from './pages/FeedPage';
import { MessagesPage } from './pages/MessagesPage';
import { NetworkPage } from './pages/NetworkPage';
import { SearchPage } from './pages/SearchPage';
import { MyProfilePage, PublicProfilePage } from './pages/ProfilePage';
import { CompaniesManagementPage, PublicCompanyPage } from './pages/CompaniesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FB] text-xs text-[#64748B]">
        Loading Mobilikey...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FB] text-xs text-[#64748B]">
        Loading Mobilikey...
      </div>
    );
  }
  return user ? <Navigate to="/feed" replace /> : <LandingPage />;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public & Hybrid Routes */}
          <Route path="/" element={<HomeRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/announcements" element={<FeedPage publicOnly />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/p/:slug" element={<PublicProfilePage />} />
          <Route path="/c/:slug" element={<PublicCompanyPage />} />

          {/* Authenticated Routes */}
          <Route
            path="/feed"
            element={
              <ProtectedRoute>
                <FeedPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <MessagesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/network"
            element={
              <ProtectedRoute>
                <NetworkPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <MyProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/companies"
            element={
              <ProtectedRoute>
                <CompaniesManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

