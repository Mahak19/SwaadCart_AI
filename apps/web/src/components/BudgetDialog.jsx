import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import Icon from './Icon.jsx';

const quickAmounts = [500, 1000, 2000, 5000];

export default function BudgetDialog({ currentBudget, onClose }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(currentBudget || 3000));
  const [error, setError] = useState('');

  const update = useMutation({
    mutationFn: (weeklyBudgetINR) => api.put('/budget/budget', { weeklyBudgetINR }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['grocery'] });
      if (r.budgetAdjusted) {
        setError('Budget lowered below current list total — grocery list flagged for review.');
      } else {
        onClose('Weekly budget updated to ₹' + Number(amount).toLocaleString('en-IN'));
      }
    },
    onError: (e) => setError(e.message)
  });

  const submit = () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0 || n > 100000) {
      setError('Enter an amount between ₹1 and ₹1,00,000');
      return;
    }
    setError('');
    update.mutate(n);
  };

  const addFunds = (delta) => {
    const next = Math.min(100000, (Number(amount) || 0) + delta);
    setAmount(String(next));
    setError('');
  };

  return (
    <div className='fixed inset-0 z-[60] flex items-end lg:items-center justify-center' onClick={onClose}>
      <div className='absolute inset-0 bg-inverse-surface/60 backdrop-blur-sm' />
      <div onClick={e => e.stopPropagation()}
        className='relative w-full lg:max-w-md bg-surface rounded-t-3xl lg:rounded-3xl shadow-2xl flex flex-col overflow-hidden fade-up'>
        <div className='flex items-center justify-between px-5 py-4 border-b border-surface-container'>
          <div className='flex items-center gap-2.5'>
            <div className='w-10 h-10 rounded-xl bg-primary-container/50 grid place-items-center text-primary'>
              <Icon name='account_balance_wallet' size={22} />
            </div>
            <div>
              <h2 className='font-heading text-headline-sm text-on-surface font-semibold'>Weekly Budget</h2>
              <p className='text-body-sm text-on-surface-variant'>Add funds or adjust your grocery limit</p>
            </div>
          </div>
          <button onClick={onClose}
            className='w-8 h-8 rounded-full grid place-items-center text-on-surface-variant hover:bg-surface-container transition-colors'>
            <Icon name='close' size={20} />
          </button>
        </div>

        <div className='p-5 flex flex-col gap-4'>
          {/* Amount input */}
          <div className='flex items-center gap-2 bg-surface-container-low rounded-xl px-4 py-3 border-2 border-transparent focus-within:border-primary transition-colors'>
            <span className='font-heading text-headline-md text-on-surface-variant'>₹</span>
            <input
              type='number' min='1' max='100000' value={amount}
              onChange={e => { setAmount(e.target.value); setError(''); }}
              className='flex-1 bg-transparent font-heading text-headline-md text-on-surface outline-none w-full'
            />
          </div>

          {/* Quick add funds */}
          <div className='flex flex-col gap-2'>
            <span className='text-label-md text-on-surface-variant'>Quick add funds</span>
            <div className='grid grid-cols-4 gap-2'>
              {quickAmounts.map(a => (
                <button key={a} onClick={() => addFunds(a)}
                  className='py-2 rounded-xl bg-surface-container text-on-surface text-label-md font-semibold hover:bg-primary-fixed hover:text-on-primary-fixed transition-all active:scale-95'>
                  +₹{a >= 1000 ? a / 1000 + 'k' : a}
                </button>
              ))}
            </div>
          </div>

          {/* Preset budgets */}
          <div className='flex flex-wrap gap-2'>
            {[2000, 3000, 5000, 7500].map(b => (
              <button key={b} onClick={() => { setAmount(String(b)); setError(''); }}
                className={'px-3.5 py-1.5 rounded-full text-label-md transition-all ' +
                  (Number(amount) === b
                    ? 'bg-primary text-on-primary font-semibold shadow-sm'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high')}>
                ₹{b.toLocaleString('en-IN')}
              </button>
            ))}
          </div>

          {error && (
            <div className='flex items-start gap-2 bg-error-container/60 text-on-error-container rounded-xl px-3.5 py-2.5 text-body-sm'>
              <Icon name='error' size={16} className='shrink-0 mt-0.5' />
              <span>{error}</span>
            </div>
          )}

          <button onClick={submit} disabled={update.isPending}
            className='w-full py-3 rounded-full bg-primary text-on-primary text-label-lg font-semibold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all disabled:opacity-60'>
            <Icon name={update.isPending ? 'progress_activity' : 'savings'} size={20} className={update.isPending ? 'animate-spin' : ''} />
            <span>{update.isPending ? 'Updating…' : 'Update budget'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
