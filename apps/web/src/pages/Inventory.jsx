import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useState } from 'react';
import Icon from '../components/Icon.jsx';

function daysUntil(d) {
  return Math.round((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
}

const categoryIcons = {
  vegetable: 'eco', fruit: 'nutrition', grain: 'inventory_2', pulse: 'grain',
  protein: 'egg_alt', dairy: 'water_bottle', spice: 'restaurant', oil: 'water_drop', other: 'shopping_bag'
};

export default function Inventory() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [qty, setQty] = useState(500);
  const { data: items } = useQuery({ queryKey: ['inventory'], queryFn: () => api.get('/inventory') });
  const { data: catalog } = useQuery({
    queryKey: ['catalog', q],
    queryFn: () => api.get('/catalog/ingredients?q=' + encodeURIComponent(q)),
    enabled: q.length >= 2
  });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['stats'] }); };
  const add = useMutation({
    mutationFn: (ingredientId) => api.post('/inventory', {
      ingredientId, quantity: Number(qty), source: 'manual',
      purchasedAt: new Date(), expiresAt: new Date(Date.now() + 7 * 864e5)
    }),
    onSuccess: () => { setQ(''); invalidate(); }
  });
  const remove = useMutation({ mutationFn: (id) => api.del('/inventory/' + id), onSuccess: invalidate });

  const alerts = (items || []).filter(item => {
    const days = item.expiresAt ? daysUntil(item.expiresAt) : null;
    return days !== null && days <= 3;
  }).length;

  return (
    <div className='flex flex-col pb-6 gap-3'>
      <section className='pt-4'>
        <h1 className='font-heading text-headline-lg-m text-on-surface tracking-tight'>Pantry</h1>
        <p className='text-body-md text-on-surface-variant mt-0.5'>
          {(items || []).length} items · {alerts} need attention
        </p>
      </section>

      {/* Add to pantry */}
      <div className='bg-surface-container-lowest rounded-xl p-4 shadow-sm'>
        <p className='text-label-md text-on-surface-variant uppercase tracking-wide mb-2'>Add to pantry</p>
        <div className='flex flex-wrap items-center gap-2'>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder='Search ingredient…'
            className='flex-1 min-w-[200px] border border-outline-variant rounded-xl px-4 py-2.5 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition' />
          <div className='flex items-center gap-1.5'>
            <input type='number' value={qty} onChange={e => setQty(e.target.value)} min='1'
              className='w-20 border border-outline-variant rounded-xl px-3 py-2.5 text-body-md bg-surface-container-lowest text-center' />
            <span className='text-body-sm text-on-surface-variant'>qty</span>
          </div>
        </div>
        {catalog && catalog.length > 0 && (
          <div className='flex flex-wrap gap-1.5 mt-3'>
            {catalog.slice(0, 5).map(c => (
              <button key={c._id} onClick={() => add.mutate(c._id)}
                className='flex items-center gap-1 text-label-md border border-outline-variant bg-surface-container-lowest rounded-full px-3 py-1.5 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all'>
                <Icon name='add' size={14} /> {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {alerts > 0 && (
        <div className='flex items-center gap-2 text-body-md text-tertiary bg-tertiary-fixed/30 border border-tertiary/20 rounded-xl px-4 py-2.5'>
          <Icon name='warning' size={18} /> {alerts} items expiring soon — use them first
        </div>
      )}

      {(items || []).length === 0 ? (
        <div className='bg-surface-container-lowest rounded-xl p-10 text-center shadow-sm'>
          <Icon name='kitchen' size={40} className='text-surface-container-highest mx-auto' />
          <p className='mt-2 text-body-md text-on-surface-variant'>Pantry is empty — add ingredients above</p>
        </div>
      ) : (
        <div className='grid sm:grid-cols-2 gap-3'>
          {(items || []).map(item => {
            const ing = item.ingredientId;
            const days = item.expiresAt ? daysUntil(item.expiresAt) : null;
            const expired = days !== null && days < 0;
            const soon = days !== null && days >= 0 && days <= 3;
            const cat = ing && ing.category ? ing.category : 'other';
            return (
              <div key={item._id} className='bg-surface-container-lowest rounded-xl p-4 flex items-start justify-between hover:shadow-md transition-shadow group'>
                <div className='flex items-start gap-3'>
                  <div className='w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center shrink-0'>
                    <Icon name={categoryIcons[cat] || 'shopping_bag'} size={20} className='text-primary' />
                  </div>
                  <div>
                    <p className='text-label-lg text-on-surface font-semibold'>{ing ? ing.name : 'Item'}</p>
                    <p className='text-body-sm text-on-surface-variant'>{item.quantity} {ing ? ing.baseUnit : ''}</p>
                    {days !== null && (
                      <span className={'inline-block text-label-sm mt-1.5 px-2 py-0.5 rounded-full font-bold ' +
                        (expired ? 'bg-error-container text-on-error-container' : soon ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-primary-fixed text-on-primary-fixed')}>
                        {expired ? `expired ${-days}d ago` : `${days}d left`}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => remove.mutate(item._id)}
                  className='text-on-surface-variant opacity-0 group-hover:opacity-100 hover:text-error transition-all p-1'>
                  <Icon name='delete' size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
