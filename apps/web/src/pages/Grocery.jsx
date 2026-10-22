import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import BudgetDialog from '../components/BudgetDialog.jsx';

const categoryMeta = {
  vegetable: { label: 'Fresh Produce & Greens', icon: 'eco', color: 'text-primary' },
  fruit: { label: 'Fruits', icon: 'nutrition', color: 'text-tertiary' },
  dairy: { label: 'Dairy & Chilled', icon: 'water_bottle', color: 'text-secondary' },
  grain: { label: 'Grains & Staples', icon: 'inventory_2', color: 'text-tertiary' },
  pulse: { label: 'Pulses & Lentils', icon: 'grain', color: 'text-primary' },
  spice: { label: 'Spices & Masalas', icon: 'grain', color: 'text-tertiary' },
  protein: { label: 'Protein', icon: 'egg_alt', color: 'text-error' },
  other: { label: 'Other Items', icon: 'shopping_bag', color: 'text-secondary' }
};

export default function Grocery() {
  const qc = useQueryClient();
  const [newItem, setNewItem] = useState('');
  const [showToast, setShowToast] = useState('');
  const [showBudget, setShowBudget] = useState(false);

  const { data: list } = useQuery({ queryKey: ['grocery'], queryFn: () => api.get('/grocery/current') });
  const { data: catalog } = useQuery({
    queryKey: ['catalog', newItem],
    queryFn: () => api.get('/catalog/ingredients?q=' + encodeURIComponent(newItem)),
    enabled: newItem.length >= 2
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['grocery'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };

  const flashToast = (msg) => { setShowToast(msg); setTimeout(() => setShowToast(''), 3000); };

  const plan = useMutation({
    mutationFn: () => api.post('/grocery/plan', {}),
    onSuccess: () => { invalidate(); flashToast('Grocery list regenerated from your meal plan'); }
  });
  const toggle = useMutation({
    mutationFn: ({ id, checked }) => api.patch('/grocery/items/' + id, { checked }),
    onSuccess: invalidate
  });
  const complete = useMutation({
    mutationFn: () => api.post('/grocery/complete', {}),
    onSuccess: (r) => {
      invalidate();
      flashToast(`Transferred ${r.moved || 0} items to pantry!`);
    }
  });
  const addManual = useMutation({
    mutationFn: (ingredientId) => api.post('/grocery/items', { ingredientId, qty: 500, unit: 'g', estPriceINR: 40, reasons: ['manual'] }),
    onSuccess: () => { setNewItem(''); invalidate(); flashToast('Added to list'); }
  });

  const items = list && list.items ? list.items : [];
  const checkedCount = items.filter(i => i.checked).length;
  const budgetPct = list && list.budgetINR ? Math.min(100, Math.round((list.estimatedTotalINR / list.budgetINR) * 100)) : 0;
  const underBudget = list && list.budgetINR ? list.budgetINR - list.estimatedTotalINR : 0;

  // Group by category
  const grouped = {};
  items.forEach(item => {
    const cat = item.ingredientId && item.ingredientId.category ? item.ingredientId.category : 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  // Category subtotals for desktop sidebar
  const categoryTotals = Object.entries(grouped).map(([cat, catItems]) => ({
    cat,
    label: (categoryMeta[cat] || categoryMeta.other).label,
    icon: (categoryMeta[cat] || categoryMeta.other).icon,
    color: (categoryMeta[cat] || categoryMeta.other).color,
    count: catItems.length,
    subtotal: catItems.reduce((sum, i) => sum + (i.estPriceINR || 0), 0)
  })).sort((a, b) => b.subtotal - a.subtotal);

  return (
    <div className='flex flex-col pb-6 gap-3 lg:gap-0 lg:pt-4'>
      <div className='lg:grid lg:grid-cols-12 lg:gap-6'>
        {/* Left (8) — list */}
        <div className='lg:col-span-8 flex flex-col gap-3'>
          {/* Summary Card */}
          <section className='pt-4 lg:pt-0 bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden'>
            <div className='absolute -right-6 -bottom-6 w-28 h-28 bg-primary/5 rounded-full pointer-events-none blur-xl' />
            <div className='flex items-center justify-between gap-2'>
              <div className='flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-fixed text-label-sm'>
                <Icon name='sync_saved_locally' size={14} />
                <span>Connected to {items.length} planned items</span>
              </div>
              <span className='text-label-md text-primary font-semibold flex items-center gap-1'>
                <span className='w-2 h-2 rounded-full bg-primary animate-pulse' />
                Auto-Synced
              </span>
            </div>
            <div className='flex flex-col'>
              <h1 className='font-heading text-headline-lg-m text-on-surface tracking-tight'>Weekly Smart Grocery</h1>
              <p className='text-body-sm text-on-surface-variant mt-0.5'>Computed from your family meal plan</p>
            </div>

            {/* Budget ring + total */}
            <div className='bg-surface-container-low rounded-xl p-3 flex items-center justify-between'>
              <div className='flex flex-col'>
                <span className='text-label-sm text-on-surface-variant uppercase tracking-wider'>Estimated Total</span>
                <div className='flex items-baseline gap-1.5 mt-0.5'>
                  <span className='font-heading text-headline-md text-on-surface font-semibold tracking-tight'>₹{list ? list.estimatedTotalINR : 0}</span>
                  <span className={'text-label-sm px-1.5 py-0.5 rounded-full font-semibold ' +
                    (underBudget >= 0 ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error')}>
                    {underBudget >= 0 ? `Under budget ₹${underBudget}` : `Over ₹${-underBudget}`}
                  </span>
                </div>
                <button onClick={() => setShowBudget(true)}
                  className='mt-1.5 text-label-sm text-primary font-semibold hover:underline self-start flex items-center gap-1'>
                  <Icon name='edit' size={13} /> Adjust budget / add funds
                </button>
              </div>
              <div className='relative w-12 h-12 flex items-center justify-center'>
                <svg className='w-full h-full -rotate-90' viewBox='0 0 36 36'>
                  <circle className='text-surface-container-highest stroke-current' cx='18' cy='18' fill='none' r='14' strokeWidth='3.5' />
                  <circle className={budgetPct > 90 ? 'text-error stroke-current' : 'text-primary stroke-current'}
                    cx='18' cy='18' fill='none' r='14' strokeDasharray='87.96'
                    strokeDashoffset={87.96 - (87.96 * budgetPct) / 100}
                    strokeLinecap='round' strokeWidth='3.5'
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
                </svg>
                <span className='absolute text-label-sm font-semibold text-primary'>{budgetPct}%</span>
              </div>
            </div>
          </section>

          {/* Add item search */}
          <div className='relative'>
            <div className='absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant'>
              <Icon name='add' size={18} />
            </div>
            <input value={newItem} onChange={e => setNewItem(e.target.value)}
              placeholder='Add ingredient to list…'
              className='w-full border border-outline-variant rounded-xl pl-10 pr-4 py-2.5 bg-surface-container-lowest text-body-md text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition' />
            {catalog && catalog.length > 0 && newItem.length >= 2 && (
              <div className='absolute z-10 mt-1.5 w-full bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg max-h-60 overflow-auto'>
                {catalog.slice(0, 6).map(c => (
                  <button key={c._id} onClick={() => addManual.mutate(c._id)}
                    className='w-full text-left px-4 py-2.5 text-body-md hover:bg-surface-container-low flex justify-between items-center transition-colors border-b border-surface-container last:border-0'>
                    <span className='text-on-surface font-medium'>{c.name}</span>
                    <span className='text-body-sm text-on-surface-variant'>₹{c.avgPricePerBaseUnitINR}/{c.baseUnit}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Checklist by category */}
          {Object.keys(grouped).length === 0 ? (
            <div className='bg-surface-container-lowest rounded-2xl p-8 text-center shadow-sm'>
              <Icon name='shopping_basket' size={40} className='text-surface-container-highest mx-auto' />
              <p className='mt-2 text-body-md text-on-surface-variant'>List is empty</p>
              <button onClick={() => plan.mutate()} disabled={plan.isPending}
                className='mt-3 px-5 py-2.5 rounded-full bg-primary text-on-primary text-label-lg font-semibold shadow-md active:scale-95 transition-all disabled:opacity-60'>
                Generate from meal plan
              </button>
            </div>
          ) : (
            Object.entries(grouped).map(([cat, catItems]) => {
              const meta = categoryMeta[cat] || categoryMeta.other;
              return (
                <section key={cat} className='flex flex-col gap-1'>
                  <div className='flex items-center justify-between px-1'>
                    <div className='flex items-center gap-1.5'>
                      <Icon name={meta.icon} size={18} className={meta.color} />
                      <h3 className='text-label-lg text-on-surface'>{meta.label}</h3>
                    </div>
                    <span className='text-label-sm text-on-surface-variant'>{catItems.length} items</span>
                  </div>
                  <div className='flex flex-col gap-2'>
                    {catItems.map(item => (
                      <label key={item._id}
                        className={'flex items-start gap-3 p-3 rounded-xl shadow-sm transition-all cursor-pointer select-none ' +
                          (item.checked ? 'bg-surface-container-low opacity-60' : 'bg-surface-container-lowest hover:shadow-md')}>
                        <input type='checkbox' checked={item.checked}
                          onChange={() => toggle.mutate({ id: item._id, checked: !item.checked })}
                          className='mt-1 w-5 h-5 rounded accent-primary cursor-pointer' />
                        <div className='flex flex-col flex-1 min-w-0'>
                          <div className='flex items-center justify-between'>
                            <span className={'text-label-lg text-on-surface ' + (item.checked ? 'line-through' : '')}>
                              {item.ingredientId ? item.ingredientId.name : item.name}
                            </span>
                            <span className={'text-label-md text-on-surface font-semibold ' + (item.checked ? 'line-through text-on-surface-variant' : '')}>
                              ₹{item.estPriceINR}
                            </span>
                          </div>
                          <span className='text-body-sm text-on-surface-variant'>{item.qty} {item.unit}</span>
                          {item.unlocksCount > 0 && (
                            <div className='flex items-center gap-1.5 mt-1'>
                              <span className='px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-label-sm font-semibold flex items-center gap-0.5'>
                                <Icon name='star' size={12} /> Unlocks {item.unlocksCount} meals
                              </span>
                            </div>
                          )}
                          {item.reasons && item.reasons.length > 0 && !item.checked && (
                            <span className='text-body-sm text-on-surface-variant mt-0.5'>{item.reasons[0]}</span>
                          )}
                          {item.checked && (
                            <div className='flex items-center gap-1 mt-1 text-primary'>
                              <Icon name='check_circle' size={14} />
                              <span className='text-body-sm font-medium'>In your basket</span>
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </section>
              );
            })
          )}

          {/* Mobile action buttons */}
          <section className='sticky bottom-20 lg:hidden z-40 flex flex-col gap-2 pt-2'>
            <button onClick={() => complete.mutate()} disabled={complete.isPending || checkedCount === 0}
              className='w-full py-3.5 px-4 rounded-full bg-primary text-on-primary text-label-lg flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50'>
              <Icon name='inventory' size={20} />
              <span>
                {complete.isPending
                  ? 'Transferring…'
                  : checkedCount === 0
                    ? 'Check items to transfer to pantry'
                    : `Complete Shopping (Move ${checkedCount} item${checkedCount > 1 ? 's' : ''} to Pantry)`}
              </span>
              <Icon name='arrow_forward' size={18} />
            </button>
            <button onClick={() => plan.mutate()} disabled={plan.isPending}
              className='w-full py-2.5 px-4 rounded-full bg-surface-container-high text-on-surface text-label-md flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-transform disabled:opacity-60'>
              <Icon name='calendar_today' size={18} className='text-secondary' />
              <span>{plan.isPending ? 'Planning…' : 'Plan my groceries for next week'}</span>
            </button>
          </section>
        </div>

        {/* Right rail (4) — subtotals + insights + actions */}
        <div className='lg:col-span-5 xl:col-span-4 flex flex-col gap-4 mt-4 lg:mt-0'>
          {/* Category subtotals */}
          {categoryTotals.length > 0 && (
            <section className='bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3'>
              <div className='flex items-center gap-2'>
                <div className='w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary'>
                  <Icon name='donut_small' size={20} />
                </div>
                <h3 className='text-label-lg text-on-surface font-semibold'>Category Subtotals</h3>
              </div>
              <div className='flex flex-col gap-1'>
                {categoryTotals.map(ct => (
                  <div key={ct.cat} className='flex items-center justify-between px-2 py-2 rounded-lg hover:bg-surface-container-low transition-colors'>
                    <div className='flex items-center gap-2.5 min-w-0'>
                      <Icon name={ct.icon} size={16} className={ct.color + ' shrink-0'} />
                      <span className='text-body-sm text-on-surface truncate'>{ct.label}</span>
                      <span className='text-label-sm text-on-surface-variant shrink-0'>({ct.count})</span>
                    </div>
                    <span className='text-label-md text-on-surface font-semibold shrink-0'>₹{ct.subtotal}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Smart insights */}
          <section className='bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3'>
            <div className='flex items-center gap-2'>
              <div className='w-9 h-9 rounded-lg bg-tertiary-fixed/40 flex items-center justify-center text-tertiary'>
                <Icon name='lightbulb' size={20} />
              </div>
              <h3 className='text-label-lg text-on-surface font-semibold'>Smart Insights</h3>
            </div>
            <div className='flex flex-col gap-2.5'>
              <div className='flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-low'>
                <Icon name='savings' size={18} className='text-primary shrink-0 mt-0.5' />
                <div className='flex flex-col'>
                  <span className='text-label-md text-on-surface font-semibold'>
                    {underBudget >= 0 ? `₹${underBudget} under budget` : `₹${-underBudget} over budget`}
                  </span>
                  <span className='text-body-sm text-on-surface-variant'>
                    {underBudget >= 0 ? 'Great pacing — keep it up this week' : 'Trim a category to get back on track'}
                  </span>
                </div>
              </div>
              <div className='flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-low'>
                <Icon name='bolt' size={18} className='text-tertiary shrink-0 mt-0.5' />
                <div className='flex flex-col'>
                  <span className='text-label-md text-on-surface font-semibold'>Swap onion for leeks</span>
                  <span className='text-body-sm text-on-surface-variant'>Saves ₹32 — same base for your curries</span>
                </div>
              </div>
              <div className='flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-low'>
                <Icon name='inventory' size={18} className='text-secondary shrink-0 mt-0.5' />
                <div className='flex flex-col'>
                  <span className='text-label-md text-on-surface font-semibold'>{checkedCount}/{items.length} in your basket</span>
                  <span className='text-body-sm text-on-surface-variant'>
                    {checkedCount === items.length ? 'All items collected — transfer to pantry!' : 'Check items as you shop for auto-sync'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Desktop action buttons */}
          <section className='hidden lg:flex flex-col gap-2'>
            <button onClick={() => complete.mutate()} disabled={complete.isPending || checkedCount === 0}
              className='w-full py-3.5 px-4 rounded-full bg-primary text-on-primary text-label-lg flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50'>
              <Icon name='inventory' size={20} />
              <span>
                {complete.isPending
                  ? 'Transferring…'
                  : checkedCount === 0
                    ? 'Check items to transfer to pantry'
                    : `Complete Shopping (${checkedCount} item${checkedCount > 1 ? 's' : ''} → Pantry)`}
              </span>
              <Icon name='arrow_forward' size={18} />
            </button>
            <button onClick={() => plan.mutate()} disabled={plan.isPending}
              className='w-full py-2.5 px-4 rounded-full bg-surface-container-high text-on-surface text-label-md flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-transform disabled:opacity-60'>
              <Icon name='calendar_today' size={18} className='text-secondary' />
              <span>{plan.isPending ? 'Planning…' : 'Plan my groceries for next week'}</span>
            </button>
          </section>
        </div>
      </div>

      {/* Toast */}
      {showToast && (
        <div className='fixed bottom-28 lg:bottom-8 left-4 right-4 lg:left-auto lg:right-8 lg:w-96 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-3 rounded-xl shadow-xl flex items-center justify-between transition-all duration-300 fade-up'>
          <div className='flex items-center gap-2'>
            <Icon name='check_circle' size={20} className='text-primary-fixed' />
            <span className='text-body-sm'>{showToast}</span>
          </div>
          <button onClick={() => setShowToast('')} className='text-label-sm text-primary-fixed font-semibold uppercase tracking-wider ml-2'>Dismiss</button>
        </div>
      )}

      {/* Budget dialog */}
      {showBudget && list && (
        <BudgetDialog currentBudget={list.budgetINR} onClose={(msg) => { setShowBudget(false); if (msg) flashToast(msg); }} />
      )}
    </div>
  );
}
