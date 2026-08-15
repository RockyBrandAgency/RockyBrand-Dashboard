// Espejo en TypeScript de 04-codigo/plantilla_campos.py.
//
// Existe SOLO para la vista previa en vivo: mientras se escribe en un campo,
// el iframe tiene que actualizarse sin ida y vuelta al servidor. Lo que se
// GUARDA lo renderiza el backend a partir de html_source + campos — esta copia
// nunca decide qué se envía. Si las dos divergieran, la vista previa mentiría,
// pero el correo saldría bien; el orden inverso (confiar en el navegador para
// lo que se manda) es el que no se puede permitir.
//
// Las dos implementaciones tienen que dar el mismo resultado. Si se cambia una,
// se cambia la otra: la prueba que las ancla es
// 04-codigo/test_plantillas_campos.py::test_ancho_boton_reproduce_el_html_original.

import type { EmailTemplateCampo } from '../types';

const MARCADOR = /\{\{(?:(ancho_boton):)?([a-zA-Z0-9_]+)\}\}/g;

/** Ancho en px del <v:roundrect> que Outlook dibuja en lugar del botón. */
export function anchoBoton(etiqueta: string): number {
  return Math.trunc((etiqueta ?? '').length * 8.6) + 56;
}

/** Un campo guarda TEXTO, no HTML: el escapado es trabajo del render. Así
 *  nadie rompe el correo escribiendo un `<` o un `&` en un campo. */
export function escapar(valor: string): string {
  return (valor ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Aplica los campos sobre el molde. Deja intacto lo que no reconoce:
 *  {{unsubscribe_link}} y {{name}} los reemplaza el motor de envío. */
export function render(htmlSource: string, campos: EmailTemplateCampo[] | undefined): string {
  const valores = new Map<string, string>();
  for (const c of campos ?? []) if (c?.clave) valores.set(c.clave, c.valor ?? '');

  return (htmlSource ?? '').replace(MARCADOR, (todo, funcion: string | undefined, clave: string) => {
    if (!valores.has(clave)) return todo;
    const valor = valores.get(clave) as string;
    return funcion === 'ancho_boton' ? String(anchoBoton(valor)) : escapar(valor);
  });
}

/** El HTML final de una plantilla, tenga campos o no. */
export function htmlDeLaPlantilla(t: { html_source?: string; campos?: EmailTemplateCampo[]; html_body?: string }): string {
  if (t.html_source && t.campos && t.campos.length > 0) return render(t.html_source, t.campos);
  return t.html_body ?? '';
}

/** Cómo se ve en un cliente de correo: los marcadores del motor con valores
 *  de ejemplo. El link de baja va a '#' — el real se firma por contacto en
 *  el momento del envío y no existe todavía. */
export function paraVistaPrevia(html: string): string {
  return html
    .replace(/\{\{name\}\}/g, 'Nombre de ejemplo')
    .replace(/\{\{unsubscribe_link\}\}/g, '#');
}

/** Los campos agrupados, en el orden en que vienen (que es el orden del
 *  correo, verificado al importar la plantilla). */
export function porGrupo(campos: EmailTemplateCampo[]): { grupo: string; campos: EmailTemplateCampo[] }[] {
  const grupos: { grupo: string; campos: EmailTemplateCampo[] }[] = [];
  for (const c of campos) {
    const nombre = c.grupo || 'Contenido';
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.grupo === nombre) ultimo.campos.push(c);
    else grupos.push({ grupo: nombre, campos: [c] });
  }
  return grupos;
}
