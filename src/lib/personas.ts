/** Cantidad de personas (pescadores en CFF) de una reserva, como número.
 *
 *  El backend manda `PartyMembers` como texto («"1"»): sale de DynamoDB como
 *  Decimal y `crm_dashboard_api_lambda.py` serializa con `default=str`, aunque
 *  `types.ts` diga `number`. Comparar con `=== 1` daba «1 personas» y sumar
 *  concatenaba («01 personas») (QA 18-oct). Todo uso de `PartyMembers` pasa por
 *  aquí. Vacío, nulo o que no sea número → null: la pantalla decide qué mostrar. */
export function personasDe(r: { PartyMembers?: number | string | null } | null | undefined): number | null {
  const v = r?.PartyMembers;
  if (v == null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
