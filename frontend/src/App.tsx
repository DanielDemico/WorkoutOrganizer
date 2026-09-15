import { Navigate, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from './i18n';
import { AuthProvider } from './context/AuthContext';
import { SidebarProvider } from './context/SidebarContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Sidebar } from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import WorkoutsListPage from './pages/WorkoutsListPage';
import CreateWorkoutPage from './pages/CreateWorkoutPage';
import WorkoutViewPage from './pages/WorkoutViewPage';
import CalendarPage from './pages/CalendarPage';
import MuscleUsePage from './pages/MuscleUsePage';

export default function App() {
  // Outermost: the language also applies to the login screen, before there is a user.
  return (
    <LanguageProvider>
      <AuthProvider>
        <SidebarProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Navigate to="/treino" replace />} />
              <Route path="/treino" element={<WorkoutsListPage />} />
              <Route path="/treino/novo" element={<CreateWorkoutPage />} />
              <Route path="/treino/:id" element={<WorkoutViewPage />} />
              <Route path="/calendario" element={<CalendarPage />} />
              <Route path="/muscle-use" element={<MuscleUsePage />} />
              <Route path="*" element={<Navigate to="/treino" replace />} />
            </Route>
          </Routes>
          <Sidebar />
        </SidebarProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
