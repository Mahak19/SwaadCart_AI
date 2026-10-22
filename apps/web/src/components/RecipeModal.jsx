import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import Icon from './Icon.jsx';

export default function RecipeModal({ dishId, onClose }) {
  const [servings, setServings] = useState(2);

  const { data: dish, isLoading } = useQuery({
    queryKey: ['dish', dishId],
    queryFn: () => api.get('/catalog/dishes/' + dishId),
    enabled: Boolean(dishId)
  });

  const ingredients = dish && dish.ingredients ? dish.ingredients : [];
  const steps = dish && dish.steps ? dish.steps : [];

  return (
    <div className='fixed inset-0 z-[60] flex items-end lg:items-center justify-center' onClick={onClose}>
      <div className='absolute inset-0 bg-inverse-surface/60 backdrop-blur-sm' />
      <div onClick={e => e.stopPropagation()}
        className='relative w-full lg:max-w-xl max-h-[90vh] bg-surface rounded-t-3xl lg:rounded-3xl shadow-2xl flex flex-col overflow-hidden fade-up'>
        {/* Header */}
        <div className='relative bg-gradient-to-br from-primary to-primary-container px-5 pt-5 pb-16 shrink-0 overflow-hidden'>
          {dish && dish.imageUrl ? (
            <>
              <img src={dish.imageUrl} alt='' loading='lazy' className='absolute inset-0 w-full h-full object-cover' />
              <div className='absolute inset-0 bg-gradient-to-b from-inverse-surface/45 via-inverse-surface/60 to-inverse-surface/80' />
            </>
          ) : (
            <div className='absolute inset-0 flex items-center justify-center opacity-10'>
              <Icon name='restaurant_menu' size={120} className='text-white' />
            </div>
          )}
          <div className='relative flex items-start justify-between'>
            <span className='px-2.5 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-label-sm shadow flex items-center gap-1 backdrop-blur-md'>
              <Icon name='menu_book' size={14} />
              Preparation Guide
            </span>
            <button onClick={onClose}
              className='w-8 h-8 rounded-full bg-white/20 backdrop-blur-md grid place-items-center text-white hover:bg-white/30 transition-colors'>
              <Icon name='close' size={18} />
            </button>
          </div>
          <h2 className='relative font-heading text-headline-lg-m text-white font-semibold leading-tight mt-3'>
            {isLoading ? 'Loading…' : dish ? dish.name : 'Not found'}
          </h2>
          {dish && (
            <p className='relative text-body-sm text-white/80 mt-1 capitalize'>
              {dish.cuisine} · {dish.diet} · {dish.weight || 'medium'} meal
            </p>
          )}
        </div>

        {isLoading ? (
          <div className='p-6 flex flex-col gap-3'>
            <div className='h-6 w-1/2 rounded bg-surface-container animate-pulse' />
            <div className='h-24 rounded-xl bg-surface-container animate-pulse' />
            <div className='h-24 rounded-xl bg-surface-container animate-pulse' />
          </div>
        ) : !dish ? (
          <div className='p-8 text-center text-body-md text-on-surface-variant'>
            Could not load this recipe.
          </div>
        ) : (
          <>
            {/* Meta chips */}
            <div className='px-5 -mt-12 relative flex flex-wrap gap-2'>
              <span className='flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-lowest shadow-md text-label-sm text-on-surface'>
                <Icon name='schedule' size={15} className='text-secondary' /> {dish.prepMinutes || 25} min
              </span>
              <span className='flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-lowest shadow-md text-label-sm text-on-surface'>
                <Icon name='local_fire_department' size={15} className='text-error' /> {dish.caloriesApprox || '—'} kcal
              </span>
              <span className='flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-lowest shadow-md text-label-sm text-on-surface'>
                <Icon name='payments' size={15} className='text-primary' /> ₹{dish.estimatedCostPerServingINR}/serving
              </span>
              <span className='flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-lowest shadow-md text-label-sm text-on-surface'>
                <Icon name='restaurant' size={15} className='text-tertiary' />{'🌶'.repeat(dish.spice || 1)}
              </span>
              <span className='flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-lowest shadow-md text-label-sm text-on-surface'>
                <Icon name='water_drop' size={15} className='text-secondary' />{'🛢'.repeat(dish.oil || 2)}
              </span>
            </div>

            <div className='overflow-y-auto px-5 py-5 flex flex-col gap-5'>
              {/* Ingredients */}
              <section className='flex flex-col gap-2.5'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <Icon name='grocery' size={20} className='text-primary' />
                    <h3 className='text-label-lg text-on-surface font-semibold'>Ingredients</h3>
                  </div>
                  <div className='flex items-center gap-2 bg-surface-container rounded-full px-1.5 py-1'>
                    <button onClick={() => setServings(s => Math.max(1, s - 1))}
                      className='w-7 h-7 rounded-full bg-surface-container-lowest grid place-items-center text-on-surface hover:bg-surface-container-high transition-colors'>
                      <Icon name='remove' size={14} />
                    </button>
                    <span className='text-label-md text-on-surface font-semibold w-14 text-center'>{servings} serving{servings > 1 ? 's' : ''}</span>
                    <button onClick={() => setServings(s => Math.min(12, s + 1))}
                      className='w-7 h-7 rounded-full bg-surface-container-lowest grid place-items-center text-on-surface hover:bg-surface-container-high transition-colors'>
                      <Icon name='add' size={14} />
                    </button>
                  </div>
                </div>
                {ingredients.length === 0 ? (
                  <p className='text-body-sm text-on-surface-variant'>Ingredient list not available for this dish.</p>
                ) : (
                  <div className='bg-surface-container-lowest rounded-xl shadow-sm divide-y divide-surface-container'>
                    {ingredients.map((ing, i) => {
                      const id = ing.ingredientId;
                      const qty = ing.qtyPerServing ? ing.qtyPerServing * servings : null;
                      return (
                        <div key={i} className='flex items-center justify-between px-3.5 py-2.5'>
                          <div className='flex items-center gap-2.5 min-w-0'>
                            <span className={'w-1.5 h-1.5 rounded-full shrink-0 ' + (ing.essential === false ? 'bg-outline-variant' : 'bg-primary')} />
                            <span className='text-body-md text-on-surface truncate'>
                              {id ? (id.name || id) : 'Unknown ingredient'}
                              {ing.essential === false && <span className='text-label-sm text-on-surface-variant ml-1.5'>(optional)</span>}
                            </span>
                          </div>
                          <span className='text-label-md text-on-surface-variant shrink-0 ml-2'>
                            {qty !== null ? `${qty} ${id && id.baseUnit ? id.baseUnit : ''}`.trim() : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Steps */}
              <section className='flex flex-col gap-2.5'>
                <div className='flex items-center gap-2'>
                  <Icon name='format_list_numbered' size={20} className='text-secondary' />
                  <h3 className='text-label-lg text-on-surface font-semibold'>Method</h3>
                </div>
                {steps.length === 0 ? (
                  <div className='bg-surface-container-low rounded-xl p-4 text-body-sm text-on-surface-variant flex items-center gap-2'>
                    <Icon name='info' size={16} className='text-secondary shrink-0' />
                    Preparation steps are not available for this dish yet.
                  </div>
                ) : (
                  <ol className='flex flex-col gap-2.5'>
                    {steps.map((s, i) => (
                      <li key={i} className='flex gap-3 items-start bg-surface-container-lowest rounded-xl p-3.5 shadow-sm'>
                        <span className='w-7 h-7 rounded-full bg-primary/10 text-primary grid place-items-center text-label-md font-bold shrink-0'>
                          {i + 1}
                        </span>
                        <span className='text-body-md text-on-surface leading-relaxed pt-0.5'>{s}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {/* Tips footer */}
              <div className='bg-secondary-container/40 rounded-xl p-3.5 flex items-start gap-2.5'>
                <Icon name='lightbulb' size={18} className='text-tertiary shrink-0 mt-0.5' />
                <p className='text-body-sm text-on-surface leading-relaxed'>
                  Adjust spice and oil in your <span className='font-semibold'>Taste Profile</span> — MealMind will re-rank dishes to match your household's preferences.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
