import { describe, expect, it } from 'vitest';
import { personasDe } from './personas';

// El backend manda PartyMembers como texto (Decimal de DynamoDB con default=str).
describe('personasDe', () => {
  it('texto o número → número', () => {
    expect(personasDe({ PartyMembers: '1' })).toBe(1);
    expect(personasDe({ PartyMembers: ' 3 ' })).toBe(3);
    expect(personasDe({ PartyMembers: 2 })).toBe(2);
    expect(personasDe({ PartyMembers: '0' })).toBe(0);
  });
  it('vacío, nulo, ausente o no numérico → null', () => {
    expect(personasDe({ PartyMembers: '' })).toBeNull();
    expect(personasDe({ PartyMembers: '  ' })).toBeNull();
    expect(personasDe({ PartyMembers: null })).toBeNull();
    expect(personasDe({})).toBeNull();
    expect(personasDe(null)).toBeNull();
    expect(personasDe({ PartyMembers: 'dos' })).toBeNull();
  });
  it('la comparación y la suma ya no fallan con texto', () => {
    expect(personasDe({ PartyMembers: '1' }) === 1).toBe(true);
    expect(0 + (personasDe({ PartyMembers: '1' }) ?? 1) + (personasDe({ PartyMembers: '2' }) ?? 1)).toBe(3);
  });
});
