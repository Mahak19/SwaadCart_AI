import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/auth.js';
import AppLayout from './components/AppLayout.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Meals from './pages/Meals.jsx';
import Grocery from './pages/Grocery.jsx';
import Inventory from './pages/Inventory.jsx';
import Cook from './pages/Cook.jsx';
import SearchPage from './pages/SearchPage.jsx';
import Discover from './pages/Discover.jsx';
import Taste from './pages/Taste.jsx';
import NotFound from './pages/NotFound.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className='min-h-screen grid place-items-center bg-[#F5F6F8]'>
      <div className='text-center'>
        <div className='w-8 h-8 border-2 border-[#1FAE7A] border-t-transparent rounded-full animate-spin mx-auto' />
        <p className='mt-3 text-sm text-[#6B7280]'>Loading your kitchen.</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to='/login' replace />;
  if (!user.onboardingComplete) return <Navigate to='/onboarding' replace state={{ from: 'protected' }} />;
  return children;
}

export default function App() {
  const loadMe = useAuth(s => s.loadMe);
  useEffect(() => { loadMe(); }, [loadMe]);

  return (
    <Routes>
      <Route path='/' element={<Landing />} />
      <Route path='/login' element={<Login />} />
      <Route path='/onboarding' element={<Onboarding />} />
      <Route path='/app' element={<Protected><AppLayout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path='meals' element={<Meals />} />
        <Route path='grocery' element={<Grocery />} />
        <Route path='inventory' element={<Inventory />} />
        <Route path='cook' element={<Cook />} />
        <Route path='search' element={<SearchPage />} />
        <Route path='discover' element={<Discover />} />
        <Route path='taste' element={<Taste />} />
      </Route>
      <Route path='*' element={<NotFound />} />
    </Routes>
  );
}
