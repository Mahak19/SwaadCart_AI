import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth.js';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import Icon from './Icon.jsx';

const navItems = [
  { to: '/app', label: 'Home', icon: 'space_dashboard', end: true },
  { to: '/app/meals', label: 'Meals', icon: 'restaurant_menu' },
  { to: '/app/grocery', label: 'Grocery', icon: 'shopping_basket', badge: true },
  { to: '/app/inventory', label: 'Pantry', icon: 'inventory_2' },
  { to: '/app/cook', label: 'Cook', icon: 'blender' },
  { to: '/app/search', label: 'Search', icon: 'search' },
  { to: '/app/discover', label: 'Discover', icon: 'explore' },
  { to: '/app/taste', label: 'You', icon: 'diversity_1' }
];

const bottomNav = [
  { to: '/app', label: 'Home', icon: 'grid_view', end: true },
  { to: '/app/meals', label: 'Meals', icon: 'restaurant_menu' },
  { to: '/app/grocery', label: 'Grocery', icon: 'shopping_basket', badge: true },
  { to: '/app/inventory', label: 'Pantry', icon: 'kitchen' },
  { to: '/app/taste', label: 'You', icon: 'auto_awesome' }
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/dashboard/stats'),
    enabled: Boolean(user),
    refetchInterval: 30000
  });
  const { data: weather } = useQuery({
    queryKey: ['weather'],
    queryFn: () => api.get('/weather/current'),
    staleTime: 120000
  });

  const groceryCount = stats ? stats.groceryCount : 0;

  return (
    <div className='min-h-screen bg-surface'>
      {/* Desktop Sidebar */}
      <aside className='hidden lg:flex fixed left-0 top-0 h-screen w-72 bg-surface-container-lowest flex-col justify-between py-6 px-4 z-40 shadow-[0_1px_8px_rgba(0,0,0,0.04)]'>
        <div className='flex flex-col gap-6'>
          <div className='flex items-center gap-3 px-3 py-2'>
            <div className='w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm'>
              <Icon name='local_dining' size={24} />
            </div>
            <div className='flex flex-col'>
              <div className='flex items-center gap-1.5'>
                <span className='font-heading text-headline-sm text-on-surface tracking-tight'>SwaadCart</span>
                <span className='px-1.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed-variant text-label-sm font-bold'>AI</span>
              </div>
              <span className='text-label-sm text-on-surface-variant'>Smart Kitchen & Planning</span>
            </div>
          </div>
          <nav className='flex flex-col gap-1.5 pt-2'>
            {navItems.map(({ to, label, icon, end, badge }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) =>
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors text-label-lg ' +
                  (isActive
                    ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface')
                }>
                <Icon name={icon} size={20} />
                <span>{label}</span>
                {badge && groceryCount > 0 && (
                  <span className='ml-auto w-5 h-5 rounded-full bg-primary text-on-primary text-label-sm grid place-items-center font-bold'>{groceryCount}</span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className='flex flex-col gap-3 pt-4'>
          <button onClick={async () => { await logout(); navigate('/'); }}
            className='flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors text-label-lg'>
            <Icon name='logout' size={20} />
            <span>Logout</span>
          </button>
          {stats && (
            <div className='p-3.5 rounded-xl bg-surface-container-low flex items-center justify-between'>
              <div className='flex items-center gap-2.5'>
                <div className='w-2 h-2 rounded-full bg-primary' />
                <span className='text-label-sm text-on-surface-variant'>Cart sync ready</span>
              </div>
              <span className='text-label-sm text-primary font-bold'>₹{stats.spentINR}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Desktop Header */}
      <header className='hidden lg:block fixed top-0 left-72 right-0 h-16 bg-surface/80 backdrop-blur-xl z-30 shadow-[0_1px_8px_rgba(0,0,0,0.04)]'>
        <div className='h-16 w-full px-8 flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            {weather && weather.weather && (
              <div className='flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low'>
                <Icon name='thermostat' size={18} className='text-tertiary' />
                <span className='text-label-md text-on-surface-variant'>{Math.round(weather.weather.tempC)}°C</span>
              </div>
            )}
          </div>
          <div className='flex items-center gap-4'>
            <div className='w-8 h-8 rounded-full bg-primary flex items-center justify-center'>
              <Icon name='person' size={18} className='text-on-primary' />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className='lg:hidden fixed top-0 inset-x-0 z-50 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]'>
        <div className='h-14 px-4 flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <div className='w-8 h-8 rounded-lg bg-primary grid place-items-center'>
              <Icon name='local_dining' size={18} className='text-on-primary' />
            </div>
            <span className='font-heading text-headline-sm text-on-surface font-semibold tracking-tight'>SwaadCart</span>
            <span className='px-1.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed-variant text-label-sm font-bold'>AI</span>
          </div>
          <div className='flex items-center gap-2'>
            {weather && weather.weather && (
              <div className='flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant text-label-sm'>
                <Icon name='thermostat' size={14} className='text-tertiary' />
                <span>{Math.round(weather.weather.tempC)}°C</span>
              </div>
            )}
            <div className='w-8 h-8 rounded-full bg-primary grid place-items-center'>
              <Icon name='person' size={16} className='text-on-primary' />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='lg:pl-72 pt-14 lg:pt-16 pb-24 lg:pb-8 min-h-screen bg-surface'>
        <div className='max-w-7xl mx-auto px-4 lg:px-8 py-4 lg:py-6'>
          <div key={location.pathname} className='fade-up'>
            <Outlet />
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className='lg:hidden fixed bottom-0 inset-x-0 z-50 bg-surface-container-lowest/95 backdrop-blur-xl shadow-[0_-4px_20px_0_rgba(15,23,42,0.06)]'>
        <div className='flex justify-around items-center h-16 px-1'>
          {bottomNav.map(({ to, label, icon, end, badge }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                'flex flex-col items-center justify-center gap-0.5 w-16 h-12 transition-colors ' +
                (isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface')
              }>
              {({ isActive }) => (
                <>
                  <div className='relative flex items-center justify-center'>
                    <Icon name={icon} size={24} filled={isActive} />
                    {badge && groceryCount > 0 && (
                      <span className='absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary ring-2 ring-surface-container-lowest' />
                    )}
                  </div>
                  <span className='text-label-sm'>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
