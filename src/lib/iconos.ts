import { createElement } from 'react';
import {
  Accessibility,
  ArrowLeftRight,
  Backpack,
  Banknote,
  Cake,
  Calculator,
  CalendarCheck,
  CalendarRange,
  ChartBar,
  ChartLine,
  ChartPie,
  CircleAlert,
  CircleCheck,
  Gauge,
  HandCoins,
  Hash,
  Hourglass,
  Inbox,
  Mail,
  MapPin,
  MessageCircle,
  Moon,
  Percent,
  Plane,
  Receipt,
  StickyNote,
  Sun,
  Tag,
  Ticket,
  TrendingDown,
  TrendingUp,
  User,
  UserPlus,
  Users,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

// Única fuente de íconos del panel (spec-ventas-cajas §16.3, 18-oct). Ningún
// otro archivo importa lucide-react: así un concepto no puede tener dos
// íconos (CA-U6, CA-U8). Los íconos son decorativos: la etiqueta de texto va
// siempre al lado, por eso aria-hidden explícito y sin aria-label ni title.

export type Concepto =
  | 'venta'
  | 'costo'
  | 'ganancia'
  | 'perdida'
  | 'margen'
  | 'precio-lista'
  | 'dolar'
  | 'pagado'
  | 'saldo'
  | 'reservas'
  | 'pescadores'
  | 'jornadas'
  | 'noches'
  | 'fechas'
  | 'email'
  | 'whatsapp'
  | 'vuelo'
  | 'origen'
  | 'licencia'
  | 'equipo'
  | 'experiencia'
  | 'restricciones'
  | 'movilidad'
  | 'fecha-especial'
  | 'notas'
  | 'acompanantes'
  | 'pescador'
  | 'viaje'
  | 'resumen-venta'
  | 'costos'
  | 'ids'
  | 'aviso'
  | 'grafico-barras'
  | 'grafico-dona'
  | 'grafico-tendencia';

export const ICONO_DE: Record<Concepto, LucideIcon> = {
  venta: Banknote,
  costo: HandCoins,
  ganancia: TrendingUp,
  perdida: TrendingDown,
  margen: Percent,
  'precio-lista': Tag,
  dolar: ArrowLeftRight,
  pagado: CircleCheck,
  saldo: Hourglass,
  reservas: CalendarCheck,
  pescadores: Users,
  jornadas: Sun,
  noches: Moon,
  fechas: CalendarRange,
  email: Mail,
  whatsapp: MessageCircle,
  vuelo: Plane,
  origen: Inbox,
  licencia: Ticket,
  equipo: Backpack,
  experiencia: Gauge,
  restricciones: Utensils,
  movilidad: Accessibility,
  'fecha-especial': Cake,
  notas: StickyNote,
  acompanantes: UserPlus,
  pescador: User,
  viaje: MapPin,
  'resumen-venta': Receipt,
  costos: Calculator,
  ids: Hash,
  aviso: CircleAlert,
  'grafico-barras': ChartBar,
  'grafico-dona': ChartPie,
  'grafico-tendencia': ChartLine,
};

/** Ícono de 18 × 18 fijo (atributos del SVG: sin salto al montar). El color
 *  sale de `currentColor`; el contenedor lo fija (por defecto --text-sub). */
export function Icono({ concepto, className }: { concepto: Concepto; className?: string }) {
  return createElement(ICONO_DE[concepto], {
    size: 18,
    strokeWidth: 2,
    'aria-hidden': true,
    focusable: 'false',
    'data-icono': concepto,
    className: className ? `icono ${className}` : 'icono',
  } as Record<string, unknown>);
}
