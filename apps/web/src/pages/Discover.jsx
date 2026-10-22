import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import Icon from '../components/Icon.jsx';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'regional', label: 'Regional' },
  { key: 'street', label: 'Street' },
  { key: 'festival', label: 'Festival' },
  { key: 'quick', label: 'Quick' },
  { key: 'international', label: 'International' }
];

const STATES = ['All','Punjab','Delhi','Rajasthan','Gujarat','Maharashtra','West Bengal','Kerala','Tamil Nadu','Karnataka','Andhra Pradesh','Telangana','Bihar','Uttar Pradesh','Madhya Pradesh','Assam','Odisha','Himachal Pradesh','Sikkim','Jammu & Kashmir'];

const FALLBACK = '/dishes/fallback.jpg';

export default function Discover() {
  const [mood, setMood] = useState('all');
  const [state, setState] = useState('All');
  const [tick, setTick] = useState(0);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['discover', mood, state, tick],
    queryFn: () => api.get('/discover?mood=' + mood + (state!=='All' ? '&state=' + encodeURIComponent(state) : '') + '&_=' + Date.now()),
    staleTime: 0,
    refetchOnMount: true
  });

  const dishes = data?.dishes || [];

  const refresh = () => {
    setTick(v => v + 1);
    refetch();
  };

  return (
    <div className='flex flex-col pb-6 gap-3'>
      <section className='pt-4'>
        <h1 className='font-heading text-headline-lg-m text-on-surface tracking-tight'>Discover</h1>
        <p className='text-body-md text-on-surface-variant mt-0.5'>Unique dishes from AI • YouTube • Global recipe sources</p>
      </section>

      <div className='flex flex-wrap gap-2'>
        <select value={state} onChange={e=>{setState(e.target.value); setTick(v=>v+1);}} className='border border-outline-variant rounded-xl px-3 py-2 bg-surface-container-lowest text-body-md'>
          {STATES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <button type='button' onClick={refresh} className='border border-outline-variant rounded-xl px-3 py-2 bg-surface-container-lowest text-body-md flex items-center gap-1'>
          <Icon name='refresh' size={18}/> Refresh
        </button>
      </div>

      <div className='flex gap-2 overflow-x-auto'>
        {TABS.map(t => (
          <button key={t.key} onClick={()=>{setMood(t.key); setTick(v=>v+1);}}
            className={'px-3 py-1.5 rounded-full text-label-md whitespace-nowrap ' + (mood===t.key ? 'bg-primary text-white' : 'bg-surface-container text-on-surface')}>
            {t.label}
          </button>
        ))}
      </div>

      {isFetching && <p className='text-body-sm text-on-surface-variant'>Loading dishes...</p>}

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        {dishes.map((d, idx) => (
          <div key={d.name + idx + tick} className='bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/30'>
            <div className='relative h-36'>
              <img src={d.thumbnail || FALLBACK} alt={d.name} className='w-full h-full object-cover' onError={(e)=>{e.currentTarget.src=FALLBACK;}}/>
            </div>
            <div className='p-3'>
              <h3 className='text-label-lg font-semibold text-on-surface'>{d.name}</h3>
              <p className='text-body-sm text-on-surface-variant mt-1 line-clamp-2'>{d.description}</p>
              <div className='flex flex-wrap gap-1.5 mt-2'>
                <span className='text-label-sm bg-surface-container rounded-full px-2 py-0.5'>{d.cuisine}</span>
                <span className='text-label-sm bg-surface-container rounded-full px-2 py-0.5'>{d.mood}</span>
                <span className='text-label-sm bg-surface-container rounded-full px-2 py-0.5'>{d.diet}</span>
              </div>
              {d.youtubeUrl && <a href={d.youtubeUrl} target='_blank' rel='noreferrer' className='mt-2 inline-flex items-center gap-1 text-primary text-label-md'><Icon name='play_circle' size={16}/> Watch recipe</a>}
            </div>
          </div>
        ))}
      </div>

      {dishes.length===0 && !isFetching && <p className='text-body-md text-on-surface-variant text-center py-6'>No dishes found. Try refresh.</p>}
    </div>
  );
}
