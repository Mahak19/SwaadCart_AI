import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import DishThumb from '../components/DishThumb.jsx';
import RecipeModal from '../components/RecipeModal.jsx';

const slotOrder = ['breakfast', 'lunch', 'snack', 'dinner'];
const slotMeta = {
  breakfast: { icon: 'wb_sunny', time: '8:30 AM', label: 'Breakfast' },
  lunch: { icon: 'lunch_dining', time: '1:30 PM', label: 'Lunch' },
  snack: { icon: 'cookie', time: '5:30 PM', label: 'Evening Fuel' },
  dinner: { icon: 'wb_twilight', time: '8:30 PM', label: 'Dinner' }
};

const cuisineFilters = [
  { id: 'local', label: 'Local / Home-style', icon: 'home' },
  { id: 'mixed', label: 'Mixed Fusion' },
  { id: 'explore', label: 'Something New' },
  { id: 'quick', label: '< 20 min', icon: 'timer' }
];

const feedbackActions = [
  { action: 'love', icon: 'favorite', label: 'Love it', activeClass: 'bg-primary-fixed text-on-primary-fixed' },
  { action: 'dislike', icon: 'thumb_down', label: 'Dislike', activeClass: 'bg-tertiary-fixed text-on-tertiary-fixed' },
  { action: 'never', icon: 'block', label: 'Never', activeClass: 'bg-error-container text-on-error-container' }
];

export default function Meals() {
  const qc = useQueryClient();
  const [mode, setMode] = useState('normal');
  const [activeFilter, setActiveFilter] = useState('local');
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [lastFeedback, setLastFeedback] = useState({});
  const [recipeDishId, setRecipeDishId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0);

  const dayDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const selectedDate = dayDates[selectedDay].toISOString().slice(0, 10);

  const { data: today, isLoading } = useQuery({
    queryKey: ['today', selectedDate],
    queryFn: () => api.get('/meals/today?date=' + selectedDate)
  });
  const { data: insights } = useQuery({ queryKey: ['insights'], queryFn: () => api.get('/dashboard/insights') });
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => api.get('/dashboard/stats') });

  const generate = useMutation({
    mutationFn: (slots) => api.post('/meals/generate', slots && slots.length ? { mode, slots, date: selectedDate } : { mode, date: selectedDate }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ['today'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      setFeedbackStatus(vars && vars.length === 1
        ? slotMeta[vars[0]].label + ' refreshed with a new pick!'
        : 'New plan generated — all meals refreshed!');
      setTimeout(() => setFeedbackStatus(''), 2500);
    }
  });

  const generateWeek = useMutation({
    mutationFn: () => api.post('/meals/week', { mode, days: 7, date: dayDates[0].toISOString().slice(0, 10) }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['today'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      setFeedbackStatus('Full week planned — ' + r.uniqueDishes + ' distinct dishes across ' + r.totalMeals + ' meals!');
      setTimeout(() => setFeedbackStatus(''), 3500);
    }
  });

  const sendFeedback = useMutation({
    mutationFn: (body) => api.post('/feedback', body),
    onSuccess: (r, vars) => {
      setFeedbackStatus(r.learned ? r.learned.message : 'Preference saved!');
      setLastFeedback(p => ({ ...p, [vars.slot]: vars.action }));
      qc.invalidateQueries({ queryKey: ['insights'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      setTimeout(() => setFeedbackStatus(''), 2500);
    }
  });

  const slots = today && today.slots ? today.slots : {};
  const plannedCount = Object.values(slots).filter(s => s && s.dishId).length;

  // 7-day horizon from today
  const weekDays = dayDates.map((d, i) => ({
    label: i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
    date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    isToday: i === 0,
    index: i
  }));

  return (
    <div className='flex flex-col pb-6 gap-3 lg:gap-0'>
      <div className='lg:grid lg:grid-cols-12 lg:gap-6 lg:pt-4'>
        {/* Left column (7) — timeline */}
        <div className='lg:col-span-7 flex flex-col gap-3'>
          {/* Mode Switcher */}
          <div className='pt-4 lg:pt-0'>
            <div className='bg-surface-container-high p-1 rounded-full flex items-center shadow-inner'>
              <button onClick={() => setMode('normal')}
                className={'flex-1 py-1.5 px-3 rounded-full text-label-md transition-all duration-200 text-center flex items-center justify-center gap-1.5 ' +
                  (mode === 'normal' ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold' : 'text-on-surface-variant hover:text-on-surface')}>
                <span className={'w-2 h-2 rounded-full ' + (mode === 'normal' ? 'bg-primary animate-pulse' : 'bg-outline-variant')} />
                <span>Balanced</span>
              </button>
              <button onClick={() => setMode('surprise')}
                className={'flex-1 py-1.5 px-3 rounded-full text-label-md transition-all duration-200 text-center flex items-center justify-center gap-1.5 ' +
                  (mode === 'surprise' ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold' : 'text-on-surface-variant hover:text-on-surface')}>
                <Icon name='casino' size={16} />
                <span>Surprise Me</span>
              </button>
            </div>
          </div>

          {/* Learning banner */}
          {insights && insights.feedbackCount > 0 && (
            <div className='bg-gradient-to-r from-surface-container-low via-surface-container to-secondary-container/40 p-3.5 rounded-xl shadow-sm flex items-start gap-3'>
              <div className='w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed shrink-0 shadow-sm mt-0.5'>
                <Icon name='psychology' size={18} />
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center justify-between gap-1'>
                  <span className='text-label-md text-primary font-semibold tracking-tight flex items-center gap-1'>
                    MealMind Adaptation
                    <span className='inline-block w-1.5 h-1.5 rounded-full bg-primary' />
                  </span>
                  <span className='text-label-sm text-on-surface-variant bg-surface-container-lowest px-2 py-0.5 rounded-full font-medium shadow-sm'>
                    {insights.feedbackCount} signals
                  </span>
                </div>
                <p className='text-body-sm text-on-surface-variant mt-0.5 leading-snug'>
                  Exploration rate at <span className='font-semibold text-on-surface'>{(insights.explorationRate * 100).toFixed(0)}%</span> — trying new dishes while honoring your favorites.
                </p>
              </div>
            </div>
          )}

          {/* Cuisine filters */}
          <div className='flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar'>
            {cuisineFilters.map(f => (
              <button key={f.id} onClick={() => setActiveFilter(f.id)}
                className={'whitespace-nowrap px-3.5 py-1.5 rounded-full text-label-md shadow-sm flex items-center gap-1 active:scale-95 transition-all ' +
                  (activeFilter === f.id
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high')}>
                {f.icon && <Icon name={f.icon} size={15} filled={activeFilter === f.id} />}
                <span>{f.label}</span>
              </button>
            ))}
          </div>

          {/* Feedback status */}
          {feedbackStatus && (
            <div className='bg-primary-fixed/20 text-on-primary-fixed px-4 py-2.5 rounded-xl text-body-sm font-medium flex items-center gap-2 fade-up'>
              <Icon name='check_circle' size={16} className='text-primary shrink-0' />
              {feedbackStatus}
            </div>
          )}

          {/* Generate buttons */}
          <div className='flex flex-col gap-2'>
            <button onClick={() => generate.mutate()} disabled={generate.isPending}
              className='w-full py-3.5 rounded-full bg-primary text-on-primary text-label-lg font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all disabled:opacity-60'>
              <Icon name={generate.isPending ? 'progress_activity' : 'auto_awesome'} size={20} className={generate.isPending ? 'animate-spin' : ''} />
              <span>{generate.isPending ? 'MealMind is thinking…' : (selectedDay === 0 ? "Generate today's plan" : 'Generate ' + weekDays[selectedDay].label + "'s plan")}</span>
              <Icon name='arrow_forward' size={18} />
            </button>
            <button onClick={() => generateWeek.mutate()} disabled={generateWeek.isPending}
              className='w-full py-3 rounded-full bg-surface-container-high text-on-surface text-label-lg font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all disabled:opacity-60 hover:bg-surface-container-highest'>
              <Icon name={generateWeek.isPending ? 'progress_activity' : 'calendar_month'} size={19} className={generateWeek.isPending ? 'animate-spin' : ''} />
              <span>{generateWeek.isPending ? 'Planning your week…' : 'Generate full 7-day week'}</span>
            </button>
          </div>

          {/* Meal Timeline */}
          <div className='flex items-center justify-between px-1'>
            <span className='font-heading text-headline-sm text-on-surface tracking-tight'>{selectedDay === 0 ? "Today's Flow" : weekDays[selectedDay].label + "'s Flow"}</span>
            <span className='text-label-sm text-on-surface-variant uppercase tracking-wider'>{plannedCount} of 4 planned</span>
          </div>

          {isLoading ? (
            slotOrder.map(s => <div key={s} className='bg-surface-container-lowest rounded-2xl h-36 animate-pulse shadow-sm' />)
          ) : (
            <div className='flex flex-col gap-2.5'>
              {slotOrder.map(slot => {
                const s = slots[slot];
                const dish = s && s.dishId;
                const meta = slotMeta[slot];
                const isDinner = slot === 'dinner';
                const lastFb = lastFeedback[slot];

                return (
                  <div key={slot} className={
                    isDinner && dish
                      ? 'relative bg-surface-container-lowest rounded-2xl p-4 shadow-md flex flex-col gap-3 overflow-hidden'
                      : 'bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-2.5 transition-all hover:shadow-md'
                  }>
                    {isDinner && dish && (
                      <div className='absolute -right-12 -top-12 w-44 h-44 rounded-full bg-primary-fixed/20 blur-2xl pointer-events-none' />
                    )}

                    <div className='flex items-start justify-between gap-3 relative z-10'>
                      <div className='flex items-center gap-2'>
                        <span className='px-2 py-0.5 rounded-md bg-surface-container text-secondary text-label-sm font-semibold'>{meta.time}</span>
                        <span className='text-label-md text-on-surface-variant'>{meta.label}</span>
                      </div>
                      {dish ? (
                        <div className='flex items-center gap-1.5'>
                          <span className='flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-fixed/20 text-primary text-label-sm font-semibold'>
                            <Icon name='check_circle' size={14} /> Planned
                          </span>
                          <button
                            onClick={() => generate.mutate([slot])}
                            disabled={generate.isPending}
                            title={'Change ' + meta.label}
                            className='w-7 h-7 rounded-full bg-surface-container grid place-items-center text-on-surface-variant hover:bg-primary-fixed hover:text-on-primary-fixed transition-all active:scale-95 disabled:opacity-50'>
                            <Icon name={generate.isPending ? 'progress_activity' : 'swap_horiz'} size={15} className={generate.isPending ? 'animate-spin' : ''} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => generate.mutate([slot])}
                          disabled={generate.isPending}
                          className='flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary text-on-primary text-label-sm font-semibold hover:opacity-90 transition-all active:scale-95 disabled:opacity-50'>
                          <Icon name={generate.isPending ? 'progress_activity' : 'auto_awesome'} size={13} className={generate.isPending ? 'animate-spin' : ''} />
                          Fill this slot
                        </button>
                      )}
                    </div>

                    {!dish ? (
                      <div className='relative z-10 text-body-sm text-on-surface-variant bg-surface-container-low rounded-xl p-4 text-center'>
                        Nothing planned for {meta.label} — tap <span className='font-semibold text-primary'>Fill this slot</span>
                      </div>
                    ) : (
                      <>
                        <div className='flex gap-3.5 items-center relative z-10'>
                          <DishThumb src={dish.imageUrl} name={dish.name} icon={meta.icon} iconSize={28}
                            className='w-16 h-16 rounded-xl shrink-0 shadow-inner' />
                          <div className='flex-1 min-w-0'>
                            <h3 className='font-heading text-headline-sm text-on-surface leading-tight truncate'>{dish.name}</h3>
                            <p className='text-body-sm text-on-surface-variant mt-0.5 line-clamp-1'>
                              ₹{dish.estimatedCostPerServingINR}/serving · {dish.prepMinutes}m · {dish.cuisine}
                            </p>
                            <div className='flex items-center gap-1.5 mt-1.5 flex-wrap'>
                              <span className='px-2 py-0.5 rounded-full bg-surface-container text-label-sm text-on-surface-variant capitalize'>{dish.diet}</span>
                              <span className='px-2 py-0.5 rounded-full bg-surface-container text-label-sm text-on-surface-variant'>{'🌶'.repeat(dish.spice || 1)}</span>
                              <button onClick={() => setRecipeDishId(dish._id)}
                                className='flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-label-sm font-semibold hover:bg-primary-fixed hover:text-on-primary-fixed transition-all'>
                                <Icon name='menu_book' size={12} /> Recipe
                              </button>
                            </div>
                          </div>
                        </div>

                        {s.explanation?.reasons?.length > 0 && (
                          <div className='bg-surface-container-low rounded-xl p-2.5 flex items-start gap-2 relative z-10'>
                            <Icon name='eco' size={16} className='text-primary shrink-0 mt-0.5' />
                            <p className='text-body-sm text-on-surface font-medium leading-relaxed'>
                              {s.explanation.reasons.join('. ')}.
                            </p>
                          </div>
                        )}

                        {/* Feedback buttons */}
                        <div className='grid grid-cols-3 gap-2 pt-1 relative z-10'>
                          {feedbackActions.map(({ action, icon, label, activeClass }) => (
                            <button key={action}
                              onClick={() => sendFeedback.mutate({ dishId: dish._id, slot, action })}
                              className={'py-2 px-3 rounded-xl text-label-md flex items-center justify-center gap-1.5 transition-all active:scale-95 ' +
                                (lastFb === action
                                  ? activeClass + ' font-bold'
                                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container')}>
                              <Icon name={icon} size={18} />
                              <span>{label}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column (5) — 7-day horizon + cook panel */}
        <div className='lg:col-span-5 flex flex-col gap-4 mt-4 lg:mt-0'>
          {/* 7-day horizon */}
          <section className='bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <div className='w-9 h-9 rounded-lg bg-secondary-container/50 flex items-center justify-center text-secondary'>
                  <Icon name='calendar_month' size={20} />
                </div>
                <h3 className='text-label-lg text-on-surface font-semibold'>7-Day Horizon</h3>
              </div>
              <span className='text-label-sm text-on-surface-variant'>{stats ? stats.daysLeftInWeek : '?'} days left in week</span>
            </div>
            <div className='flex flex-col gap-1.5'>
              {weekDays.map((d, i) => (
                <button key={i} onClick={() => setSelectedDay(i)}
                  className={'flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all active:scale-[0.99] ' +
                    (selectedDay === i
                      ? 'bg-primary-container/40 border border-primary/20'
                      : 'bg-surface-container-low hover:bg-surface-container-high')}>
                  <div className='flex items-center gap-2.5'>
                    <span className={'text-label-md w-14 ' + (selectedDay === i ? 'text-primary font-bold' : 'text-on-surface-variant')}>{d.label}</span>
                    <span className='text-body-sm text-on-surface-variant'>{d.date}</span>
                  </div>
                  <span className={'text-label-sm ' + (selectedDay === i ? 'text-primary font-semibold' : 'text-on-surface-variant')}>
                    {selectedDay === i ? `${plannedCount}/4` : (i === 0 ? `${plannedCount}/4` : 'View →')}
                  </span>
                </button>
              ))}
            </div>
            <p className='text-body-sm text-on-surface-variant flex items-start gap-1.5'>
              <Icon name='info' size={14} className='text-secondary shrink-0 mt-0.5' />
              Tap any day to view it, or plan the whole week at once — MealMind keeps dishes different across days.
            </p>
          </section>

          {/* Cook panel */}
          <section className='bg-secondary-container rounded-2xl p-5 shadow-sm flex flex-col gap-3'>
            <div className='flex items-center gap-2'>
              <div className='w-9 h-9 rounded-lg bg-surface-container-lowest flex items-center justify-center text-tertiary shadow-sm'>
                <Icon name='blender' size={20} />
              </div>
              <h3 className='text-label-lg text-on-secondary-fixed font-semibold'>Cook with what I have</h3>
            </div>
            <p className='text-body-sm text-on-secondary-container'>
              Leftover sabzi, half a packet of paneer, or random veggies? Tell MealMind what's in your kitchen and get a full recipe.
            </p>
            <Link to='/app/cook'
              className='mt-1 w-full py-2.5 rounded-full bg-surface-container-lowest text-on-surface text-label-lg font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all'>
              <Icon name='kitchen' size={18} className='text-tertiary' />
              Open Cook Mode
              <Icon name='arrow_forward' size={16} />
            </Link>
          </section>

          {/* Discover panel */}
          <section className='bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3'>
            <div className='flex items-center gap-2'>
              <div className='w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-container grid place-items-center shadow-sm'>
                <Icon name='explore' size={20} className='text-white' />
              </div>
              <h3 className='text-label-lg text-on-surface font-semibold'>Discover unique dishes</h3>
            </div>
            <p className='text-body-sm text-on-surface-variant'>
              AI ideas, YouTube recipes and regional gems from across India — beyond your usual menu.
            </p>
            <Link to='/app/discover'
              className='mt-1 w-full py-2.5 rounded-full bg-primary text-on-primary text-label-lg font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all'>
              <Icon name='explore' size={18} />
              Open Discover
              <Icon name='arrow_forward' size={16} />
            </Link>
          </section>

          {/* Budget snapshot */}
          {stats && (
            <section className='bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3'>
              <div className='flex items-center gap-2'>
                <div className='w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary'>
                  <Icon name='account_balance_wallet' size={20} />
                </div>
                <h3 className='text-label-lg text-on-surface font-semibold'>Weekly Budget</h3>
              </div>
              <div className='flex items-baseline gap-1.5'>
                <span className='font-heading text-headline-md text-on-surface font-semibold tracking-tight'>₹{stats.spentINR.toLocaleString('en-IN')}</span>
                <span className='text-body-sm text-on-surface-variant'>/ ₹{stats.budgetINR.toLocaleString('en-IN')}</span>
              </div>
              <div className='w-full h-2 rounded-full bg-surface-container overflow-hidden'>
                <div className='h-full rounded-full bg-gradient-to-r from-primary to-primary-container transition-all duration-500'
                  style={{ width: Math.min(100, Math.round((stats.spentINR / stats.budgetINR) * 100)) + '%' }} />
              </div>
              <span className='text-body-sm text-on-surface-variant'>₹{stats.remainingINR.toLocaleString('en-IN')} left this week</span>
            </section>
          )}
        </div>
      </div>

      {/* Recipe modal */}
      {recipeDishId && <RecipeModal dishId={recipeDishId} onClose={() => setRecipeDishId(null)} />}
    </div>
  );
}
