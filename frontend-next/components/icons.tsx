// Decorative inline SVGs (no external assets).
export function CatMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="24" fill="#2d5a3f" />
      <path d="M12 20 L14 9 L21 15 Q24 14 27 15 L34 9 L36 20 Q38 32 24 37 Q10 32 12 20 Z" fill="#faf6ec" />
      <circle cx="19" cy="23" r="1.8" fill="#1f3d2b" />
      <circle cx="29" cy="23" r="1.8" fill="#1f3d2b" />
      <path d="M22.5 27 h3 l-1.5 2 z" fill="#b08968" />
    </svg>
  );
}

export function CatSilhouette({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M12 26 L14 8 L26 18 Q32 16.5 38 18 L50 8 L52 26 Q56 46 32 54 Q8 46 12 26 Z" opacity=".9" />
      <circle cx="24" cy="30" r="2.5" fill="#faf6ec" />
      <circle cx="40" cy="30" r="2.5" fill="#faf6ec" />
      <path d="M29.5 36 h5 l-2.5 3 z" fill="#faf6ec" />
    </svg>
  );
}
