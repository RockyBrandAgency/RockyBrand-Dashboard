import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MejoresHorariosCard } from './MejoresHorariosCard';
import type { MejoresHorarios } from '../types';

// Qué afirma este archivo: que la tarjeta muestra la franja recomendada CON su
// evidencia al lado, y que cuando no hay muestra suficiente no dibuja ningún
// horario en vez de mostrar el mejor de tres publicaciones.
//
// `CFF` es la salida REAL de social_timing.recomendar_desde_snapshots sobre los
// 27 snapshots de Meta de chile-fly-fishing al 2026-09-15, copiada tal cual, no
// armada para que la prueba pase. Por eso tiene franjas vacías (00:00-06:00,
// donde la cuenta nunca publicó) y franjas bajo el mínimo (06:00-09:00 con 2 y
// 15:00-18:00 con 1): los dos casos que la vista tiene que saber dibujar.

const CFF: MejoresHorarios = {
  "hay_recomendacion": true,
  "zona_horaria": "America/Santiago",
  "publicaciones_registradas": 44,
  "publicaciones_analizadas": 28,
  "publicaciones_muy_recientes": 16,
  "minimo_requerido": 20,
  "minimo_por_franja": 4,
  "dias_madurez": 7,
  "ventana": {
    "desde": "2026-06-08",
    "hasta": "2026-09-04"
  },
  "franjas": [
    {
      "franja": "00:00-03:00",
      "desde_hora": 0,
      "publicaciones": 0,
      "alcance_mediano": null,
      "engagement_mediano_pct": null,
      "indice": null,
      "suficiente": false
    },
    {
      "franja": "03:00-06:00",
      "desde_hora": 3,
      "publicaciones": 0,
      "alcance_mediano": null,
      "engagement_mediano_pct": null,
      "indice": null,
      "suficiente": false
    },
    {
      "franja": "06:00-09:00",
      "desde_hora": 6,
      "publicaciones": 2,
      "alcance_mediano": 2136,
      "engagement_mediano_pct": 5.53,
      "indice": 1.24,
      "suficiente": false
    },
    {
      "franja": "09:00-12:00",
      "desde_hora": 9,
      "publicaciones": 7,
      "alcance_mediano": 4046,
      "engagement_mediano_pct": 4.47,
      "indice": 2.34,
      "suficiente": true
    },
    {
      "franja": "12:00-15:00",
      "desde_hora": 12,
      "publicaciones": 7,
      "alcance_mediano": 1318,
      "engagement_mediano_pct": 3.95,
      "indice": 0.76,
      "suficiente": true
    },
    {
      "franja": "15:00-18:00",
      "desde_hora": 15,
      "publicaciones": 1,
      "alcance_mediano": 326,
      "engagement_mediano_pct": 1.53,
      "indice": 0.19,
      "suficiente": false
    },
    {
      "franja": "18:00-21:00",
      "desde_hora": 18,
      "publicaciones": 4,
      "alcance_mediano": 3024,
      "engagement_mediano_pct": 5.06,
      "indice": 1.75,
      "suficiente": true
    },
    {
      "franja": "21:00-00:00",
      "desde_hora": 21,
      "publicaciones": 7,
      "alcance_mediano": 168,
      "engagement_mediano_pct": 2.17,
      "indice": 0.1,
      "suficiente": true
    }
  ],
  "mejor": {
    "franja": "09:00-12:00",
    "publicaciones": 7,
    "alcance_mediano": 4046,
    "alcance_mediano_resto": 1318,
    "diferencia_pct": 207.0
  },
  "evitar": {
    "franja": "21:00-00:00",
    "publicaciones": 7,
    "alcance_mediano": 168,
    "alcance_mediano_resto": 2237,
    "diferencia_pct": -92.5
  },
  "por_formato": {
    "REELS": {
      "hay_recomendacion": true,
      "etiqueta": "reels",
      "publicaciones": 22,
      "franjas": [
        {
          "franja": "00:00-03:00",
          "desde_hora": 0,
          "publicaciones": 0,
          "alcance_mediano": null,
          "engagement_mediano_pct": null,
          "indice": null,
          "suficiente": false
        },
        {
          "franja": "03:00-06:00",
          "desde_hora": 3,
          "publicaciones": 0,
          "alcance_mediano": null,
          "engagement_mediano_pct": null,
          "indice": null,
          "suficiente": false
        },
        {
          "franja": "06:00-09:00",
          "desde_hora": 6,
          "publicaciones": 1,
          "alcance_mediano": 802,
          "engagement_mediano_pct": 4.86,
          "indice": 0.59,
          "suficiente": false
        },
        {
          "franja": "09:00-12:00",
          "desde_hora": 9,
          "publicaciones": 5,
          "alcance_mediano": 4046,
          "engagement_mediano_pct": 4.47,
          "indice": 2.98,
          "suficiente": true
        },
        {
          "franja": "12:00-15:00",
          "desde_hora": 12,
          "publicaciones": 5,
          "alcance_mediano": 1910,
          "engagement_mediano_pct": 3.93,
          "indice": 1.41,
          "suficiente": true
        },
        {
          "franja": "15:00-18:00",
          "desde_hora": 15,
          "publicaciones": 1,
          "alcance_mediano": 326,
          "engagement_mediano_pct": 1.53,
          "indice": 0.24,
          "suficiente": false
        },
        {
          "franja": "18:00-21:00",
          "desde_hora": 18,
          "publicaciones": 3,
          "alcance_mediano": 3108,
          "engagement_mediano_pct": 4.39,
          "indice": 2.29,
          "suficiente": false
        },
        {
          "franja": "21:00-00:00",
          "desde_hora": 21,
          "publicaciones": 7,
          "alcance_mediano": 168,
          "engagement_mediano_pct": 2.17,
          "indice": 0.12,
          "suficiente": true
        }
      ],
      "mejor": {
        "franja": "09:00-12:00",
        "publicaciones": 5,
        "alcance_mediano": 4046,
        "alcance_mediano_resto": 1018,
        "diferencia_pct": 297.4
      },
      "confianza": "media",
      "titular": "Publica entre las 09:00 y las 12:00.",
      "evidencia": "A esa hora tus reels llegaron a 4.046 personas en la publicación típica. 297% más que en el resto del día (1.018 personas). Base: 5 de 22 reels con medición comparable.",
      "mensaje": "Publica entre las 09:00 y las 12:00. A esa hora tus reels llegaron a 4.046 personas en la publicación típica. 297% más que en el resto del día (1.018 personas). Base: 5 de 22 reels con medición comparable."
    },
    "FEED": {
      "hay_recomendacion": false,
      "etiqueta": "posts y carruseles",
      "publicaciones": 6,
      "mensaje": "6 posts y carruseles con medición comparable: todavía no alcanzan 4 en una misma franja para separar este formato del resto."
    }
  },
  "confianza": "alta",
  "titular": "Publica entre las 09:00 y las 12:00.",
  "evidencia": "A esa hora tus publicaciones llegaron a 4.046 personas en la publicación típica. 207% más que en el resto del día (1.318 personas). Base: 7 de 28 publicaciones con medición comparable. La franja de 21:00 a 00:00 es la que peor te rinde (7 publicaciones).",
  "mensaje": "Publica entre las 09:00 y las 12:00. A esa hora tus publicaciones llegaron a 4.046 personas en la publicación típica. 207% más que en el resto del día (1.318 personas). Base: 7 de 28 publicaciones con medición comparable. La franja de 21:00 a 00:00 es la que peor te rinde (7 publicaciones).",
  "metrica": "alcance mediano por publicación",
  "sin_dato": [
    "historias"
  ],
  "fuente": "publicaciones propias de este cliente, de los snapshots de Meta",
  "advertencia": "Es una correlación entre hora y alcance, no una causa comprobada: a esa hora también puede estar saliendo tu mejor contenido."
} as MejoresHorarios;

const SIN_MUESTRA: MejoresHorarios = {
  hay_recomendacion: false,
  zona_horaria: 'America/Santiago',
  publicaciones_registradas: 6,
  publicaciones_analizadas: 6,
  publicaciones_muy_recientes: 0,
  minimo_requerido: 20,
  dias_madurez: 7,
  sin_dato: ['historias'],
  mensaje: 'Aún no hay suficiente historial para recomendar un horario — llevamos 6 publicaciones con medición comparable.',
};

let container: HTMLDivElement;
let root: Root;

function render(horarios?: MejoresHorarios) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <StrictMode>
        <MejoresHorariosCard horarios={horarios} />
      </StrictMode>,
    );
  });
  return container;
}

beforeAll(() => {
  // El gráfico no mide nada del DOM, pero React 18 avisa por `act` en jsdom.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('MejoresHorariosCard con datos reales de chile-fly-fishing', () => {
  it('muestra la franja recomendada como respuesta principal', () => {
    const el = render(CFF);
    expect(el.textContent).toContain('09:00-12:00');
    expect(el.textContent).toContain('hora de Chile');
  });

  it('acompaña la recomendación con su tamaño de muestra, nunca sola', () => {
    const el = render(CFF);
    // El n de cada franja va dibujado bajo su barra, no escondido en el hover:
    // sin él, "publica a las 09:00" con 7 publicaciones y con 1 se ven igual.
    expect(el.textContent).toContain('n=7');
    expect(el.textContent).toContain('28 publicaciones');
  });

  it('dibuja las 8 franjas del día, incluidas las vacías y las de muestra chica', () => {
    const el = render(CFF);
    const etiquetas = Array.from(el.querySelectorAll('tbody tr th')).map((t) => t.textContent);
    expect(etiquetas).toEqual([
      '00:00-03:00', '03:00-06:00', '06:00-09:00', '09:00-12:00',
      '12:00-15:00', '15:00-18:00', '18:00-21:00', '21:00-00:00',
    ]);
    // La franja sin publicaciones dice eso, no un 0 de alcance.
    expect(el.querySelector('tbody tr')?.textContent).toContain('sin publicaciones');
  });

  it('declara la advertencia de correlación y el vacío de historias', () => {
    const el = render(CFF);
    expect(el.textContent).toContain('no una causa comprobada');
    expect(el.textContent).toContain('Las historias no entran en este cálculo');
  });

  it('avisa que no usa el selector de rango de la página', () => {
    const el = render(CFF);
    expect(el.textContent).toContain('todo el historial disponible, no el rango que elijas');
  });

  it('nombra la franja a evitar con su diferencia real', () => {
    const el = render(CFF);
    expect(el.textContent).toContain('21:00-00:00');
    expect(el.textContent).toContain('92% menos');
  });
});

describe('MejoresHorariosCard sin muestra suficiente', () => {
  it('no inventa un horario: muestra el mensaje del backend y ningún gráfico', () => {
    const el = render(SIN_MUESTRA);
    expect(el.textContent).toContain('6 publicaciones con medición comparable');
    expect(el.querySelector('svg')).toBeNull();
    expect(el.textContent).not.toContain('hora de Chile');
  });
});

describe('MejoresHorariosCard contra un backend que todavía no trae el campo', () => {
  it('se omite en vez de tumbar la página de Instagram entera', () => {
    // El frontend y la Lambda se despliegan por separado: hay una ventana
    // real en la que el panel nuevo habla con el backend viejo.
    const el = render(undefined);
    expect(el.textContent).toBe('');
  });
});
