import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.js';
import Icon from '../components/Icon.jsx';

const spiceLabels = ['Bland', 'Mild', 'Medium', 'Spicy', 'Fiery'];
const oilLabels = ['Light', 'Low', 'Medium', 'Rich', 'Very rich'];
const diets = [
  { value: 'veg', label: 'Veg' },
  { value: 'sattvic', label: 'Sattvic (no onion/garlic)' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'jain', label: 'Jain' },
  { value: 'eggetarian', label: 'Eggetarian' },
  { value: 'nonveg', label: 'Non-veg' }
];
const ageGroups = [
  { value: 'child', label: 'Child' },
  { value: 'teen', label: 'Teen' },
  { value: 'adult', label: 'Adult' },
  { value: 'senior', label: 'Senior' }
];

const inputClass = 'w-full rounded-xl bg-surface-container-low border border-outline-variant/60 px-3 py-2.5 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary';

function Field({ label, hint, children }) {
  return (
    <label className='block'>
      <span className='block text-label-md text-on-surface-variant mb-1.5'>{label}</span>
      {children}
      {hint && <span className='block text-label-sm text-on-surface-variant mt-1'>{hint}</span>}
    </label>
  );
}

function LevelPicker({ label, icon, value, onChange, labels, tone }) {
  return (
    <div>
      <div className='flex items-center justify-between mb-2'>
        <span className='text-body-md text-on-surface-variant flex items-center gap-1.5'>
          <Icon name={icon} size={16} className={tone} /> {label}
        </span>
        <span className='text-label-md font-semibold text-on-surface'>{labels[value - 1]}</span>
      </div>
      <div className='flex gap-1.5'>
        {[1, 2, 3, 4, 5].map(i => (
          <button key={i} type='button' onClick={() => onChange(i)}
            className={'flex-1 h-9 rounded-lg text-label-md font-semibold transition-all ' +
              (i <= value
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high')}>
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}

function Card({ title, icon, children, action }) {
  return (
    <section className='bg-surface-container-lowest rounded-2xl p-5 shadow-sm'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-label-lg text-on-surface font-semibold flex items-center gap-1.5'>
          <Icon name={icon} size={18} className='text-primary' /> {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Taste() {
  const qc = useQueryClient();
  const { user, loadMe } = useAuth();
  const { data: taste } = useQuery({ queryKey: ['taste'], queryFn: () => api.get('/taste/profile') });
  const { data: household } = useQuery({ queryKey: ['household'], queryFn: () => api.get('/household') });
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!taste || !household || form) return;
    setForm({
      name: user?.name || '',
      householdName: household.name || '',
      city: (household.region && household.region.city) || '',
      state: (household.region && household.region.state) || '',
      budget: household.weeklyBudgetINR || 3000,
      spice: taste.spiceTarget || 3,
      oil: taste.oilTarget || 3,
      members: (household.members || []).map(m => ({
        name: m.name || '',
        ageGroup: m.ageGroup || 'adult',
        diet: m.diet || 'veg',
        allergies: Array.isArray(m.allergies) ? m.allergies.join(', ') : ''
      }))
    });
  }, [taste, household, user, form]);

  const update = (patch) => setForm(f => ({ ...f, ...patch }));
  const updateMember = (i, patch) => setForm(f => ({
    ...f,
    members: f.members.map((m, j) => (j === i ? { ...m, ...patch } : m))
  }));
  const addMember = () => setForm(f => ({
    ...f,
    members: [...f.members, { name: '', ageGroup: 'adult', diet: f.members[0]?.diet || 'veg', allergies: '' }]
  }));
  const removeMember = (i) => setForm(f => ({ ...f, members: f.members.filter((_, j) => j !== i) }));

  const save = useMutation({
    mutationFn: async () => {
      const members = form.members
        .filter(m => m.name.trim())
        .map(m => ({
          name: m.name.trim(),
          ageGroup: m.ageGroup,
          diet: m.diet,
          spiceLevel: form.spice,
          oilLevel: form.oil,
          allergies: m.allergies.split(',').map(a => a.trim()).filter(Boolean)
        }));
      await Promise.all([
        api.patch('/auth/me', { name: form.name.trim() }),
        api.put('/household', {
          name: form.householdName.trim() || 'My Kitchen',
          'region.city': form.city.trim(),
          'region.state': form.state.trim(),
          weeklyBudgetINR: Number(form.budget),
          members
        }),
        api.patch('/taste/profile', { spiceTarget: Number(form.spice), oilTarget: Number(form.oil) })
      ]);
    },
    onSuccess: async () => {
      setStatus({ type: 'ok', text: 'Saved. MealMind will use these preferences from now on.' });
      await loadMe();
      qc.invalidateQueries({ queryKey: ['taste'] });
      qc.invalidateQueries({ queryKey: ['household'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['grocery'] });
    },
    onError: (e) => setStatus({ type: 'err', text: e.message })
  });

  const reset = useMutation({
    mutationFn: () => api.post('/taste/reset', {}),
    onSuccess: () => {
      setForm(f => ({ ...f, spice: 3, oil: 3 }));
      setStatus({ type: 'ok', text: 'Learning reset. Feedback history cleared.' });
      qc.invalidateQueries({ queryKey: ['taste'] });
    },
    onError: (e) => setStatus({ type: 'err', text: e.message })
  });

  const valid = form && form.name.trim().length >= 2 && Number(form.budget) > 0 && Number(form.budget) <= 100000;

  if (!form) {
    return (
      <div className='flex flex-col gap-3 max-w-2xl'>
        <div className='pt-4 h-10' />
        {[1, 2, 3].map(i => <div key={i} className='bg-surface-container-lowest rounded-2xl h-40 animate-pulse shadow-sm' />)}
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-3 max-w-2xl pb-24'>
      <section className='pt-4 flex items-center justify-between'>
        <div>
          <h1 className='font-heading text-headline-lg-m text-on-surface tracking-tight'>You</h1>
          <p className='text-body-md text-on-surface-variant mt-0.5'>Your household, taste and budget — all editable</p>
        </div>
        <button onClick={() => reset.mutate()} disabled={reset.isPending}
          className='flex items-center gap-1.5 text-body-sm text-on-surface-variant hover:text-error transition-colors disabled:opacity-50'>
          <Icon name='restart_alt' size={16} /> {reset.isPending ? 'Resetting…' : 'Reset learning'}
        </button>
      </section>

      <Card title='Your account' icon='person'>
        <div className='grid sm:grid-cols-2 gap-3'>
          <Field label='Name'>
            <input value={form.name} onChange={e => update({ name: e.target.value })} placeholder='Your name' className={inputClass} />
          </Field>
          <Field label='Email'>
            <input value={user?.email || ''} disabled className={inputClass + ' opacity-70 cursor-not-allowed'} />
          </Field>
        </div>
      </Card>

      <Card title='Household' icon='home'>
        <div className='grid sm:grid-cols-2 gap-3'>
          <Field label='Household name'>
            <input value={form.householdName} onChange={e => update({ householdName: e.target.value })} placeholder='My Kitchen' className={inputClass} />
          </Field>
          <Field label='Weekly grocery budget' hint='Used for grocery planning and budget alerts'>
            <div className='relative'>
              <span className='absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-body-md'>₹</span>
              <input type='number' min='1' max='100000' value={form.budget}
                onChange={e => update({ budget: e.target.value })} className={inputClass + ' pl-7'} />
            </div>
          </Field>
          <Field label='City'>
            <input value={form.city} onChange={e => update({ city: e.target.value })} placeholder='Delhi' className={inputClass} />
          </Field>
          <Field label='State'>
            <input value={form.state} onChange={e => update({ state: e.target.value })} placeholder='Delhi' className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card title='Family members' icon='groups'
        action={
          <button onClick={addMember} className='flex items-center gap-1 text-label-md text-primary font-semibold hover:text-primary-container'>
            <Icon name='add' size={16} /> Add
          </button>
        }>
        <div className='space-y-3'>
          {form.members.length === 0 && (
            <p className='text-body-md text-on-surface-variant'>No members yet — add at least one.</p>
          )}
          {form.members.map((m, i) => (
            <div key={i} className='rounded-xl bg-surface-container-low p-3 space-y-2.5'>
              <div className='flex items-center gap-2'>
                <input value={m.name} onChange={e => updateMember(i, { name: e.target.value })}
                  placeholder='Name' className={inputClass + ' flex-1'} />
                <button onClick={() => removeMember(i)} title='Remove member'
                  className='p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/40 transition-colors'>
                  <Icon name='delete' size={18} />
                </button>
              </div>
              <div className='grid grid-cols-2 gap-2'>
                <select value={m.ageGroup} onChange={e => updateMember(i, { ageGroup: e.target.value })} className={inputClass}>
                  {ageGroups.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
                <select value={m.diet} onChange={e => updateMember(i, { diet: e.target.value })} className={inputClass}>
                  {diets.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <input value={m.allergies} onChange={e => updateMember(i, { allergies: e.target.value })}
                placeholder='Allergies (comma separated, optional)' className={inputClass} />
            </div>
          ))}
        </div>
        <p className='text-label-sm text-on-surface-variant mt-3 flex items-center gap-1'>
          <Icon name='info' size={14} /> Spice and oil levels below apply to every member.
        </p>
      </Card>

      <Card title='Taste preferences' icon='tune'>
        <div className='space-y-5'>
          <LevelPicker label='Spice preference' icon='whatshot' tone='text-error'
            value={form.spice} onChange={v => update({ spice: v })} labels={spiceLabels} />
          <LevelPicker label='Oil preference' icon='water_drop' tone='text-tertiary'
            value={form.oil} onChange={v => update({ oil: v })} labels={oilLabels} />
        </div>
      </Card>

      <Card title='What MealMind learned' icon='psychology'>
        {taste && taste.topCuisines.length > 0 ? (
          <div className='space-y-3 mb-4'>
            {taste.topCuisines.map(c => (
              <div key={c.cuisine} className='flex items-center gap-3'>
                <span className='w-28 text-body-md capitalize text-on-surface font-medium'>{c.cuisine}</span>
                <div className='flex-1 h-2.5 bg-surface-container rounded-full overflow-hidden'>
                  <div className='h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-500'
                    style={{ width: Math.min(100, Math.max(8, c.weight * 30)) + '%' }} />
                </div>
                <span className='text-body-sm text-on-surface-variant w-8 text-right'>{c.weight.toFixed(1)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className='text-center py-6'>
            <Icon name='auto_awesome' size={32} className='text-surface-container-highest mx-auto' />
            <p className='mt-2 text-body-md text-on-surface-variant'>Give meal feedback to build this</p>
          </div>
        )}
        {taste && taste.learningLog.length > 0 && (
          <div className='space-y-2.5 border-t border-surface-container pt-4'>
            {taste.learningLog.slice(0, 6).map((l, i) => (
              <div key={i} className='flex items-start gap-3 text-body-md'>
                <span className='w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0' />
                <p className='text-on-surface-variant'>{l.message}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {status && (
        <div className={'rounded-xl px-4 py-3 text-body-md flex items-center gap-2 ' +
          (status.type === 'ok' ? 'bg-primary-fixed/40 text-on-primary-fixed-variant' : 'bg-error-container text-on-error-container')}>
          <Icon name={status.type === 'ok' ? 'check_circle' : 'error'} size={18} />
          {status.text}
        </div>
      )}

      <div className='sticky bottom-20 lg:bottom-4 z-10'>
        <button onClick={() => { setStatus(null); save.mutate(); }} disabled={!valid || save.isPending}
          className='w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary py-3 text-label-lg font-semibold shadow-lg disabled:opacity-50 transition-opacity'>
          <Icon name={save.isPending ? 'hourglass_top' : 'save'} size={18} />
          {save.isPending ? 'Saving…' : 'Save changes'}
        </button>
        {!valid && (
          <p className='text-center text-label-sm text-error mt-1.5'>Name (2+ chars) and a valid budget are required.</p>
        )}
      </div>
    </div>
  );
}
