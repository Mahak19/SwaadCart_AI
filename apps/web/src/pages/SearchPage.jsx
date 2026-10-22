import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import Icon from '../components/Icon.jsx';
import DishThumb from '../components/DishThumb.jsx';

export default function SearchPage() {
  const [q, setQ] = useState('');
  const { data, isFetching } = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.get('/search?q=' + encodeURIComponent(q) + '&ai=0'),
    enabled: q.length >= 2,
    staleTime: 5 * 60 * 1000
  });
  const { data: aiData } = useQuery({
    queryKey: ['search-ai', q],
    queryFn: () => api.get('/search/ai?q=' + encodeURIComponent(q)),
    enabled: q.length >= 2,
    staleTime: 10 * 60 * 1000
  });

  return (
    <div className='flex flex-col pb-6 gap-3'>
      <section className='pt-4'>
        <h1 className='font-heading text-headline-lg-m text-on-surface tracking-tight'>Smart Search</h1>
        <p className='text-body-md text-on-surface-variant mt-0.5'>Local catalogue + Open Food Facts + AI answer</p>
      </section>

      <Link to='/app/discover'
        className='bg-gradient-to-r from-primary to-primary-container rounded-2xl p-4 shadow-md flex items-center justify-between gap-3 text-white block hover:shadow-lg transition-shadow'>
        <div className='flex items-center gap-3'>
          <div className='w-11 h-11 rounded-full bg-white/20 backdrop-blur-md grid place-items-center shrink-0'>
            <Icon name='explore' size={24} />
          </div>
          <div>
            <h3 className='text-label-lg font-semibold'>Discover unique dishes</h3>
            <p className='text-body-sm text-white/80'>AI picks Â· YouTube recipes Â· regional gems</p>
          </div>
        </div>
        <Icon name='chevron_right' size={24} className='shrink-0' />
      </Link>

      <div className='relative'>
        <div className='absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant'>
          <Icon name='search' size={20} />
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} autoFocus
          placeholder='Search ingredients, dishes, anythingâ€¦'
          className='w-full border border-outline-variant rounded-xl pl-10 pr-10 py-3 bg-surface-container-lowest text-body-lg placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition' />
        {isFetching && (
          <div className='absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin'>
            <Icon name='progress_activity' size={20} />
          </div>
        )}
      </div>

      {data && (
        <div className='flex flex-col gap-4'>
          {aiData === undefined && (
            <p className='text-body-sm text-on-surface-variant'>AI answer is loading...</p>
          )}
          {aiData && !aiData.ai && aiData.aiEnabled && (
            <p className='text-body-sm text-on-surface-variant'>AI answer unavailable right now.</p>
          )}
          {aiData?.ai && (
            <div className='bg-surface-container-lowest border border-primary/30 rounded-xl p-5 shadow-sm'>
              <h3 className='font-heading text-headline-sm text-on-surface flex items-center gap-2'>
                <Icon name='auto_awesome' size={18} className='text-primary' /> AI answer
              </h3>
              <p className='mt-2 text-body-md text-on-surface leading-relaxed'>{aiData.ai.answer}</p>
              {aiData.ai.suggestions?.length > 0 && (
                <div className='mt-3 flex flex-wrap gap-1.5'>
                  {aiData.ai.suggestions.map((s, i) => (
                    <span key={i} className='text-label-md bg-surface-container rounded-full px-2.5 py-1 text-on-surface-variant'>{s.name} Â· {s.qty}</span>
                  ))}
                </div>
              )}
            </div>
          )}
          {!data.aiEnabled && (
            <p className='text-body-sm text-on-surface-variant'>Tip: set OPENAI_API_KEY to enable AI answers.</p>
          )}

          <div className='bg-surface-container-lowest rounded-xl p-4 shadow-sm'>
            <h3 className='text-label-lg text-on-surface font-semibold flex items-center gap-1.5 mb-2'>
              <Icon name='restaurant' size={18} className='text-primary' /> Ingredients
            </h3>
            {data.local.ingredients.length === 0 && <p className='text-body-md text-on-surface-variant py-2'>No local matches.</p>}
            {data.local.ingredients.map(i => (
              <div key={i.name} className='flex justify-between text-body-md py-2 border-b border-surface-container last:border-0'>
                <span className='text-on-surface font-medium'>{i.name} <span className='text-on-surface-variant font-normal'>{i.nameHi}</span></span>
                <span className='text-on-surface-variant'>â‚¹{i.avgPriceINR}/{i.unit}</span>
              </div>
            ))}
          </div>

          <div className='bg-surface-container-lowest rounded-xl p-4 shadow-sm'>
            <h3 className='text-label-lg text-on-surface font-semibold flex items-center gap-1.5 mb-2'>
              <Icon name='menu_book' size={18} className='text-secondary' /> Dishes
            </h3>
            {data.local.dishes.length === 0 && <p className='text-body-md text-on-surface-variant py-2'>No local matches.</p>}
            {data.local.dishes.map(d => (
              <div key={d.name} className='flex items-center justify-between gap-3 text-body-md py-2 border-b border-surface-container last:border-0'>
                <span className='flex items-center gap-2.5 min-w-0'>
                  <DishThumb src={d.imageUrl} name={d.name} iconSize={18} className='w-9 h-9 rounded-lg shrink-0' />
                  <span className='text-on-surface font-medium truncate'>{d.name}</span>
                </span>
                <span className='text-on-surface-variant shrink-0'>{d.cuisine} Â· â‚¹{d.estimatedCostPerServingINR}</span>
              </div>
            ))}
          </div>

          <div className='bg-surface-container-lowest rounded-xl p-4 shadow-sm'>
            <h3 className='text-label-lg text-on-surface font-semibold flex items-center gap-1.5 mb-2'>
              <Icon name='public' size={18} className='text-tertiary' /> Open Food Facts
            </h3>
            {data.external.length === 0 && <p className='text-body-md text-on-surface-variant py-2'>No external results.</p>}
            {data.external.map((e, i) => (
              <div key={i} className='py-2 border-b border-surface-container last:border-0'>
                {e.url ? <a href={e.url} target='_blank' rel='noreferrer' className='text-body-md text-primary underline font-medium'>{e.name}</a>
                  : <p className='text-body-md text-on-surface font-medium'>{e.name}</p>}
                <p className='text-body-sm text-on-surface-variant'>{[e.brand, e.quantity, e.nutriScore && 'Nutri-Score ' + e.nutriScore.toUpperCase()].filter(Boolean).join(' Â· ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


