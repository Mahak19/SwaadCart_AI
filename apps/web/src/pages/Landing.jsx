import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

export default function Landing() {
  return (
    <div className='min-h-screen bg-background'>
      {/* Hero */}
      <div className='bg-gradient-to-br from-primary to-primary-container text-white'>
        <div className='max-w-3xl mx-auto px-6 py-16'>
          <div className='flex items-center gap-2 mb-6'>
            <div className='w-10 h-10 rounded-xl bg-white/20 grid place-items-center backdrop-blur'>
              <Icon name='restaurant' size={22} className='text-white' />
            </div>
            <div className='flex items-center gap-1.5'>
              <span className='font-heading text-headline-sm font-semibold'>SwaadCart</span>
              <span className='px-1.5 py-0.5 rounded-full bg-white/20 text-label-sm uppercase tracking-wider font-bold backdrop-blur'>AI</span>
            </div>
          </div>
          <h1 className='font-heading text-headline-xl font-bold leading-tight'>
            Your kitchen already has the answer.<br />
            <span className='text-primary-fixed'>MealMind finds it.</span>
          </h1>
          <p className='mt-4 text-body-lg text-white/80 max-w-xl'>
            Recommendations, grocery planning and pantry intelligence for Indian homes — built around what you actually have and actually like.
          </p>
          <Link to='/login' className='mt-8 inline-flex items-center gap-2 bg-white text-primary rounded-full px-6 py-3 text-label-lg font-semibold shadow-lg hover:shadow-xl active:scale-95 transition-all'>
            Open your kitchen
            <Icon name='arrow_forward' size={18} />
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className='max-w-3xl mx-auto px-6 py-12'>
        <div className='grid sm:grid-cols-3 gap-4'>
          {[
            { icon: 'psychology', title: 'MealMind', sub: 'Picks meals with reasons, learns from every reaction', color: 'bg-primary-fixed/20 text-primary' },
            { icon: 'shopping_basket', title: 'Smart grocery', sub: 'Plan from meals, minus what is already in your pantry', color: 'bg-secondary-container text-on-secondary-fixed' },
            { icon: 'blender', title: 'Cook with what you have', sub: 'Type ingredients in Hindi or English, get a dish', color: 'bg-tertiary-fixed text-on-tertiary-fixed' }
          ].map(({ icon, title, sub, color }) => (
            <div key={title} className='bg-surface-container-lowest rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow'>
              <div className={'w-10 h-10 rounded-xl grid place-items-center ' + color}>
                <Icon name={icon} size={22} />
              </div>
              <h3 className='mt-3 font-heading text-headline-sm text-on-surface font-semibold'>{title}</h3>
              <p className='mt-1 text-body-md text-on-surface-variant'>{sub}</p>
            </div>
          ))}
        </div>

        <div className='mt-12 text-center'>
          <Link to='/login' className='inline-flex items-center gap-2 bg-primary text-on-primary rounded-full px-8 py-3.5 text-label-lg font-semibold shadow-lg active:scale-95 transition-all'>
            Try it now — demo ready
            <Icon name='arrow_forward' size={18} />
          </Link>
          <p className='mt-3 text-body-sm text-on-surface-variant'>Login: demo@swaadcart.ai / Demo@1234</p>
        </div>
      </div>
    </div>
  );
}
