const icons = {
  dashboard: (
    <path d="M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z" />
  ),
  bell: (
    <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Zm-4 4h-4a2 2 0 0 0 4 0Z" />
  ),
  download: (
    <path d="M12 3v10m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
  ),
  chart: (
    <path d="M5 19V9m7 10V5m7 14v-7" />
  ),
  inventory: (
    <path d="M4 7h16M6 7v13h12V7M9 11h6" />
  ),
  search: (
    <path d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" />
  ),
  backup: (
    <path d="M12 3v10m0 0 4-4m-4 4-4-4M5 19h14" />
  ),
};

export default function SafeIcon({ name = 'dashboard', className = '', size = 22 }) {
  return (
    <svg
      className={`safe-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={name === 'dashboard' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[name] || icons.dashboard}
    </svg>
  );
}
