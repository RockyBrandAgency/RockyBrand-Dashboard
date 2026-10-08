# Versiones del panel del cliente

Cada versión que llega a `main` (Amplify la publica sola) lleva un tag `vX.Y.Z`,
el número en `package.json` y una entrada acá.

| Parte | Cuándo sube |
|---|---|
| **mayor** | se retira o cambia algo que el cliente ya usa |
| **menor** | aparece una capacidad nueva |
| **parche** | se arregla o se ordena sin capacidad nueva |

Si una versión necesita un despliegue del backend (AI_Agency), la entrada lo dice
y se publica **después** de ese despliegue: el panel nuevo contra una Lambda vieja
muestra botones que no guardan.

---

## 3.0.0

**2026-10-08** · mayor (la ficha lateral se reemplaza por una página) · requiere
backend: arquitectura 1.10.0 de AI_Agency (`store-admin-api` con el campo `rut`)
desplegada **antes** de publicar el panel. Con la Lambda anterior, guardar una
garantía responde «Campos desconocidos: rut».

Tienda → Garantías (pedido de Mato):

- **Página propia** para agregar y editar: ocupa el área de contenido en lugar
  de abrirse a la derecha. Al guardar vuelve al listado con el aviso de éxito;
  «← Garantías» y Cancelar vuelven sin guardar y preguntan si hay cambios.
- **Orden de los datos** en cuatro pasos numerados: 1 Cliente (nombre, RUT,
  teléfono, correo), 2 Despacho (dirección, comuna, región, empresa de
  transporte, seguimiento, fechas), 3 Caña (caña, modelo, tramo, qué pasó) y
  4 Estado y pago. La nota interna cierra.
- **RUT**, nuevo y opcional: se valida el dígito verificador y se guarda
  siempre como `12.345.678-5`. Va en los datos de envío que se copian.
- **Región** pasa a ser una lista con las 16 regiones (una escrita a mano desde
  la web se conserva como opción). Empresa de transporte sugiere Starken,
  Chilexpress, Correos de Chile y Blue Express.
- **Filtros** del listado por año, región y caña, con la cantidad de cada
  opción; los indicadores siguen al filtro. Así se ve a qué región se despacha
  más, en qué año hubo más casos y qué caña pide más garantías.

## 2.0.0

**2026-10-07** · mayor (cambia cómo se edita una garantía) · requiere backend:
arquitectura 1.9.0 de AI_Agency con `chile-fly-fishing-store-stack` y
`rockybrand-dashboard-stack` desplegados.

Tienda → Garantías (decisión de Mato):

- **Ficha lateral editable**: tocar una fila abre la garantía a la derecha (a
  pantalla completa en el celular) y se edita ahí mismo. Guardar y Eliminar
  quedan fijos al pie. Reemplaza al detalle que se desplegaba bajo la fila y
  al formulario aparte; el estado se elige con chips y se guarda con Guardar
  (antes, un clic en «Marcar como» guardaba solo).
- **Eliminar = papelera**: la garantía sale de la lista y de los indicadores
  y aparece un aviso con **Deshacer** (también ⌘Z / Ctrl+Z). La vista
  **Eliminadas** muestra las eliminadas con **Restaurar**; una eliminada se
  abre en solo lectura. Nada se borra de verdad.
- Si otra persona cambió o eliminó la garantía mientras la editabas, la ficha
  ofrece **descartar tus cambios y ver la versión actual**.
- ⌘S / Ctrl+S guarda; Escape cierra y pregunta si hay cambios sin guardar.
- «Copiar datos de envío»: nombre, teléfono y dirección listos para la
  etiqueta.
- Los indicadores (KpiRow, todas las pantallas) ya no se desbordan en el
  celular: pasan a dos por fila.

## 1.2.0

**2026-10-07** · menor · requiere backend: arquitectura 1.8.0 de AI_Agency con
`chile-fly-fishing-store-stack` y `rockybrand-dashboard-stack` desplegados.

Tienda → Garantías (pedido de Mato):

- **Agregar garantía** a mano, para un caso que no llegó por el formulario de la
  web. El correo es opcional y no se le envía nada al cliente.
- **Editar garantía**: cliente, caña y tramo, dirección de despacho, empresa de
  transporte, N° de seguimiento, fechas de despacho y de entrega, precio al
  cliente, costo de despacho, costo pagado a Douglas, pago y nota interna.
- Estado nuevo **Entregada** (el cliente recibió el tramo). Al marcar
  Despachada o Entregada sin fecha, se guarda la de hoy.
- El detalle muestra el margen (precio menos costos cargados) y el pago.
- Si otra persona cambió la garantía mientras la editabas, el guardado se
  rechaza y pide recargar, en vez de pisar ese cambio.
- Cambiar el estado ya no borra la nota interna.

## 1.1.0

**2026-10-05** · menor · requiere backend: arquitectura 1.7.0 de AI_Agency con
`rockybrand-dashboard-stack` desplegado (campo `Companions`).

Acompañantes de cada viaje: nombre, apellido, fecha de nacimiento, alergia
alimentaria (sí/no y a qué) y notas. Se agregan, editan y quitan sin cerrar la
ficha, desde dos lugares que comparten el dato (vive en la reserva):

- la ficha de la reserva (Resumen y Calendario de Reservas);
- la ficha del pescador en Lodge → Pescadores, una sección por viaje no
  cancelado.

En una reserva cancelada se ven pero no se editan. Si la Lambda desplegada no
devuelve la lista guardada, el panel lo dice en vez de mostrar un guardado falso.

Commits `b757687`, `d72c18e`.

## 1.0.0

**2026-10-02** · línea base, antes de versionar: lo que Amplify publicó el 2-oct
(`618fc0f`).
