// Iconos exportados 1:1 desde el archivo real de Figma (RockyBrand Design
// System v1.0.4) — geometría exacta preservada byte a byte (viewBox y
// paths tal cual el SVG exportado), solo el color pasa a currentColor
// para que cada uso controle su propio color via CSS/prop. Ningún ícono
// se redibuja a mano.

type IconProps = { size?: number; color?: string; strokeWidth?: number };

export function TreePineIcon({ size = 18, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.9992 16.5V14.25M12.7491 10.5L14.9991 12.975C15.1018 13.0798 15.1716 13.2125 15.1997 13.3566C15.2278 13.5007 15.2129 13.6499 15.157 13.7856C15.1011 13.9214 15.0066 14.0377 14.8852 14.1203C14.7638 14.2028 14.6209 14.2479 14.4741 14.25H3.52407C3.37727 14.2479 3.23431 14.2028 3.1129 14.1203C2.9915 14.0377 2.89699 13.9214 2.84109 13.7856C2.78519 13.6499 2.77037 13.5007 2.79845 13.3566C2.82653 13.2125 2.89628 13.0798 2.99907 12.975L5.24907 10.5H5.02407C4.87727 10.4979 4.73431 10.4528 4.6129 10.3703C4.4915 10.2877 4.39699 10.1714 4.34109 10.0356C4.28519 9.89989 4.27037 9.75071 4.29845 9.60662C4.32653 9.46252 4.39628 9.32983 4.49907 9.225L6.74907 6.75H6.59907C6.44588 6.76382 6.29214 6.7302 6.1587 6.65371C6.02526 6.57722 5.91856 6.46155 5.85307 6.32238C5.78758 6.18321 5.76646 6.02727 5.79257 5.87569C5.81869 5.72411 5.89078 5.58423 5.99907 5.475L8.99907 2.25L11.9991 5.475C12.1074 5.58423 12.1794 5.72411 12.2056 5.87569C12.2317 6.02727 12.2106 6.18321 12.1451 6.32238C12.0796 6.46155 11.9729 6.57722 11.8394 6.65371C11.706 6.7302 11.5523 6.76382 11.3991 6.75H11.2491L13.4991 9.225C13.6018 9.32983 13.6716 9.46252 13.6997 9.60662C13.7278 9.75071 13.7129 9.89989 13.657 10.0356C13.6011 10.1714 13.5066 10.2877 13.3852 10.3703C13.2638 10.4528 13.1209 10.4979 12.9741 10.5H12.7491Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LayoutGridIcon({ size = 14, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.25 1.75H2.33333C2.01117 1.75 1.75 2.01117 1.75 2.33333V5.25C1.75 5.57217 2.01117 5.83333 2.33333 5.83333H5.25C5.57217 5.83333 5.83333 5.57217 5.83333 5.25V2.33333C5.83333 2.01117 5.57217 1.75 5.25 1.75Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M11.6667 1.75H8.75C8.42783 1.75 8.16667 2.01117 8.16667 2.33333V5.25C8.16667 5.57217 8.42783 5.83333 8.75 5.83333H11.6667C11.9888 5.83333 12.25 5.57217 12.25 5.25V2.33333C12.25 2.01117 11.9888 1.75 11.6667 1.75Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M11.6667 8.16667H8.75C8.42783 8.16667 8.16667 8.42783 8.16667 8.75V11.6667C8.16667 11.9888 8.42783 12.25 8.75 12.25H11.6667C11.9888 12.25 12.25 11.9888 12.25 11.6667V8.75C12.25 8.42783 11.9888 8.16667 11.6667 8.16667Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M5.25 8.16667H2.33333C2.01117 8.16667 1.75 8.42783 1.75 8.75V11.6667C1.75 11.9888 2.01117 12.25 2.33333 12.25H5.25C5.57217 12.25 5.83333 11.9888 5.83333 11.6667V8.75C5.83333 8.42783 5.57217 8.16667 5.25 8.16667Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function ChartColumnIcon({ size = 14, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.58333 9.91667V5.25M10.5 9.91667V2.91667M1.75 1.75V11.0833C1.75 11.3928 1.87292 11.6895 2.09171 11.9083C2.3105 12.1271 2.60725 12.25 2.91667 12.25H12.25M4.66667 9.91667V8.16667" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

// Unico icono de este archivo que NO sale del export 1:1 de Figma (ver
// nota de arriba) - Tienda se agrego 2026-08-05 y todavia no tiene un
// icono propio exportado. Lucide "shopping-bag" tal cual (mismo set que
// ya usa el resto: ChartColumnIcon/SettingsIcon/etc son ese mismo Lucide
// exportado desde Figma) - viewBox nativo 24x24 en vez de reescalar la
// curva a mano al grid 14x14 del resto, que arriesgaba distorsionar el
// trazo. Reemplazar por el real cuando el diseño lo agregue al sistema.
export function ShoppingBagIcon({ size = 14, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z M3 6h18 M16 10a4 4 0 0 1-8 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronDownIcon({ size = 12, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 4.5L6 7.5L9 4.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function SettingsIcon({ size = 14, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5.64116 2.41323C5.6733 2.0751 5.83035 1.76109 6.08164 1.53256C6.33292 1.30403 6.66037 1.1774 7.00003 1.1774C7.33969 1.1774 7.66715 1.30403 7.91843 1.53256C8.16972 1.76109 8.32677 2.0751 8.35891 2.41323C8.37823 2.63167 8.44989 2.84223 8.56782 3.0271C8.68576 3.21197 8.84649 3.36571 9.03643 3.4753C9.22637 3.58489 9.43991 3.6471 9.65898 3.65668C9.87806 3.66626 10.0962 3.62291 10.295 3.53032C10.6036 3.39019 10.9534 3.36991 11.2762 3.47343C11.5989 3.57696 11.8716 3.79687 12.0412 4.09038C12.2108 4.38389 12.2651 4.72998 12.1935 5.06132C12.122 5.39265 11.9297 5.68551 11.6542 5.8829C11.4747 6.00881 11.3282 6.17609 11.2271 6.37058C11.126 6.56508 11.0732 6.78106 11.0732 7.00028C11.0732 7.21949 11.126 7.43548 11.2271 7.62997C11.3282 7.82446 11.4747 7.99174 11.6542 8.11765C11.9297 8.31504 12.122 8.6079 12.1935 8.93924C12.2651 9.27057 12.2108 9.61667 12.0412 9.91017C11.8716 10.2037 11.5989 10.4236 11.2762 10.5271C10.9534 10.6306 10.6036 10.6104 10.295 10.4702C10.0962 10.3776 9.87806 10.3343 9.65898 10.3439C9.43991 10.3535 9.22637 10.4157 9.03643 10.5253C8.84649 10.6348 8.68576 10.7886 8.56782 10.9735C8.44989 11.1583 8.37823 11.3689 8.35891 11.5873C8.32677 11.9255 8.16972 12.2395 7.91843 12.468C7.66715 12.6965 7.33969 12.8232 7.00003 12.8232C6.66037 12.8232 6.33292 12.6965 6.08164 12.468C5.83035 12.2395 5.6733 11.9255 5.64116 11.5873C5.62188 11.3688 5.55022 11.1582 5.43225 10.9732C5.31428 10.7883 5.15348 10.6345 4.96346 10.5249C4.77345 10.4153 4.55982 10.3531 4.34066 10.3436C4.12151 10.3341 3.90329 10.3775 3.70449 10.4702C3.39584 10.6104 3.0461 10.6306 2.72333 10.5271C2.40055 10.4236 2.12784 10.2037 1.95827 9.91017C1.78871 9.61667 1.73441 9.27057 1.80595 8.93924C1.8775 8.6079 2.06976 8.31504 2.34533 8.11765C2.52477 7.99174 2.67125 7.82446 2.77238 7.62997C2.8735 7.43548 2.9263 7.21949 2.9263 7.00028C2.9263 6.78106 2.8735 6.56508 2.77238 6.37058C2.67125 6.17609 2.52477 6.00881 2.34533 5.8829C2.07015 5.68541 1.87822 5.39266 1.80685 5.06156C1.73548 4.73045 1.78976 4.38463 1.95915 4.09132C2.12854 3.798 2.40093 3.57814 2.72338 3.47446C3.04583 3.37078 3.39532 3.39069 3.70391 3.53032C3.90268 3.62291 4.12084 3.66626 4.33992 3.65668C4.55899 3.6471 4.77254 3.58489 4.96247 3.4753C5.15241 3.36571 5.31315 3.21197 5.43108 3.0271C5.54902 2.84223 5.62067 2.63167 5.63999 2.41323M8.74957 7.00048C8.74957 7.96698 7.96606 8.75048 6.99957 8.75048C6.03307 8.75048 5.24957 7.96698 5.24957 7.00048C5.24957 6.03398 6.03307 5.25048 6.99957 5.25048C7.96606 5.25048 8.74957 6.03398 8.74957 7.00048Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EyeOffIcon({ size = 14, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.26118 2.96096C7.61997 2.79901 8.99442 3.08628 10.1746 3.77888C11.3549 4.47149 12.276 5.53137 12.7973 6.79668C12.846 6.92766 12.846 7.07174 12.7973 7.20271C12.583 7.7225 12.2997 8.21109 11.955 8.65533M8.21575 8.25894C7.8857 8.57775 7.44365 8.75415 6.98482 8.75016C6.52598 8.74617 6.08706 8.56211 5.7626 8.23762C5.43814 7.91313 5.2541 7.47418 5.25011 7.0153C5.24613 6.55641 5.42251 6.11433 5.74128 5.78425M10.1958 10.2079C9.42199 10.6663 8.55866 10.9529 7.66436 11.0482C6.77007 11.1435 5.86573 11.0453 5.01273 10.7603C4.15972 10.4752 3.37799 10.0101 2.7206 9.39626C2.0632 8.78246 1.54551 8.03442 1.20266 7.20289C1.15405 7.07192 1.15405 6.92784 1.20266 6.79686C1.71986 5.54251 2.62987 4.48974 3.79612 3.79654M1.16677 1.1662L12.8333 12.8338"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SearchIcon({ size = 14, color = 'currentColor', strokeWidth = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M87.5006 87.5006L69.4173 69.4173M79.1667 45.8333C79.1667 64.2428 64.2428 79.1667 45.8333 79.1667C27.4238 79.1667 12.5 64.2428 12.5 45.8333C12.5 27.4238 27.4238 12.5 45.8333 12.5C64.2428 12.5 79.1667 27.4238 79.1667 45.8333Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlusIcon({ size = 14, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 6H12M6 0V12" stroke={color} strokeWidth={strokeWidth} />
    </svg>
  );
}

export function HomeIcon({ size = 20, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12.5 17.4993V10.8327C12.5 10.6117 12.4122 10.3997 12.2559 10.2434C12.0996 10.0871 11.8877 9.99933 11.6667 9.99933H8.33333C8.11232 9.99933 7.90036 10.0871 7.74408 10.2434C7.5878 10.3997 7.5 10.6117 7.5 10.8327V17.4993M2.5 8.33307C2.49994 8.09062 2.55278 7.85109 2.65482 7.63116C2.75687 7.41124 2.90566 7.21623 3.09083 7.05973L8.92417 2.05973C9.22499 1.80549 9.60613 1.666 10 1.666C10.3939 1.666 10.775 1.80549 11.0758 2.05973L16.9092 7.05973C17.0943 7.21623 17.2431 7.41124 17.3452 7.63116C17.4472 7.85109 17.5001 8.09062 17.5 8.33307V15.8331C17.5 16.2751 17.3244 16.699 17.0118 17.0116C16.6993 17.3241 16.2754 17.4997 15.8333 17.4997H4.16667C3.72464 17.4997 3.30072 17.3241 2.98816 17.0116C2.67559 16.699 2.5 16.2751 2.5 15.8331V8.33307Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BellIcon({ size = 20, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.55563 17.5007C8.70192 17.754 8.91231 17.9644 9.16568 18.1107C9.41904 18.257 9.70644 18.334 9.99899 18.334C10.2915 18.334 10.5789 18.257 10.8323 18.1107C11.0857 17.9644 11.2961 17.754 11.4424 17.5007M2.71773 12.7719C2.60886 12.8913 2.53702 13.0397 2.51094 13.1991C2.48485 13.3585 2.50566 13.522 2.57081 13.6698C2.63597 13.8176 2.74268 13.9433 2.87795 14.0316C3.01322 14.1199 3.17122 14.1669 3.33274 14.1671H16.6664C16.8279 14.1671 16.9859 14.1202 17.1212 14.0321C17.2566 13.944 17.3634 13.8185 17.4288 13.6708C17.4941 13.5231 17.5151 13.3596 17.4892 13.2001C17.4634 13.0407 17.3917 12.8922 17.283 12.7728C16.1747 11.6302 14.9996 10.4159 14.9996 6.66642C14.9996 5.34023 14.4729 4.06835 13.5352 3.13059C12.5975 2.19283 11.3257 1.666 9.99955 1.666C8.67344 1.666 7.40164 2.19283 6.46394 3.13059C5.52624 4.06835 4.99944 5.34023 4.99944 6.66642C4.99944 10.4159 3.82359 11.6302 2.71773 12.7719Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CalendarIcon({ size = 14, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11 6.33398V12.001C11 12.1851 10.8509 12.3338 10.667 12.334H1.33301C1.14914 12.3338 1.00001 12.1851 1 12.001V6.33398H11ZM1.33301 2.33301H2.33301V2.66699H4.33301V2.33301H7.66699V2.66699H9.66699V2.33301H10.667C10.8509 2.33318 11 2.48287 11 2.66699V4.33398H1V2.66699C1 2.48287 1.14914 2.33318 1.33301 2.33301Z"
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

export function DownloadIcon({ size = 14, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 8.75V1.75M9.91667 5.83333L7 8.75L4.08333 5.83333M12.25 8.75V11.0833C12.25 11.3928 12.1271 11.6895 11.9083 11.9083C11.6895 12.1271 11.3928 12.25 11.0833 12.25H2.91667C2.60725 12.25 2.3105 12.1271 2.09171 11.9083C1.87292 11.6895 1.75 11.3928 1.75 11.0833V8.75" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Los 5 iconos que siguen son exclusivos de los "illustrated-empty-state"
// (frames 29-33 de Figma) - paths exportados 1:1 desde los assets reales
// del MCP de Figma (viewBox 0 36 36 original), no redibujados a mano.
export function LinkIcon({ size = 18, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.0002 19.4999C15.6444 20.3611 16.4663 21.0737 17.4101 21.5893C18.3539 22.105 19.3975 22.4116 20.4702 22.4884C21.5429 22.5653 22.6196 22.4105 23.6273 22.0346C24.6349 21.6587 25.5499 21.0705 26.3102 20.3099L30.8102 15.8099C32.1764 14.3954 32.9324 12.5009 32.9153 10.5344C32.8982 8.56795 32.1094 6.68686 30.7189 5.2963C29.3283 3.90574 27.4472 3.11697 25.4807 3.09988C23.5143 3.0828 21.6198 3.83875 20.2052 5.20494L17.6252 7.76994M21.0005 16.5003C20.3564 15.6391 19.5345 14.9266 18.5907 14.4109C17.6469 13.8953 16.6033 13.5887 15.5306 13.5118C14.4578 13.435 13.3812 13.5898 12.3735 13.9657C11.3659 14.3415 10.4509 14.9297 9.69054 15.6903L5.19054 20.1903C3.82435 21.6048 3.0684 23.4994 3.08548 25.4658C3.10257 27.4323 3.89134 29.3134 5.2819 30.704C6.67246 32.0945 8.55355 32.8833 10.52 32.9004C12.4865 32.9175 14.381 32.1615 15.7955 30.7953L18.3605 28.2303" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function CalendarRangeIcon({ size = 18, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 2.9988V8.99928M4.5 14.9998H31.5M12 2.9988V8.99928M25.5 21.0002H16.5M19.5 27.0007H10.5M10.5 21.0002H10.515M25.5 27.0007H25.515M7.5 5.99904H28.5C30.1569 5.99904 31.5 7.34229 31.5 8.99928V30.001C31.5 31.6579 30.1569 33.0012 28.5 33.0012H7.5C5.84315 33.0012 4.5 31.6579 4.5 30.001V8.99928C4.5 7.34229 5.84315 5.99904 7.5 5.99904Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function LineChartIcon({ size = 18, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 4.5V28.5C4.5 29.2956 4.81607 30.0587 5.37868 30.6213C5.94129 31.1839 6.70435 31.5 7.5 31.5H31.5M28.5 13.5L21 21L15 15L10.5 19.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function MailIcon({ size = 18, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M33.0012 10.5008L19.5136 19.0904C19.0559 19.3562 18.536 19.4962 18.0068 19.4962C17.4775 19.4962 16.9576 19.3562 16.4999 19.0904L2.9988 10.5008M5.99904 6.0012H30.001C31.6579 6.0012 33.0012 7.34421 33.0012 9.0009V26.9991C33.0012 28.6558 31.6579 29.9988 30.001 29.9988H5.99904C4.34205 29.9988 2.9988 28.6558 2.9988 26.9991V9.0009C2.9988 7.34421 4.34205 6.0012 5.99904 6.0012Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function ImageIcon({ size = 18, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M31.5 22.4995L26.871 17.8705C26.3084 17.3081 25.5455 16.9922 24.75 16.9922C23.9545 16.9922 23.1916 17.3081 22.629 17.8705L9 31.4995M7.5 4.5H28.5C30.1569 4.5 31.5 5.84315 31.5 7.5V28.5C31.5 30.1569 30.1569 31.5 28.5 31.5H7.5C5.84315 31.5 4.5 30.1569 4.5 28.5V7.5C4.5 5.84315 5.84315 4.5 7.5 4.5ZM16.5 13.5C16.5 15.1569 15.1569 16.5 13.5 16.5C11.8431 16.5 10.5 15.1569 10.5 13.5C10.5 11.8431 11.8431 10.5 13.5 10.5C15.1569 10.5 16.5 11.8431 16.5 13.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

// "users" de lucide, escalado al viewBox 0 0 36 36 que usa todo este set
// (los iconos de este panel son 24x24 de lucide multiplicados x1.5).
export function UsersIcon({ size = 18, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 31.5V28.5C24 26.9087 23.3679 25.3826 22.2426 24.2574C21.1174 23.1321 19.5913 22.5 18 22.5H9C7.4087 22.5 5.88258 23.1321 4.75736 24.2574C3.63214 25.3826 3 26.9087 3 28.5V31.5M31.5 31.5V28.5C31.499 27.1708 31.0566 25.8796 30.2422 24.8292C29.4278 23.7788 28.2876 23.0284 27 22.6950M22.5 4.6950C23.7909 5.0264 24.9346 5.7771 25.7513 6.8293C26.5679 7.8815 27.0111 9.1757 27.0111 10.5075C27.0111 11.8393 26.5679 13.1335 25.7513 14.1857C24.9346 15.2379 23.7909 15.9886 22.5 16.32M19.5 10.5C19.5 13.8137 16.8137 16.5 13.5 16.5C10.1863 16.5 7.5 13.8137 7.5 10.5C7.5 7.1863 10.1863 4.5 13.5 4.5C16.8137 4.5 19.5 7.1863 19.5 10.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
