# Dashboard del cliente y PMS — 06

Repositorio Git independiente de AI_Agency. Revisa aquí `git status` antes de
editar. React + TypeScript + Vite; scripts reales en `package.json`:
`npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.

- Esta es la vista del cliente; la de staff está en `../05-panel-web/`.
- Rutas y pantallas: `src/App.tsx`, `src/screens.ts`; contratos: `src/api/`.
  Backend: `../04-codigo/crm_dashboard_api_lambda.py` y `pms_lambda.py`.
- Preserva aislamiento por cliente y marca. Cambios de estado de reservas pueden
  enviar avisos reales: comprueba el flujo antes de probar con datos de clientes.
- Consulta `../docs/estado.md` si la tarea depende de despliegues o pendientes.
  Las capturas diarias de RRSS y la opción de confirmar sin avisar ya tienen
  cierres documentados; no repitas los pendientes del índice anterior.
- Conserva componentes y estilos existentes; no imprimas tokens ni credenciales.
