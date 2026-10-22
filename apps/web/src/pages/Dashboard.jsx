import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import DishThumb from '../components/DishThumb.jsx';
import RecipeModal from '../components/RecipeModal.jsx';
import BudgetDialog from '../components/BudgetDialog.jsx';

const slotMeta = {
  breakfast: { emoji: 'wb_sunny', label: 'Breakfast', time: '8:30 AM' },
  lunch: { emoji: 'lunch_dining', label: 'Lunch', time: '1:30 PM' },
  snack: { emoji: 'cookie', label: 'Snack', time: '5:30 PM' },
  dinner: { emoji: 'wb_twilight', label: 'Dinner', time: '8:30 PM' }
};

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [recipeDishId, setRecipeDishId] = useState(null);
  const [showBudget, setShowBudget] = useState(false);

  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => api.get('/dashboard/stats') });
  const { data: meal } = useQuery({ queryKey: ['meal-plan'], queryFn: () => api.get('/meals/today') });
  const { data: insights } = useQuery({ queryKey: ['insights'], queryFn: () => api.get('/dashboard/insights') });
  const { data: weather } = useQuery({ queryKey: ['weather'], queryFn: () => api.get('/weather/current') });
  const { data: taste } = useQuery({ queryKey: ['taste'], queryFn: () => api.get('/taste/profile') });
  const { data: grocery } = useQuery({ queryKey: ['grocery'], queryFn: () => api.get('/grocery/current') });

  const sendFeedback = useMutation({
    mutationFn: (body) => api.post('/feedback', body),
    onSuccess: (r) => {
      setFeedbackMsg(r.learned ? r.learned.message : 'Noted!');
      qc.invalidateQueries({ queryKey: ['insights'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      setTimeout(() => setFeedbackMsg(''), 3000);
    }
  });

  const slots = meal && meal.slots ? meal.slots : {};
  const budgetPct = stats && stats.budgetINR ? Math.min(100, Math.round((stats.spentINR / stats.budgetINR) * 100)) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const plannedCount = stats ? stats.mealPlanCount : 0;
  const dinnerDish = slots.dinner && slots.dinner.dishId;
  const groceryItems = grocery && grocery.items ? grocery.items : [];
  const checkedCount = groceryItems.filter(i => i.checked).length;
  const expiringCount = stats ? stats.expiringSoonCount : 0;

  const StatCard = ({ icon, iconClass, bgClass, label, value, sub, link, linkLabel }) => (
    <div className='bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow'>
      <div className='flex items-center justify-between'>
        <div className={'w-11 h-11 rounded-xl flex items-center justify-center ' + bgClass}>
          <Icon name={icon} size={22} className={iconClass} />
        </div>
        {link && (
          <Link to={link} className='text-label-sm text-primary hover:underline'>{linkLabel || 'View'}</Link>
        )}
      </div>
      <div className='flex flex-col gap-0.5'>
        <span className='font-heading text-headline-md text-on-surface font-semibold tracking-tight'>{value}</span>
        <span className='text-label-md text-on-surface-variant'>{label}</span>
        {sub && <span className='text-body-sm text-on-surface-variant mt-0.5'>{sub}</span>}
      </div>
    </div>
  );

  return (
    <div className='flex flex-col pb-6 gap-4 lg:gap-6'>
      {/* Greeting */}
      <section className='pt-2 lg:pt-4'>
        <div className='flex items-center justify-between gap-2'>
          <div>
            <h1 className='font-heading text-headline-lg-m text-on-surface tracking-tight'>
              {greeting}, {stats && stats.userName ? stats.userName.split(' ')[0] : 'there'}.
            </h1>
            <p className='text-body-md text-on-surface-variant flex items-center gap-1.5 mt-0.5'>
              <span className='inline-block w-2 h-2 rounded-full bg-primary animate-pulse' />
              {dinnerDish
                ? `Dinner sorted · ${slots.dinner.dishId.prepMinutes || 25} min`
                : `${plannedCount} of 4 slots planned today`}
            </p>
          </div>
          {weather && weather.weather && (
            <div className='hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant shadow-sm shrink-0'>
              <Icon name='thermostat' size={18} className='text-tertiary' />
              <span className='text-label-sm'>{Math.round(weather.weather.tempC)}°C</span>
            </div>
          )}
        </div>
      </section>

      {/* Quick tools — mobile access to Cook / Search / Discover */}
      <section className='lg:hidden flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1'>
        <Link to='/app/discover' className='shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-primary to-primary-container text-white text-label-md font-semibold shadow-sm active:scale-95 transition-all'>
          <Icon name='explore' size={16} /> Discover
        </Link>
        <Link to='/app/cook' className='shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-surface-container-lowest text-on-surface text-label-md shadow-sm active:scale-95 transition-all'>
          <Icon name='blender' size={16} className='text-tertiary' /> Cook
        </Link>
        <Link to='/app/search' className='shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-surface-container-lowest text-on-surface text-label-md shadow-sm active:scale-95 transition-all'>
          <Icon name='search' size={16} className='text-secondary' /> Search
        </Link>
      </section>

      {/* Stat cards — 3-col on desktop */}
      <section className='grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4'>
        <div className='bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3'>
          <div className='flex items-center justify-between'>
            <div className='w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-primary'>
              <Icon name='account_balance_wallet' size={22} />
            </div>
            <div className='flex items-center gap-1.5'>
              <span className={'px-2.5 py-1 rounded-full text-label-sm font-bold flex items-center gap-1 ' +
                (budgetPct < 80 ? 'bg-primary-fixed text-on-primary-fixed' : budgetPct < 100 ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-error-container text-on-error-container')}>
                <Icon name={budgetPct < 80 ? 'check_circle' : 'warning'} size={13} />
                {budgetPct < 80 ? 'On Track' : budgetPct < 100 ? 'Watch' : 'Over'}
              </span>
              <button onClick={() => setShowBudget(true)}
                title='Add funds / adjust budget'
                className='w-8 h-8 rounded-full bg-surface-container grid place-items-center text-on-surface-variant hover:bg-primary-fixed hover:text-on-primary-fixed transition-all active:scale-95'>
                <Icon name='edit' size={16} />
              </button>
            </div>
          </div>
          <div className='flex flex-col gap-0.5'>
            <span className='font-heading text-headline-md text-on-surface font-semibold tracking-tight'>
              ₹{stats ? stats.spentINR.toLocaleString('en-IN') : '0'}
            </span>
            <span className='text-label-md text-on-surface-variant'>
              of ₹{stats ? stats.budgetINR.toLocaleString('en-IN') : '3,000'} this week
            </span>
          </div>
          <div className='w-full h-2 rounded-full bg-surface-container overflow-hidden'>
            <div className={'h-full rounded-full transition-all duration-500 ' + (budgetPct > 90 ? 'bg-error' : budgetPct > 70 ? 'bg-tertiary' : 'bg-gradient-to-r from-primary to-primary-container')}
              style={{ width: budgetPct + '%' }} />
          </div>
          <span className='text-body-sm text-on-surface-variant'>
            <strong className='text-on-surface font-semibold'>₹{stats ? stats.remainingINR.toLocaleString('en-IN') : '0'}</strong> left · {stats ? stats.daysLeftInWeek : '?'} days
            <button onClick={() => setShowBudget(true)} className='ml-1.5 text-primary font-semibold hover:underline'>Add funds</button>
          </span>
        </div>

        <StatCard icon='restaurant_menu' bgClass='bg-secondary-container/50' iconClass='text-secondary'
          value={`${plannedCount} / 4`} label='Meals planned today'
          sub={dinnerDish ? 'Dinner ready to cook' : 'Generate a plan to fill your day'}
          link='/app/meals' linkLabel='Open' />

        <StatCard icon='inventory_2' bgClass='bg-tertiary-fixed/40' iconClass='text-tertiary'
          value={stats ? stats.groceryCount : 0} label='Items in smart cart'
          sub={expiringCount > 0 ? `${expiringCount} pantry item${expiringCount > 1 ? 's' : ''} expiring soon` : 'Pantry looking fresh'}
          link='/app/inventory' linkLabel='Pantry' />
      </section>

      {/* Main grid: meal card (8) + right rail (4) */}
      <div className='grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6'>
        {/* Left — Meal picks */}
        <div className='lg:col-span-8 flex flex-col gap-4'>
          <section>
            <div className='flex items-center justify-between mb-2'>
              <div className='flex items-center gap-1.5'>
                <Icon name='temp_preferences_custom' size={20} className='text-primary' />
                <span className='text-label-lg text-on-surface'>Meal picks · powered by MealMind</span>
              </div>
              <Link to='/app/meals' className='text-label-sm text-secondary bg-surface-container px-2.5 py-1 rounded-full hover:bg-surface-container-high transition-colors'>All meals</Link>
            </div>

            {slots.dinner && slots.dinner.dishId ? (
              <div className='bg-surface-container-lowest rounded-2xl shadow-md overflow-hidden flex flex-col'>
                <div className='relative w-full h-48 lg:h-56 bg-gradient-to-br from-primary to-primary-container'>
                  <DishThumb src={slots.dinner.dishId.imageUrl} name={slots.dinner.dishId.name}
                    icon='restaurant_menu' iconSize={80} className='absolute inset-0 w-full h-full' />
                  <div className='absolute inset-0 bg-gradient-to-t from-inverse-surface/85 via-inverse-surface/30 to-transparent' />
                  <div className='absolute top-3 left-3 flex gap-2'>
                    <span className='px-2.5 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-label-sm shadow flex items-center gap-1 backdrop-blur-md'>
                      <Icon name='kitchen' size={14} />
                      {slots.dinner.dishId.prepMinutes || 25}m · ₹{slots.dinner.dishId.estimatedCostPerServingINR}/serving
                    </span>
                    <span className='px-2 py-1 rounded-md bg-white/20 backdrop-blur-md text-white text-label-sm capitalize'>
                      {slots.dinner.dishId.diet}
                    </span>
                  </div>
                  <div className='absolute bottom-3 left-3 right-3'>
                    <span className='text-label-sm uppercase tracking-wider text-surface-variant'>Tonight's Focus</span>
                    <h2 className='font-heading text-headline-lg-m text-white font-semibold leading-tight'>
                      {slots.dinner.dishId.name}
                    </h2>
                  </div>
                </div>

                {/* Meal Schedule Bar */}
                <div className='px-4 py-2.5 bg-surface-container-low flex items-center justify-between gap-2 overflow-x-auto text-nowrap no-scrollbar'>
                  {['breakfast', 'lunch', 'snack', 'dinner'].map(slot => {
                    const s = slots[slot];
                    const dish = s && s.dishId;
                    return (
                      <div key={slot} className='flex items-center gap-1 text-label-sm text-secondary shrink-0'>
                        <Icon name={dish ? 'check_circle' : slotMeta[slot].emoji} size={16} className={dish ? 'text-primary' : 'text-outline-variant'} />
                        <span className={slot === 'dinner' ? 'text-primary font-semibold' : ''}>
                          {dish ? dish.name : slotMeta[slot].label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Reasons */}
                {slots.dinner.explanation?.reasons?.length > 0 && (
                  <div className='p-4 flex flex-col gap-2'>
                    <p className='text-body-md text-on-surface-variant'>
                      {slots.dinner.explanation.reasons.join(' · ')}
                    </p>
                  </div>
                )}

                {/* Recipe + Feedback */}
                <div className='px-4 pb-4 flex flex-col gap-2.5'>
                  <button onClick={() => setRecipeDishId(slots.dinner.dishId._id)}
                    className='w-full py-2.5 rounded-full bg-surface-container hover:bg-primary-fixed hover:text-on-primary-fixed text-on-surface text-label-lg font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]'>
                    <Icon name='menu_book' size={18} />
                    View preparation guide
                  </button>
                  <div className='flex items-center justify-between'>
                    <span className='text-label-sm text-secondary'>Fine-tune recommendations:</span>
                    <div className='flex items-center gap-1.5'>
                      <button onClick={() => sendFeedback.mutate({ dishId: slots.dinner.dishId._id, slot: 'dinner', action: 'love' })}
                        className='flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container hover:bg-primary-fixed hover:text-on-primary-fixed text-on-surface-variant text-label-sm transition-all active:scale-95'>
                        <Icon name='favorite' size={18} /> Love
                      </button>
                      <button onClick={() => sendFeedback.mutate({ dishId: slots.dinner.dishId._id, slot: 'dinner', action: 'dislike' })}
                        className='flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container hover:bg-tertiary-fixed hover:text-on-tertiary-fixed text-on-surface-variant text-label-sm transition-all active:scale-95'>
                        <Icon name='swap_horiz' size={18} /> Swap
                      </button>
                      <button onClick={() => sendFeedback.mutate({ dishId: slots.dinner.dishId._id, slot: 'dinner', action: 'never' })}
                        className='p-1.5 rounded-full bg-surface-container hover:bg-error-container hover:text-on-error-container text-on-surface-variant transition-all active:scale-95'>
                        <Icon name='block' size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className='bg-surface-container-lowest rounded-2xl p-8 shadow-sm text-center'>
                <Icon name='restaurant_menu' size={40} className='text-surface-container-highest mx-auto' />
                <p className='mt-2 text-body-md text-on-surface-variant'>No meal plan for today yet</p>
                <button onClick={() => navigate('/app/meals')} className='mt-3 px-5 py-2.5 rounded-full bg-primary text-on-primary text-label-lg font-semibold shadow-md active:scale-95 transition-all'>
                  Generate meal plan
                </button>
              </div>
            )}
          </section>

          {/* MealMind Learning */}
          {insights && insights.feedbackCount > 0 && (
            <section className='bg-surface-container rounded-xl p-4 shadow-sm flex items-start gap-3'>
              <div className='p-1.5 rounded-full bg-primary-fixed text-on-primary-fixed mt-0.5 shrink-0'>
                <Icon name='psychology' size={16} />
              </div>
              <div className='flex flex-col gap-0.5 flex-1 min-w-0'>
                <span className='text-label-sm text-primary font-bold uppercase tracking-wider'>MealMind Tuning Active</span>
                <p className='text-body-sm text-on-surface-variant leading-snug'>
                  {(insights.learningLog && insights.learningLog[0] && insights.learningLog[0].message) ||
                    `${insights.feedbackCount} signals learned · exploration ${(insights.explorationRate * 100).toFixed(0)}%`}
                </p>
              </div>
              <Link to='/app/taste' className='text-label-sm text-on-surface-variant underline hover:text-on-surface shrink-0'>View</Link>
            </section>
          )}

          {/* Quick Cook CTA */}
          <section>
            <Link to='/app/cook' className='bg-secondary-container rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 hover:shadow-md transition-shadow block'>
              <div className='flex items-center gap-3'>
                <div className='w-11 h-11 rounded-full bg-surface-container-lowest flex items-center justify-center text-tertiary shrink-0 shadow-sm'>
                  <Icon name='blender' size={24} />
                </div>
                <div>
                  <h3 className='text-label-lg text-on-secondary-fixed font-semibold'>Cook with what I have</h3>
                  <p className='text-body-sm text-on-secondary-container'>Got leftover sabzi or half veggies? Let's fix a meal.</p>
                </div>
              </div>
              <Icon name='chevron_right' size={24} className='text-on-secondary-fixed shrink-0' />
            </Link>
          </section>
        </div>

        {/* Right rail */}
        <div className='lg:col-span-4 flex flex-col gap-4'>
          {/* Smart Cart Delta */}
          <section className='bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <div className='w-9 h-9 rounded-lg bg-primary-container/50 flex items-center justify-center text-primary'>
                  <Icon name='shopping_basket' size={20} />
                </div>
                <h3 className='text-label-lg text-on-surface font-semibold'>Smart Cart Delta</h3>
              </div>
              {stats && stats.groceryCount > 0 && (
                <Link to='/app/grocery' className='text-label-sm text-primary hover:underline'>Open</Link>
              )}
            </div>
            {groceryItems.length > 0 ? (
              <>
                <div className='flex items-baseline justify-between'>
                  <div className='flex flex-col'>
                    <span className='font-heading text-headline-md text-on-surface font-semibold tracking-tight'>
                      ₹{grocery ? grocery.estimatedTotalINR : 0}
                    </span>
                    <span className='text-label-sm text-on-surface-variant'>
                      est. total · ₹{grocery ? grocery.budgetINR : 0} budget
                    </span>
                  </div>
                  <span className='text-label-md text-primary font-semibold'>{checkedCount}/{groceryItems.length} in basket</span>
                </div>
                <div className='w-full h-2 rounded-full bg-surface-container overflow-hidden'>
                  <div className='h-full rounded-full bg-primary transition-all duration-500'
                    style={{ width: (groceryItems.length ? Math.round((checkedCount / groceryItems.length) * 100) : 0) + '%' }} />
                </div>
                <div className='flex items-center gap-1.5 text-body-sm text-on-surface-variant'>
                  <Icon name='bolt' size={14} className='text-tertiary shrink-0' />
                  <span>Swap onion for leeks — saves ₹32 this week</span>
                </div>
              </>
            ) : (
              <div className='flex flex-col items-center py-4 gap-2'>
                <Icon name='shopping_cart' size={32} className='text-surface-container-highest' />
                <p className='text-body-sm text-on-surface-variant text-center'>Cart is empty — generate groceries from your meal plan</p>
                <Link to='/app/grocery' className='text-label-sm text-primary font-semibold hover:underline'>Open grocery →</Link>
              </div>
            )}
          </section>

          {/* Predictive Nudges */}
          <section className='bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3'>
            <div className='flex items-center gap-2'>
              <div className='w-9 h-9 rounded-lg bg-tertiary-fixed/40 flex items-center justify-center text-tertiary'>
                <Icon name='lightbulb' size={20} />
              </div>
              <h3 className='text-label-lg text-on-surface font-semibold'>Predictive Nudges</h3>
            </div>
            <div className='flex flex-col gap-2.5'>
              {expiringCount > 0 && (
                <div className='flex items-start gap-2.5 p-3 rounded-xl bg-error-container/40'>
                  <Icon name='timer' size={18} className='text-error shrink-0 mt-0.5' />
                  <div className='flex flex-col'>
                    <span className='text-label-md text-on-surface font-semibold'>{expiringCount} item{expiringCount > 1 ? 's' : ''} expiring soon</span>
                    <span className='text-body-sm text-on-surface-variant'>Cook them this week to avoid waste</span>
                  </div>
                </div>
              )}
              <div className='flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-low'>
                <Icon name='wb_sunny' size={18} className='text-tertiary shrink-0 mt-0.5' />
                <div className='flex flex-col'>
                  <span className='text-label-md text-on-surface font-semibold'>{plannedCount < 4 ? `${4 - plannedCount} slot${4 - plannedCount > 1 ? 's' : ''} unplanned` : 'Day fully planned'}</span>
                  <span className='text-body-sm text-on-surface-variant'>{plannedCount < 4 ? 'Generate a full day plan for smarter shopping' : 'All four meals covered — great job!'}</span>
                </div>
              </div>
              {(insights && insights.feedbackCount > 0) && (
                <div className='flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-low'>
                  <Icon name='psychology' size={18} className='text-primary shrink-0 mt-0.5' />
                  <div className='flex flex-col'>
                    <span className='text-label-md text-on-surface font-semibold'>Exploration at {(insights.explorationRate * 100).toFixed(0)}%</span>
                    <span className='text-body-sm text-on-surface-variant'>MealMind is balancing favorites with new dishes</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Household Pulse */}
          {taste && taste.topCuisines && taste.topCuisines.length > 0 && (
            <section className='bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <div className='w-9 h-9 rounded-lg bg-secondary-container/50 flex items-center justify-center text-secondary'>
                    <Icon name='groups' size={20} />
                  </div>
                  <h3 className='text-label-lg text-on-surface font-semibold'>Household Pulse</h3>
                </div>
                <Link to='/app/taste' className='text-label-sm text-primary hover:underline'>Full profile</Link>
              </div>
              <div className='flex flex-wrap gap-2'>
                {taste.topCuisines.slice(0, 5).map(c => (
                  <span key={c.cuisine} className='px-3 py-1.5 rounded-full bg-surface-container-low text-label-md text-on-surface capitalize'>
                    {c.cuisine}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Feedback toast */}
      {feedbackMsg && (
        <div className='fixed bottom-24 lg:bottom-8 left-4 right-4 lg:left-auto lg:right-8 lg:w-96 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 fade-up'>
          <Icon name='psychology' size={20} className='text-primary-fixed shrink-0' />
          <span className='text-body-sm'>{feedbackMsg}</span>
        </div>
      )}

      {/* Recipe modal */}
      {recipeDishId && <RecipeModal dishId={recipeDishId} onClose={() => setRecipeDishId(null)} />}

      {/* Budget dialog */}
      {showBudget && stats && (
        <BudgetDialog currentBudget={stats.budgetINR} onClose={() => setShowBudget(false)} />
      )}
    </div>
  );
}
