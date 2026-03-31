import { Routes, Route, Navigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Layout from "./components/common/Layout";
import Profile from "./pages/dashboard/Profile";
import Settings from "./pages/dashboard/Settings";

import Dashboard from "./pages/dashboard/Dashboard";
import DomainPage from "./pages/domain/DomainPage";
import DatasetPage from "./pages/dataset/DatasetPage";
import Chatbot from "./pages/chatbot/Chatbot";
import DatasetDetail from "./pages/dataset/DatasetDetailLive";

import ProtectedRoute from "./components/auth/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      {/* Public routes mapped alongside Main Layout structures */}
      <Route element={<Layout />}>
        <Route path="/search" element={<DatasetPage />} />
        <Route path="/datasets" element={<DatasetPage />} />
        <Route path="/datasets/:domain" element={<DatasetPage />} />
        <Route path="/dataset/:id" element={<DatasetDetail />} />
        <Route path="/domain/:sector" element={<DomainPage />} />
        <Route path="/domain/:sector/:filename" element={<DatasetDetail />} />
      </Route>

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="chatbot" element={<Chatbot />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
