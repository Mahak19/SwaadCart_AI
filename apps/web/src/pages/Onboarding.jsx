import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.js';
import { Leaf, Drumstick, Flower2, Flame, Droplets, MapPin, Users, Plus, Trash2, ArrowRight, ArrowLeft, Check } from 'lucide-react';

const diets = [
  { value: 'veg', label: 'Veg', sub: 'No meat, egg', icon: Leaf, color: 'text-[#1FAE7A]', border: 'border-[#1FAE7A]', bg: 'bg-[#1FAE7A]/10' },
  { value: 'sattvic', label: 'Sattvic', sub: 'No onion, garlic', icon: Leaf, color: 'text-[#0E9F6E]', border: 'border-[#0E9F6E]', bg: 'bg-[#0E9F6E]/10' },
  { value: 'vegan', label: 'Vegan', sub: 'No dairy either', icon: Flower2, color: 'text-[#0D9488]', border: 'border-[#0D9488]', bg: 'bg-[#0D9488]/10' },
  { value: 'jain', label: 'Jain', sub: 'No root veg, onion, garlic', icon: Leaf, color: 'text-[#7C3AED]', border: 'border-[#7C3AED]', bg: 'bg-[#7C3AED]/10' },
  { value: 'eggetarian', label: 'Eggetarian', sub: 'Veg + egg', icon: Drumstick, color: 'text-[#E8A23D]', border: 'border-[#E8A23D]', bg: 'bg-[#E8A23D]/10' },
  { value: 'nonveg', label: 'Non-veg', sub: 'Everything', icon: Drumstick, color: 'text-[#E1573D]', border: 'border-[#E1573D]', bg: 'bg-[#E1573D]/10' }
];

const spiceLabels = ['Bland', 'Mild', 'Medium', 'Spicy', 'Fiery'];

function Slider({ icon: Icon, label, value, onChange, labels, color }) {
  return (
    <div>
      <div className='flex items-center gap-2 text-sm font-medium text-[#14213D]'>
        <Icon size={16} className={color} /> {label}
        <span className='ml-auto text-[#6B7280]'>{labels[value - 1]}</span>
      </div>
      <input type='range' min='1' max='5' value={value} onChange={e => onChange(Number(e.target.value))}
        className={'w-full mt-2 accent-' + color.replace('text-', '')} style={{ accentColor: 'currentColor' }} />
      <div className='flex justify-between text-xs text-[#6B7280] mt-1'>
        {labels.map(l => <span key={l}>{l[0]}</span>)}
      </div>
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, loadMe } = useAuth();
  useEffect(() => {
    if (user && user.onboardingComplete) {
      navigate('/app', { replace: true });
    }
  }, [user, navigate]);
  const [step, setStep] = useState(0);
  const [diet, setDiet] = useState('veg');
  const [spice, setSpice] = useState(3);
  const [oil, setOil] = useState(3);
  const [budget, setBudget] = useState(3000);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [members, setMembers] = useState([{ name: user && user.name ? user.name.split(' ')[0] : 'Me', ageGroup: 'adult', diet: 'veg' }]);

  const save = useMutation({
    mutationFn: () => api.put('/household/onboarding', {
      city: city || 'Delhi', state: state || 'Delhi',
      weeklyBudgetINR: budget,
      spiceTarget: spice, oilTarget: oil,
      members: members.map(m => ({ ...m, spiceLevel: spice, oilLevel: oil }))
    }),
    onSuccess: async (res) => {
      if (res?.user) useAuth.getState().setUser(res.user);
      else await loadMe();
      navigate('/app', { replace: true });
    },
    onError: (err) => { if (err && /unauthorized/i.test(err.message)) navigate('/login', { replace: true }); }
  });

  const steps = ['Diet', 'Taste', 'Budget', 'Family'];
  const isLast = step === steps.length - 1;

  return (
    <div className='min-h-screen bg-[#F5F6F8] flex flex-col items-center justify-center p-4'>
      <div className='w-full max-w-lg'>
        <div className='text-center mb-6'>
          <p className='text-[#1FAE7A] font-semibold text-sm'>SwaadCart AI</p>
          <h1 className='text-2xl font-bold text-[#14213D] mt-1' style={{ fontFamily: 'Space Grotesk' }}>Set up your kitchen</h1>
        </div>

        <div className='flex items-center gap-2 mb-6'>
          {steps.map((s, i) => (
            <div key={s} className='flex-1'>
              <div className={'h-1.5 rounded-full ' + (i <= step ? 'bg-[#1FAE7A]' : 'bg-[#E7E9EE]')} />
              <p className={'text-xs mt-1.5 text-center ' + (i <= step ? 'text-[#1FAE7A] font-medium' : 'text-[#6B7280]')}>{s}</p>
            </div>
          ))}
        </div>

        <div className='bg-white border border-[#E7E9EE] rounded-2xl p-6 shadow-sm'>
          {step === 0 && (
            <div className='space-y-3'>
              <h2 className='font-semibold text-[#14213D]'>What does your family eat?</h2>
              <p className='text-sm text-[#6B7280]'>We will only suggest matching meals.</p>
              {diets.map(d => (
                <button key={d.value} onClick={() => { setDiet(d.value); setMembers(ms => ms.map((m, i) => i === 0 ? { ...m, diet: d.value } : m)); }}
                  className={'w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ' +
                    (diet === d.value ? d.border + ' ' + d.bg : 'border-[#E7E9EE] hover:border-gray-300')}>
                  <d.icon size={22} className={d.color} />
                  <div>
                    <p className='font-medium text-[#14213D]'>{d.label}</p>
                    <p className='text-xs text-[#6B7280]'>{d.sub}</p>
                  </div>
                  {diet === d.value && <Check size={18} className={'ml-auto ' + d.color} />}
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className='space-y-6'>
              <h2 className='font-semibold text-[#14213D]'>How do you like your food?</h2>
              <Slider icon={Flame} label='Spice level' value={spice} onChange={setSpice} labels={spiceLabels} color='text-[#E1573D]' />
              <Slider icon={Droplets} label='Oil level' value={oil} onChange={setOil} labels={['Light', 'Low', 'Medium', 'Rich', 'Very rich']} color='text-[#E8A23D]' />
            </div>
          )}

          {step === 2 && (
            <div className='space-y-5'>
              <h2 className='font-semibold text-[#14213D]'>Weekly grocery budget</h2>
              <div className='text-center'>
                <p className='text-4xl font-bold text-[#1FAE7A]' style={{ fontFamily: 'Space Grotesk' }}>₹{budget.toLocaleString('en-IN')}</p>
                <p className='text-sm text-[#6B7280] mt-1'>per week</p>
              </div>
              <input type='range' min='1000' max='10000' step='500' value={budget} onChange={e => setBudget(Number(e.target.value))}
                className='w-full' style={{ accentColor: '#1FAE7A' }} />
              <div className='flex justify-between text-xs text-[#6B7280]'><span>₹1,000</span><span>₹10,000</span></div>
              <div className='flex gap-2'>
                <input value={city} onChange={e => setCity(e.target.value)} placeholder='City (e.g. Delhi)'
                  className='flex-1 border border-[#E7E9EE] rounded-lg px-3 py-2 text-sm' />
                <input value={state} onChange={e => setState(e.target.value)} placeholder='State'
                  className='flex-1 border border-[#E7E9EE] rounded-lg px-3 py-2 text-sm' />
              </div>
              <p className='flex items-center gap-1.5 text-xs text-[#6B7280]'><MapPin size={12} /> Used for weather-aware meal suggestions</p>
            </div>
          )}

          {step === 3 && (
            <div className='space-y-4'>
              <h2 className='font-semibold text-[#14213D] flex items-center gap-2'><Users size={18} /> Who eats here?</h2>
              {members.map((m, i) => (
                <div key={i} className='flex items-center gap-2'>
                  <input value={m.name} onChange={e => setMembers(ms => ms.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    placeholder='Name' className='flex-1 border border-[#E7E9EE] rounded-lg px-3 py-2 text-sm' />
                  <select value={m.ageGroup} onChange={e => setMembers(ms => ms.map((x, j) => j === i ? { ...x, ageGroup: e.target.value } : x))}
                    className='border border-[#E7E9EE] rounded-lg px-2 py-2 text-sm bg-white'>
                    <option value='child'>Child</option><option value='teen'>Teen</option>
                    <option value='adult'>Adult</option><option value='senior'>Senior</option>
                  </select>
                  <select value={m.diet} onChange={e => setMembers(ms => ms.map((x, j) => j === i ? { ...x, diet: e.target.value } : x))}
                    className='border border-[#E7E9EE] rounded-lg px-2 py-2 text-sm bg-white'>
                    {diets.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                  {members.length > 1 && (
                    <button onClick={() => setMembers(ms => ms.filter((_, j) => j !== i))} className='text-[#6B7280] hover:text-[#E1573D] p-1'>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => setMembers(ms => [...ms, { name: '', ageGroup: 'adult', diet }])}
                className='flex items-center gap-1.5 text-sm text-[#1FAE7A] font-medium'>
                <Plus size={15} /> Add member
              </button>
            </div>
          )}

          {save.isError && (
            <p className='mt-4 text-sm text-[#E1573D] bg-[#FEF2F0] rounded-lg px-3 py-2'>
              {/unauthorized/i.test(save.error.message)
                ? 'Session expired — taking you back to sign in.'
                : save.error.message}
            </p>
          )}

          <div className='flex gap-3 mt-8'>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className='flex items-center gap-1 px-4 py-2.5 rounded-lg border border-[#E7E9EE] text-sm text-[#6B7280] hover:bg-[#F5F6F8]'>
                <ArrowLeft size={15} /> Back
              </button>
            )}
            <button onClick={() => { if (!isLast) setStep(s => s + 1); else save.mutate(); }}
              disabled={save.isPending}
              className='flex-1 flex items-center justify-center gap-1.5 bg-[#14213D] text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60 hover:bg-[#1a2d52] transition-colors'>
              {isLast ? (save.isPending ? 'Saving…' : 'Start cooking!') : 'Continue'} <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

