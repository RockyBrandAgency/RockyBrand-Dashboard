// Íconos reales de cada plataforma (no emoji) - pedido explícito de Mato
// (2026-08-01) al ver los emoji genéricos en Métricas > Resumen. Se
// usan en todos los paneles de cliente por default (mismo componente
// compartido, sin variación por cliente). SEO usa el logo de Google
// porque la fuente real de esos datos es Search Console.
export function FacebookIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
  );
}

export function InstagramIcon({ size = 22 }: { size?: number }) {
  const gid = 'ig-grad';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="24" x2="24" y2="0">
          <stop offset="0%" stopColor="#FEDA75" />
          <stop offset="35%" stopColor="#D62976" />
          <stop offset="70%" stopColor="#962FBF" />
          <stop offset="100%" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="23" height="23" rx="6.5" fill={`url(#${gid})`} />
      <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="4" stroke="#fff" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.1" stroke="#fff" strokeWidth="1.6" />
      <circle cx="16.6" cy="7.4" r="1.05" fill="#fff" />
    </svg>
  );
}

export function YoutubeIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="23" height="23" rx="6.5" fill="#FF0000" />
      <path fill="#fff" d="M10 8.2l6.2 3.8-6.2 3.8V8.2z" />
    </svg>
  );
}

export function TiktokIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="23" height="23" rx="6.5" fill="#000" />
      <g transform="translate(6.6,4.2)">
        <path
          fill="#25F4EE"
          transform="translate(-0.7,0.7)"
          d="M8.6 0h1.9c.12 1.35 1.03 2.42 2.5 2.7v1.98c-.9-.02-1.75-.32-2.5-.83v4.9c0 2.36-1.9 4.27-4.25 4.27S1.99 11.11 1.99 8.75c0-2.15 1.6-3.94 3.68-4.22v2.02c-1 .24-1.75 1.13-1.75 2.2 0 1.25 1.02 2.27 2.27 2.27s2.27-1.02 2.27-2.27V0z"
        />
        <path
          fill="#FE2C55"
          transform="translate(0.7,-0.7)"
          d="M8.6 0h1.9c.12 1.35 1.03 2.42 2.5 2.7v1.98c-.9-.02-1.75-.32-2.5-.83v4.9c0 2.36-1.9 4.27-4.25 4.27S1.99 11.11 1.99 8.75c0-2.15 1.6-3.94 3.68-4.22v2.02c-1 .24-1.75 1.13-1.75 2.2 0 1.25 1.02 2.27 2.27 2.27s2.27-1.02 2.27-2.27V0z"
        />
        <path
          fill="#fff"
          d="M8.6 0h1.9c.12 1.35 1.03 2.42 2.5 2.7v1.98c-.9-.02-1.75-.32-2.5-.83v4.9c0 2.36-1.9 4.27-4.25 4.27S1.99 11.11 1.99 8.75c0-2.15 1.6-3.94 3.68-4.22v2.02c-1 .24-1.75 1.13-1.75 2.2 0 1.25 1.02 2.27 2.27 2.27s2.27-1.02 2.27-2.27V0z"
        />
      </g>
    </svg>
  );
}

// SEO en este panel = datos de Search Console -> logo real de Google.
export function GoogleIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.8741 2.6836-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8591-3.0477.8591-2.344 0-4.3282-1.5831-5.0359-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z" />
      <path fill="#FBBC05" d="M3.9641 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9641 10.71z" />
      <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5814-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z" />
    </svg>
  );
}
