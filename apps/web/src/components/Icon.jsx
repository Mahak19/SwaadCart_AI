export default function Icon({ name, size = 24, filled = false, className = '' }) {
  return (
    <span
      className={'material-symbols-outlined select-none ' + (filled ? 'filled ' : '') + className}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  );
}
