import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client.js';
import Icon from '../components/Icon.jsx';

const suggestions = ['aloo, pyaz, tamatar', 'paneer, palak', 'chawal, dal, ghee', 'bread, egg, cheese'];

const sourceMeta = {
  ai: { icon: 'auto_awesome', label: 'AI Chef', className: 'bg-secondary-fixed text-secondary border-secondary/40' },
  catalog: { icon: 'restaurant_menu', label: 'Recipe bank', className: 'bg-primary-fixed/30 text-on-primary-fixed-variant border-primary/40' }
};

export default function Cook() {
  const [input, setInput] = useState('');
  const [pick, setPick] = useState(0);
  const cook = useMutation({
    mutationFn: (ingredients) => api.post('/cook', { ingredients }),
    onSuccess: () => setPick(0)
  });
  const result = cook.data;
  const options = result?.options || [];
  const active = options[pick] || result?.generated;

  return (
    <div className='flex flex-col pb-6 gap-3 max-w-2xl'>
      <section className='pt-4'>
        <h1 className='font-heading text-headline-lg-m text-on-surface tracking-tight'>Cook with what I have</h1>
        <p className='text-body-md text-on-surface-variant mt-0.5'>List ingredients in Hindi or English — MealMind will suggest a dish</p>
      </section>

      <div className='bg-surface-container-lowest rounded-xl p-4 shadow-sm'>
        <div className='flex gap-2'>
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder='e.g. aloo, pyaz, tamatar, paneer'
            className='flex-1 border border-outline-variant rounded-xl px-4 py-2.5 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition'
            onKeyDown={e => e.key === 'Enter' && input.trim() && cook.mutate(input)} />
          <button onClick={() => input.trim() && cook.mutate(input)} disabled={cook.isPending || !input.trim()}
            className='flex items-center gap-2 bg-primary text-on-primary rounded-xl px-5 py-2.5 text-label-lg font-semibold disabled:opacity-50 active:scale-95 transition-all shadow-sm'>
            <Icon name={cook.isPending ? 'progress_activity' : 'blender'} size={18} className={cook.isPending ? 'animate-spin' : ''} />
            {cook.isPending ? 'Cooking…' : 'Cook'}
          </button>
        </div>
        <div className='flex flex-wrap gap-1.5 mt-3'>
          {suggestions.map(s => (
            <button key={s} onClick={() => setInput(s)}
              className='text-label-md bg-surface-container text-on-surface-variant rounded-full px-3 py-1.5 hover:bg-primary-fixed hover:text-on-primary-fixed transition-all'>
              {s}
            </button>
          ))}
        </div>
      </div>

      {cook.error && (
        <p className='text-body-md text-error bg-error-container rounded-xl px-4 py-2.5'>{cook.error.message}</p>
      )}

      {result && (
        <div className='fade-up flex flex-col gap-3'>
          <div className='bg-surface-container-lowest rounded-xl p-4 shadow-sm'>
            <h3 className='text-label-lg text-on-surface flex items-center gap-2 mb-3'>
              <Icon name='check_circle' size={16} className='text-primary' /> Recognised ({result.matched.length})
            </h3>
            <div className='flex flex-wrap gap-1.5'>
              {result.matched.map(m => (
                <span key={m.id} className='text-label-md bg-primary-fixed/20 text-on-primary-fixed-variant border border-primary/30 rounded-full px-3 py-1 font-semibold'>
                  {m.name}
                </span>
              ))}
              {(result.unmatched || []).map(u => (
                <span key={u} className='text-label-md bg-surface-container text-on-surface-variant border border-outline-variant rounded-full px-3 py-1 flex items-center gap-1'>
                  <Icon name='help' size={12} /> {u}
                </span>
              ))}
            </div>
          </div>

          {active ? (
            <div className='flex flex-col gap-3'>
              {options.length > 1 && (
                <div className='flex flex-col gap-1.5'>
                  <p className='text-label-sm text-on-surface-variant uppercase tracking-wide font-semibold'>
                    {options.length} recipes from real sources
                  </p>
                  <div className='flex flex-wrap gap-1.5'>
                    {options.map((o, i) => (
                      <button key={o.name + i} onClick={() => setPick(i)}
                        className={'flex items-center gap-1.5 text-label-md rounded-full px-3 py-1.5 border transition-all ' +
                          (i === pick
                            ? 'bg-primary text-on-primary border-primary font-semibold shadow-sm'
                            : 'bg-surface-container text-on-surface-variant border-outline-variant hover:bg-primary-fixed')}>
                        <Icon name={sourceMeta[o.source]?.icon || 'restaurant_menu'} size={14} />
                        {o.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className='bg-surface-container-lowest rounded-xl p-5 shadow-md border border-primary/20'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <span className={'flex items-center gap-1.5 text-label-sm font-bold uppercase tracking-wide border rounded-full px-2.5 py-1 ' +
                    (sourceMeta[active.source]?.className || sourceMeta.catalog.className)}>
                    <Icon name={sourceMeta[active.source]?.icon || 'restaurant_menu'} size={14} />
                    {active.sourceLabel || sourceMeta[active.source]?.label || 'Recipe'}
                  </span>
                  {active.youtubeUrl && (
                    <a href={active.youtubeUrl} target='_blank' rel='noreferrer'
                      className='flex items-center gap-1.5 text-label-md font-semibold text-error hover:underline'>
                      <Icon name='play_circle' size={16} /> Watch on YouTube
                    </a>
                  )}
                </div>

                <h3 className='mt-2 font-heading text-headline-md text-on-surface'>{active.name}</h3>
                <p className='text-body-sm text-on-surface-variant mt-0.5'>
                  {active.diet}
                  {active.cuisine ? ' · ' + active.cuisine : ''}
                  {active.prepMinutes ? ' · ' + active.prepMinutes + ' min' : ''}
                  {active.estimatedCostPerServingINR ? ' · ~₹' + active.estimatedCostPerServingINR + '/serving' : ''}
                  {active.caloriesApprox ? ' · ~' + active.caloriesApprox + ' kcal' : ''}
                </p>

                <div className='mt-3 flex flex-wrap gap-1.5'>
                  {(active.matched || []).map(name => (
                    <span key={'h' + name} className='text-label-md bg-primary-fixed/20 text-on-primary-fixed-variant border border-primary/30 rounded-full px-2.5 py-1 font-semibold flex items-center gap-1'>
                      <Icon name='check' size={12} /> {name}
                    </span>
                  ))}
                  {(active.missing || []).map(name => (
                    <span key={'m' + name} className='text-label-md bg-surface-container text-on-surface-variant border border-outline-variant rounded-full px-2.5 py-1 flex items-center gap-1'>
                      <Icon name='add_shopping_cart' size={12} /> {name}
                    </span>
                  ))}
                </div>

                {(active.ingredients || []).length > 0 && (
                  <div className='mt-4'>
                    <h4 className='text-label-lg text-on-surface flex items-center gap-1.5 mb-2'>
                      <Icon name='grocery' size={16} className='text-primary' /> Ingredients (per serving)
                    </h4>
                    <div className='flex flex-col divide-y divide-surface-container bg-surface-container-low rounded-xl overflow-hidden'>
                      {active.ingredients.map((ing, i) => (
                        <div key={ing.name + i} className='flex items-center justify-between gap-3 px-3.5 py-2'>
                          <span className={'text-body-md capitalize flex items-center gap-2 ' + (ing.have ? 'text-on-surface' : 'text-on-surface-variant')}>
                            <Icon name={ing.have ? 'check_circle' : 'radio_button_unchecked'} size={15}
                              className={ing.have ? 'text-primary' : 'text-on-surface-variant/60'} />
                            {ing.name}
                          </span>
                          <span className='text-label-md text-on-surface-variant shrink-0'>
                            {ing.qty || (ing.qtyPerServing ? '~' + ing.qtyPerServing : 'to taste')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className='mt-4'>
                  <h4 className='text-label-lg text-on-surface flex items-center gap-1.5 mb-2'>
                    <Icon name='format_list_numbered' size={16} className='text-secondary' /> Method
                  </h4>
                  <ol className='space-y-2.5'>
                    {(active.steps || []).map((s, i) => (
                      <li key={i} className='flex gap-3 text-body-md text-on-surface'>
                        <span className='w-6 h-6 rounded-full bg-primary/10 text-primary grid place-items-center text-label-sm font-bold shrink-0'>{i + 1}</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>

                <p className='mt-4 text-label-sm text-on-surface-variant flex items-center gap-1.5'>
                  <Icon name='link' size={13} /> More videos: <a href={active.youtubeUrl} target='_blank' rel='noreferrer' className='text-primary font-semibold hover:underline'>{active.name} on YouTube</a>
                </p>
              </div>
            </div>
          ) : (
            <div className='bg-surface-container-lowest rounded-xl p-5 text-center text-body-md text-on-surface-variant shadow-sm'>
              {result.hint || 'Need at least 2 recognised ingredients to generate a dish.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
