import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import DashboardV2 from './pages/DashboardV2'
import Dashboard from './pages/Dashboard'
import ChatPage from './pages/ChatPage'
import RecentMessages from './pages/RecentMessages'
import MyClasses from './pages/MyClasses'
import StudentProfile from './pages/StudentProfile'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/" element={<DashboardV2 />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/messages" element={<RecentMessages />} />
          <Route path="/classes" element={<MyClasses />} />
          <Route path="/student/:studentId" element={<StudentProfile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  )
}
