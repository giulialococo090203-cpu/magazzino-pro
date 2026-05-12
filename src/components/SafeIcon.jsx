const icons = {
  dashboard: (
    <>
      <path d="M4 13h7V4H4v9Z" />
      <path d="M4 20h7v-5H4v5Z" />
      <path d="M13 20h7v-9h-7v9Z" />
      <path d="M13 4v5h7V4h-7Z" />
    </>
  ),

  bell: (
    <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Zm-4 4h-4" />
  ),

  download: (
    <path d="M12 3v10m0 0 4-4m-4 4-4-4M5 19h14" />
  ),

  upload: (
    <path d="M12 21V11m0 0 4 4m-4-4-4 4M5 5h14" />
  ),

  chart: (
    <path d="M5 19V9m7 10V5m7 14v-7" />
  ),

  inventory: (
    <>
      <path d="M4 7h16" />
      <path d="M6 7v13h12V7" />
      <path d="M9 11h6" />
    </>
  ),

  receipt: (
    <>
      <path d="M7 3h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </>
  ),

  check: (
    <>
      <path d="M9 11l2 2 4-5" />
      <path d="M5 4h14v16H5z" />
    </>
  ),

  settings: (
    <>
      <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-2 .3 1.7 1.7 0 0 0-.5 1.4H9a1.7 1.7 0 0 0-.5-1.4 1.7 1.7 0 0 0-2-.3l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.2-1.1H3v-4h.4a1.7 1.7 0 0 0 1.2-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 2-.3A1.7 1.7 0 0 0 9 2h6a1.7 1.7 0 0 0 .5 1.4 1.7 1.7 0 0 0 2 .3l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.2 1.1h.4v4h-.4A1.7 1.7 0 0 0 19.4 15Z" />
    </>
  ),

  users: (
    <>
      <path d="M16 11a4 4 0 1 0-8 0" />
      <path d="M4 21a8 8 0 0 1 16 0" />
      <path d="M17 7a3 3 0 0 1 3 3" />
      <path d="M21 21a6 6 0 0 0-4-5.6" />
    </>
  ),

  folder: (
    <path d="M3 6h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
  ),

  euro: (
    <>
      <path d="M17 6a7 7 0 1 0 0 12" />
      <path d="M6 10h9" />
      <path d="M6 14h8" />
    </>
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
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[name] || icons.dashboard}
    </svg>
  );
}
