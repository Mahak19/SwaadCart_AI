import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/auth.js';
import Icon from '../components/Icon.jsx';

export default function Login() {
  const { login, notice, clearNotice } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('demo@swaadcart.ai');
  const [password, setPassword] = useState('Demo@1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true); setError(''); clearNotice();
    try {
      await login(email, password);
      navigate('/app');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className='min-h-screen bg-background grid place-items-center p-4'>
      <form onSubmit={onSubmit} className='bg-surface-container-lowest rounded-2xl p-8 w-full max-w-sm shadow-md'>
        <div className='flex items-center gap-2 mb-1'>
          <div className='w-10 h-10 rounded-xl bg-primary grid place-items-center'>
            <Icon name='restaurant' size={22} className='text-white' />
          </div>
          <div>
            <h1 className='font-heading text-headline-md text-on-surface font-bold'>SwaadCart</h1>
            <span className='px-1.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-label-sm uppercase tracking-wider font-bold'>AI</span>
          </div>
        </div>
        <p className='text-body-md text-on-surface-variant mt-2 mb-5'>Sign in to your kitchen</p>
        {notice && !error && <p className='text-body-md text-on-surface bg-secondary-container/60 rounded-lg px-3 py-2 mb-3'>{notice}</p>}
        {error && <p className='text-body-md text-error bg-error-container rounded-lg px-3 py-2 mb-3'>{error}</p>}
        <label className='block text-body-sm text-on-surface-variant mb-1'>Email
          <input value={email} onChange={e => setEmail(e.target.value)} type='email' required
            className='mt-1 w-full border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none' />
        </label>
        <label className='block text-body-sm text-on-surface-variant mt-3 mb-1'>Password
          <input value={password} onChange={e => setPassword(e.target.value)} type='password' required
            className='mt-1 w-full border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface bg-surface-container-lowest focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none' />
        </label>
        <button disabled={busy} className='mt-5 w-full bg-primary text-on-primary rounded-xl py-3 text-label-lg font-semibold disabled:opacity-60 active:scale-[0.98] transition-all shadow-md'>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className='mt-4 text-body-sm text-on-surface-variant text-center'>
          Demo: demo@swaadcart.ai / Demo@1234
        </p>
        <p className='mt-2 text-body-sm text-center'>
          <Link to='/' className='text-primary underline'>Back to home</Link>
        </p>
      </form>
    </div>
  );
}
