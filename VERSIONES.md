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

## 4.0.0

**2026-10-12** · mayor (Publicación de Reels cambia de lugar y de nombre en el
menú) · requiere backend: las rutas `/dashboard/berry/*` de la API del panel y
el bucket `rockybrand-berry-medios`, con CORS que deje leer el `ETag`,
desplegados **antes** de publicar el panel. Con la Lambda anterior, Studio
muestra un error al cargar y ninguna subida parte.

Berry Studio, fase 1 (pedido de Mato):

- **Qué.** Berry pasa a ser una sección del menú con dos accesos:
  **Publicación** (la pantalla que se llamaba «Publicación de Reels», igual
  por dentro) y **Studio**, nueva. En Studio se suben clips, fotos y audio,
  con el botón o arrastrando a la página: cada archivo va directo a S3 en
  partes de 16 MB, cuatro a la vez, con barra, porcentaje, MB/s y tiempo
  restante, y se puede pausar, reanudar o cancelar. La biblioteca muestra
  miniatura, estado, detalle (resolución del original, fps, duración, HDR)
  y peso, en pestañas Todo, Videos, Fotos y Audio; lo listo se abre en un
  visor donde un clip vertical cabe entero. Una subida que quedó a medias en
  otra pestaña o equipo se ve como «Subida a medias» y se puede quitar. Las
  fotos HEIC todavía no: el navegador las rechaza con el mismo texto que el
  servidor.
- **Por qué.** El material crudo llegaba a Berry por fuera del panel. Con dos
  pantallas, Berry deja «Servicios Contratados» y sube a sección, como antes
  PMS y Tienda: listarlo en los dos lados duplicaba la entrada.
- **Beneficio.** El cliente sube archivos de hasta 20 GB desde el navegador y
  ve en qué va cada uno. Si se corta, vuelve a elegir el mismo archivo en el
  mismo navegador y sigue donde quedó. Si el servidor ya cerró la subida
  pero la respuesta no llegó (un 409 o sin red al completar), Studio lo ve
  en la biblioteca y la da por terminada en vez de subirla de nuevo. Ir a
  otra pantalla no corta la subida; cerrar o recargar la pestaña pregunta
  antes.
- **Errores.** Ninguno conocido. Probado con pruebas del motor de subida (XHR
  falso: lotes, vencimiento, reintentos, retomar, completar ya cerrado,
  pausar, cancelar) y en
  Chromium a 390, 820 y 1440 px con datos ficticios. No probado contra el
  backend real, en Safari ni con un archivo de varios GB.

## 3.2.1

**2026-10-12** · parche (se ordena sin capacidad nueva) · no requiere backend.

Contenedor de página como clase (pedido de Mato):

- **Qué.** El ancho de cada pantalla vive en una clase, `.contenedor-pagina`
  de `src/index.css`, en vez de un estilo en línea por pantalla. La ficha de
  una garantía (al abrir una o al agregarla) y su pie fijo usan la misma
  clase.
- **Por qué.** La ficha tenía su propio ancho, 880px con 40px fijos a los
  costados, y el listado 1080px con el margen que se achica cuando sobra
  espacio: al abrir una garantía el contenido se angostaba.
- **Beneficio.** Listado y ficha miden lo mismo en todo ancho de ventana, y
  un cambio de ancho se hace en un solo lugar para todas las pantallas.
- **Errores.** Ninguno conocido. Se retira `src/lib/contenedorPagina.ts`,
  que ya no tenía consumidores, y `SettingsScreen` deja de recibir
  `isDesktop`, que sólo usaba para el contenedor.

Garantías: tabla o tarjetas según el espacio (pedido de Mato):

- **Qué.** El listado mide el ancho que le queda
  (`hooks/useAnchoContenido.ts`). Si la tabla no cabe con al menos 180px
  para el cliente, se ve en tarjetas, como en el celular: Activas necesita
  919px y Eliminadas 1008px. En las tarjetas de Eliminadas los botones van
  en su propia línea, bajo el texto.
- **Por qué.** Entre 768 y 1299px de ventana la tabla no cabía y la página
  se salía por la derecha, entre 3 y 258px; un nombre o un correo largo la
  empujaba más. Así el listado no podía calzar con la ficha. En las tarjetas
  de Eliminadas, los botones se quedaban al lado y le dejaban al nombre
  unos pocos píxeles.
- **Beneficio.** Sin desborde en ningún ancho, ni con nombres o correos
  largos: la tabla ya no ensancha la página (`contain: inline-size`) y lo
  que no cabe se corta con «…».
- **Errores.** Ninguno conocido. Probado de 320 a 1920px con datos ficticios
  en Chromium; no probado en Safari ni con el panel real.

## 3.2.0

**2026-10-08** · menor (capacidad nueva) · requiere backend: arquitectura
1.12.0 de AI_Agency, con `chile-fly-fishing-store-stack` y
`rockybrand-dashboard-stack` desplegados **antes** de publicar el panel. Con la
Lambda anterior, «Eliminar permanentemente» responde error y no borra nada.
Incluye la 3.1.1, que no alcanzó a publicarse.

Tienda → Garantías (pedido de Mato):

- **Eliminar permanentemente**, solo en **Eliminadas**: un botón en cada fila,
  bajo Restaurar (lado a lado le quitaban más de la mitad de su columna al
  cliente), y en el pie de la página de una eliminada, donde una viva tiene
  Eliminar. Siempre pregunta antes («Se borra para siempre y no se puede
  restaurar»); cancelar no hace nada. Una garantía viva no lo tiene: primero se
  elimina, y ese paso sigue teniendo «Deshacer». En el celular, el pie de una
  eliminada no muestra Volver (no cabían los tres botones; arriba está
  «← Garantías»).
- Si otra persona la restauró mientras tanto, no se borra y lo dice.
- **Selectores de la página** (Región y Tramo): Safari los dibujaba nativos,
  más bajos que los demás campos y con las flechas pegadas al borde derecho.
  Ahora tienen el mismo alto y borde que un campo de texto, y la flecha a 12px
  del borde.
- **Fechas:** Safari las dibujaba 4px más altas que los demás campos; ahora
  miden lo mismo (35px, medido en WebKit) y dejan el mismo aire a la derecha.
  Con el motor de Safari 26.5, en reposo, no muestran flechas propias.

## 3.1.1

**2026-10-08** · parche (se ordena sin capacidad nueva) · no requiere backend.

Todas las pantallas: sin margen a los costados cuando sobra espacio (pedido de
Mato: `padding: 36px 0px 72px` en vez de `36px 40px 72px`).

- El contenedor de las 23 pantallas vive ahora en un solo lugar,
  `src/lib/contenedorPagina.ts`: antes cada pantalla lo escribía a mano y
  cambiarlo en una sola dejaba un salto de ancho al navegar.
- El margen lateral es `clamp(0px, calc(1160px - 100%), 40px)`: 0 con un área
  de contenido de 1160px o más (ventana de 1440px con la barra de 280px) y
  40px con 1120px o menos, para que el texto no toque la barra ni el borde en
  un notebook chico o una tablet. Medido en Chromium: con ventana de 1440px o
  más, 0px; con 1280px, 1024px y la tablet de 834px, el texto queda a 40px
  del borde, como antes. En el celular no cambia (`20px 16px 88px`).
- Llegadas (detalle) conserva su margen inferior propio (60px y 80px).

---

## 3.1.0

**2026-10-08** · menor (capacidad nueva) · requiere backend: arquitectura
1.11.0 de AI_Agency, con `chile-fly-fishing-store-stack`,
`rockybrand-dashboard-stack`, `rockybrand-crm-worker-stack` y
`rockybrand-whatsapp-stack` desplegados **antes** de publicar el panel. Con la
Lambda anterior el bloque no aparece (la lista no trae `aviso`), así que
publicarlo antes no rompe nada, pero tampoco sirve.

Tienda → Garantías: aviso de despacho por WhatsApp (pedido de Mato).

- En la página de la garantía, dentro de **2 Despacho**, el bloque **Aviso al
  cliente por WhatsApp**: en qué va el aviso (sin avisar, enviado, llegó, lo
  leyó, no salió con el motivo, o «no sabemos si salió»), la **vista previa
  exacta** del mensaje con sus dos botones y el enlace al seguimiento del
  courier, y si el cliente ya tocó «Lo recibí».
- **Notificar al cliente** sale solo con ese botón y una confirmación con el
  teléfono de destino. Con cambios sin guardar espera: el aviso sale con lo
  guardado. Si ya hubo un aviso, el botón es **Reenviar aviso** y vuelve a
  preguntar; si cambiaron datos desde el último, lo dice.
- Ante un corte no afirma nada: dice que no se sabe si salió y trae el estado
  guardado. Volver a apretar no duplica, porque el backend exige «Reenviar».
- En el listado, bajo el estado: «Sin avisar» en una despachada, «El aviso no
  salió», «Aviso enviado / entregado / leído» y «Confirmó que lo recibió».

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
