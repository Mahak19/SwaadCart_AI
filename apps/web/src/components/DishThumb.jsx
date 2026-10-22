import { useState } from 'react';
import Icon from './Icon.jsx';

export default function DishThumb({ src, name, icon = 'restaurant', iconSize = 24, className = '', fallbackClassName = '' }) {
  const [failed, setFailed] = useState(false);
  const url = src || null;

  if (!url || failed) {
    return (
      <div className={'grid place-items-center bg-gradient-to-br from-primary/80 to-primary-container ' + className + ' ' + fallbackClassName}>
        <Icon name={icon} size={iconSize} className='text-white/80' />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name || ''}
      loading='lazy'
      onError={() => setFailed(true)}
      className={'object-cover bg-surface-container ' + className}
    />
  );
}
