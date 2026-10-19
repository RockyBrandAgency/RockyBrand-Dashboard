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

## 5.0.0

**2026-10-16** · mayor (en Chile Fly Fishing, Pescadores deja de listar a
quien no tiene reserva confirmada y el Overview deja de mostrar el
calendario) · requiere backend: rama `lodge-cff-detalle` de AI_Agency
desplegada antes. Con la Lambda anterior la ficha muestra «—» en pago,
utilidad y datos de pesca, no ofrece editarlos y la tarjeta del mes dice
«Sin dato del mes completo».

Lodge de Chile Fly Fishing (pedido de Mato):

- **Qué.** El Overview de CFF parte por «Llegan en los próximos 30 días»
  (cada fila abre la ficha) y la tarjeta «Reservas de {mes}», que cuenta las
  confirmadas con llegada en el mes; salen el calendario, «Reservas nuevas
  esta semana» y «Sincronización de reservas». El Calendario y Pescadores
  abren la **ficha del pescador como página**, con pago, saldo, utilidad,
  viaje, experiencia, equipo, licencia, acompañantes y notas, y cancelar o
  confirmar «Ya pagó» con confirmación dentro de la página. Pescadores lista
  solo a quien tiene una reserva confirmada y marca a quien ya viajó. Las
  filas de las tres listas son botones: se abren con teclado. Alto Castillo
  sigue con el modal y la lista completa.
- **Por qué.** El modal no tenía espacio para los datos del viaje de pesca ni
  para la utilidad, y Pescadores mezclaba confirmados con reservas sin pagar
  o canceladas. Las filas eran `div` con clic: no se llegaba con teclado.
- **Beneficio.** En una pantalla se ve quién llega, cuánto pagó, cuánto debe
  y cuánto deja la reserva, y se cancela sin `window.confirm`, con el detalle
  de qué pasa. Al volver, la lista conserva filtros, scroll y la fila enfocada.
- **Errores.** Si el servidor no devuelve un dato nuevo en la respuesta del
  guardado, la ficha avisa que no se guardó en vez de darlo por hecho. El
  itinerario del viaje todavía no está en la ficha.

Ampliación del 16-oct, Ventas y costo del guía por programa (pedido de Mato):

- **Qué.** Nueva pestaña Lodge → Ventas (solo con `pms_utilidad`): Full Days
  vendidos (jornadas) y programas All Inclusive vendidos, total de la
  temporada por moneda, tabla por mes (tarjetas en el teléfono) que despliega
  sus reservas y abre la ficha, costos fijos en lenguaje simple, «Sin
  calcular» con su motivo y selector de temporada. En la ficha, el costo del
  guía es «USD 490 × 2 jornadas = USD 980», el mercado asumido se dice, el All
  Inclusive muestra la licencia incluida y el Full Day mantiene «¿La compramos
  nosotros?». Con utilidad, «Nueva reserva» elige el programa entre All
  Inclusive y Full Day en vez de texto libre.
- **Por qué.** El costo del guía depende del programa y del mercado, no de la
  cantidad de personas, y la licencia dejó de restar utilidad. Mato ingresa a
  mano las reservas de Chile y Brasil, que se pagan en CLP: un nombre de
  programa escrito a mano no calza con la tarifa.
- **Beneficio.** Se ve cuánto se vendió y cuánto queda por mes sin sumar USD
  con CLP, y por qué una reserva no tiene utilidad.
- **Errores.** Una venta web de un pescador chileno sale en USD y queda en «Sin
  calcular» (`MONEDA_DISTINTA`). Si la temporada no está configurada (409), la
  pestaña lo dice sin ofrecer reintentar.

Correcciones de la revisión de código del 16-oct, Ventas:

- **Qué.** La ficha abierta desde Ventas pide su reserva por `booking_id`.
  Si eso falla, Ventas muestra un error con «Reintentar»; con un 404 dice que
  la reserva no existe. «Costos fijos» avisa cuántas reglas de costo no se usan
  y por qué. La tarjeta de Full Days dice cuántas reservas no tienen fechas.
  Un 403 dice que Ventas no está activa para la cuenta. Las pendientes se
  llaman «pendientes de confirmar».
- **Por qué.** El resumen de reservas trae solo una ventana de fechas: toda
  llegada fuera de ella salía como «No encontramos esta reserva». Una falla de
  red se leía como que la reserva no existía. Una regla mal escrita se
  descartaba en silencio y un 403 hablaba de la conexión.
- **Beneficio.** Toda reserva de la temporada abre su ficha. Cada falla dice
  qué pasó y qué hacer, y no se pinta «undefined» ni «NaN».
- **Errores.** Los códigos de `reglas_descartadas` se infirieron del backend,
  todavía sin confirmar: un código desconocido muestra un texto genérico. Los
  otros viajes del pescador en esa ficha salen del resumen con ventana: si ese
  resumen falla, la ficha abre igual, solo con este viaje.

Correcciones de QA del 17-oct (Ventas, ficha, Nueva reserva y Calendario):

- **Qué.** Un 503 «No pudimos leer la configuración» se muestra con el texto
  del servidor y «Reintentar», en Ventas, en la ficha y al guardar (el botón
  pasa a «Reintentar»). En la ficha abierta desde Ventas, un 403 dice que
  Ventas no está activa, un 400 o un 409 muestran el motivo sin «Reintentar»,
  y el foco va a «← Ventas» mientras abre o al mensaje si no abre. El select de
  temporada ya no se deshabilita al cargar (avisa con `aria-busy`) y, tras un
  400, muestra la misma temporada que el aviso. Una respuesta tardía ya no pisa
  la ficha ni la temporada más nuevas. Si el refresco tras guardar no trae la
  lista, siguen los otros viajes que había; ese rótulo pasa a «Viajes
  cercanos». Campos, correo y WhatsApp de la ficha miden 44 px. Nueva reserva
  es un diálogo modal: `role="dialog"`, Escape cierra (pregunta si hay datos),
  Tab no sale, el foco vuelve al botón que lo abrió, cada campo con su
  etiqueta, toques de 44 px y las filas de tres campos se apilan en el
  teléfono. En Calendario de Reservas, la tabla pasa a filas apiladas cuando
  no cabe y los filtros de estado bajan de línea.
- **Por qué.** La revisión de QA del 17-oct midió: el modal desbordaba 115 px a
  320 y 75 px a 360; el Calendario desbordaba 286 px (CFF) y 356 px (Alto
  Castillo) a 768 por la tabla de reservas de 910 px; el select deshabilitado
  dejaba el foco en BODY (WCAG 2.4.3), y Escape no cerraba el modal.
- **Beneficio.** Sin desborde de 320 a 1440 px en Ventas, ficha, Calendario y
  Nueva reserva, medido en el arnés. Teclado y lector de pantalla saben dónde
  están y qué pasó en cada falla.
- **Errores.** «Viajes cercanos» no dice entre qué fechas: el servidor no
  devuelve los límites de su ventana. En Calendario siguen bajo 44 px «Nueva
  reserva» (40) y los filtros de estado (28): cumplen 2.5.8 AA (24 px) y no se
  cambiaron porque también son de Alto Castillo.
- **Ajuste de la revisión del 17-oct.** Con «Creando…», Escape, el fondo, la × y Cancelar
  ya no cierran Nueva reserva (cerrar invitaba a crearla dos veces); un 403 al
  abrir la ficha dice «No tienes acceso a esta reserva desde esta cuenta.»,
  porque viene de `/reservas-resumen` y no de Ventas.

Ventas v2 y dólar del día, 17-oct (pedido de Mato):

- **Qué.** Ventas parte por «Resumen de la temporada» (pescadores en Full Day
  y All Inclusive, ganancia por moneda con chip «Pérdida»), sigue con «Cuánto
  ganamos por venta» (una fila por programa y mercado: precio de lista, costo,
  dólar usado, ganancia, margen y el dólar en que esa venta deja de ganar),
  después la tabla por mes con «Cobrado con ganancia calculada» / Costo /
  Ganancia / Margen y un «Total temporada», y al final «Sin calcular». Bajo
  cada moneda, en el resumen, en cada mes y en el total, «+ N reservas sin
  calcular: USD X» suma aparte lo que se cobró sin ganancia calculada. Cada reserva marca «Bajo lista»
  y «Pérdida» con texto. La ficha dice «Costos y ganancia»: Cobrado, Precio de
  lista con aviso «Bajo lista», costo original en CLP y su equivalente en USD,
  y «Dólar usado» con la fecha y la fuente. Motivos nuevos `SIN_DOLAR` y
  `SIN_FECHA_CONFIRMACION`; reglas descartadas `PRECIO_INVALIDO` y
  `MONEDA_PRECIO_INVALIDA` explicadas en español. Todo control táctil del
  Calendario (CFF y Alto Castillo), de Ventas y de la ficha mide 44 px. Las
  tablas de Ventas salen solo si el contenido mide 760 px o más (a 1024 px,
  con la barra lateral, quedan 664 y se ven tarjetas). Calendario, lista de
  reservas, Resumen, Itinerarios y Pescadores dicen «Full Day» y «All
  Inclusive» como la ficha, no el código; otros nombres quedan igual. «Nueva reserva»
  parte en USD para CFF aunque los permisos lleguen tarde, pregunta antes de
  cerrar con Escape si se cambió moneda, personas o pago, y su error se anuncia
  y recibe el foco.
- **Por qué.** Brasil paga en USD y el guía cobra en CLP: sin el dólar del
  día de confirmación esas reservas quedaban «sin calcular» y no se veía qué
  venta perdía plata. «Nueva reserva» medía 40 px y los filtros de estado 28.
  «Vendido USD 22.620» parecía todo lo vendido, pero dejaba fuera tres
  reservas por USD 7.400; diciembre mostraba «—» con dos Full Day Brasil por
  USD 900. Textos en `--text-faint` (2,56:1) no llegaban a 4,5:1 (WCAG 2.2
  1.4.3): pasan a `--text-sub` (7,73:1).
- **Beneficio.** Se ve cuánto deja cada programa por mercado, qué reservas se
  vendieron bajo lista o con pérdida y con qué dólar se calculó cada una.
- **Errores.** Con la Lambda anterior (sin `tarifas` ni los campos nuevos),
  Ventas vuelve a «Costos fijos» y la ficha no muestra precio de lista ni
  dólar, sin «undefined» ni «NaN». Una reserva pendiente dice «Se calcula al
  confirmar». Sin tarifa, la ficha dice «Sin tarifa para este programa y
  mercado.»; sin precio de lista, «Sin precio de lista para esa fecha.». Sin
  dólar o sin fecha de confirmación, «Costo de Guía» muestra la tarifa sin
  convertir («CLP 400.000 × 1 jornada = CLP 400.000») en vez de «sin monto».
  La licencia del All Inclusive dice lo mismo en la ficha y en Ventas:
  «Incluida, la compra el guía». Un monto con centavos lleva siempre dos
  decimales («USD 43,50»). En Reservas, una fecha vacía se ve «—» y no
  «Invalid Date» ni NaN. «No avisar al pescador» y Sí/No de alergias miden
  44 px de toque. En el teléfono a 320 px las celdas de día del calendario miden
  44 px de alto, pero el ancho lo fijan las 7 columnas.
- Programas y países (pedido de Mato, 17-oct): Full Day lleva un badge cian y
  All Inclusive uno violeta, con el nombre dentro, en Ventas, la ficha,
  Reservas, el calendario, Overview, Pescadores, Itinerarios, PMS y los modales.
  Otro RoomID (Alto Castillo) sigue como texto. El país del pescador va con su
  bandera (emoji decorativo) y el nombre del país a la vista en las listas, con
  «…» si no cabe; solo las barras del calendario llevan la bandera sola, con el
  país para lectores y en `title`. Los mercados de tarifa van con la suya. En
  Resumen (PMS) el país y el programa o la habitación van en una línea propia
  bajo el nombre: a 320 px ya no esconden el badge ni «Hab 101». El backend
  manda `PartyMembers` como texto («"1"»): ahora se lee con `personasDe`
  (lib/personas) en Overview, Resumen, Itinerarios, la ficha y el detalle de
  reserva, así no sale «1 personas» ni «01 personas». El mercado USA se muestra «USA y otros»;
  el código sigue siendo USA. «Mercado asumido» queda sin bandera.
- Qué se vende (pedido de Mato, 17-oct): Ventas abre con «Resumen», una frase
  que dice qué mercado lidera y qué se vende más (sin plata, en pescadores) y la
  tarjeta «Reservas confirmadas»; debajo, el bloque «Qué se vende» por mercado y
  por programa, con barras decorativas que miden la participación sobre el
  total de pescadores de la temporada, y el número y el % en texto. «Más
  vendido» aparece desde 10 pescadores y sin empate. El mix lo manda el servidor
  (`segmentos`, `mercados`, `programas`); si no viene, Ventas queda como antes.
  Si no cuadra con el resumen, se avisa con «Reintentar». «Por mes» suma la
  columna «Mercados» y «Cuánto ganamos por venta» baja al quinto lugar. Full Day
  avisa las reservas sin jornadas calculadas (`jornadas_incompletas`). La frase
  dice «Esta temporada lidera USA y otros: 6 de 13 pescadores (46 %).»; sin
  pescadores clasificados no hay frase, y el % va con espacio no separable.

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
