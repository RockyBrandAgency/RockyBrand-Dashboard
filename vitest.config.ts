import { defineConfig } from 'vitest/config';

// Config propia de las pruebas, aparte de vite.config.ts a propósito: la
// config de build de producción no tiene por qué cargar tipos ni opciones de
// test, y meter la clave `test` allí rompía `tsc -b` del build real.
export default defineConfig({
  test: {
    // jsdom y no 'node': lo que se prueba acá es lo que el panel le AFIRMA a
    // quien mira —el título de la pestaña, los colores de :root— y eso vive en
    // el DOM. Sin un DOM, justo las pruebas que importan no corren.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Las fechas del panel son de Chile: las pruebas corren en esa zona en
    // cualquier máquina y en la CI, no en la del equipo que las lanza. Sirve
    // con el pool `forks` (el de vitest por omisión); en `threads` o
    // `vmThreads` TZ no cambia la zona (https://vitest.dev/config/env). Lo
    // comprueba tendenciaVentas.test.ts.
    env: { TZ: 'America/Santiago' },
  },
});
