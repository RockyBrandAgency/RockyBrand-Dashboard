import { describe, expect, it } from 'vitest';
import { fechaCorta, fmtDolar, fmtMonto, llegadasProximas, motivoSinUtilidad, nombrePrograma, pescadoresConfirmados, utilidadDe } from './fichaPescador';
import type { HuespedItem, ReservaProfit, ReservaResumenItem } from '../types';

function reserva(extra: Partial<ReservaResumenItem> = {}): ReservaResumenItem {
  return {
    BookingID: 'bkg_1', GuestID: 'gst_1', Status: 'CONFIRMED', CheckIn: '2026-11-10', CheckOut: '2026-11-15', RoomID: 'ALL_INCLUSIVE',
    Source: 'Directa Web', GuestName: 'Ana', TotalAmount: 9800, Currency: 'USD', PaymentStatus: 'PAID', ...extra,
  };
}

const sinNumero = (Reason: string, Currency = 'USD'): ReservaProfit => ({ SupplierCost: null, Amount: null, Percent: null, Currency, Reason });

describe('utilidadDe', () => {
  it('sin bloque Profit (Lambda anterior o bandera apagada) muestra «—» con su motivo', () => {
    expect(utilidadDe(reserva())).toMatchObject({ valor: '—', motivo: 'Sin dato de ganancia', formula: null });
  });

  it('con Amount null explica por qué no hay número, según Reason', () => {
    expect(utilidadDe(reserva({ Profit: sinNumero('SIN_TARIFA') }))).toMatchObject({ valor: '—', motivo: 'Sin tarifa del guía para esa fecha de llegada' });
    expect(utilidadDe(reserva({ Profit: sinNumero('LICENCIA_SIN_MONTO') })).motivo).toBe('No se pudo calcular la ganancia');
    expect(utilidadDe(reserva({ Currency: 'CLP', Profit: sinNumero('MONEDA_DISTINTA') })).motivo).toBe('La reserva está en CLP; los costos están en USD');
    expect(utilidadDe(reserva({ Profit: sinNumero('TARIFA_SOLAPADA') })).motivo).toBe('Hay dos tarifas del guía para esa fecha; revisa la configuración');
    expect(utilidadDe(reserva({ Profit: sinNumero('SIN_PESCADORES') })).motivo).toBe('Falta cuántos pescadores vienen');
    expect(utilidadDe(reserva({ Profit: sinNumero('SIN_PRECIO') })).motivo).toBe('Falta el precio de la reserva');
    expect(utilidadDe(reserva({ Profit: sinNumero('CANCELADA') })).motivo).toBe('La reserva está cancelada: no deja ganancia');
    expect(utilidadDe(reserva({ Profit: sinNumero('SIN_PROGRAMA') })).motivo).toBe('No se reconoce el programa de la reserva (debe ser All Inclusive o Full Day)');
    expect(utilidadDe(reserva({ Profit: sinNumero('SIN_FECHAS') })).motivo).toBe('Faltan las fechas de llegada o salida');
    expect(utilidadDe(reserva({ Profit: sinNumero('OTRO') })).motivo).toBe('No se pudo calcular la ganancia');
  });

  it('el porcentaje sale de Percent, una sola fuente', () => {
    const u = utilidadDe(reserva({ Profit: { SupplierCost: 8400, Amount: 1400, Percent: 14.3, Currency: 'USD', Reason: null } }));
    expect(u.valor).toBe('14,3\u00a0%');
  });

  it('con número: porcentaje sobre el Total, fórmula y monto', () => {
    const u = utilidadDe(reserva({ Profit: { SupplierCost: 8400, Amount: 1400, Percent: 14.29, Currency: 'USD', Reason: null } }));
    expect(u.valor).toBe('14,3\u00a0%');
    expect(u.negativa).toBe(false);
    expect(u.formula).toBe('(9.800 − 8.400) ÷ 9.800 = 14,3\u00a0%');
    expect(u.motivo).toBe('USD 1.400 después del costo del guía');
  });

  it('una pérdida se marca negativa', () => {
    const u = utilidadDe(reserva({ TotalAmount: 4000, Profit: { SupplierCost: 4200, Amount: -200, Percent: -5, Currency: 'USD', Reason: null } }));
    expect(u.negativa).toBe(true);
    expect(u.motivo).toBe('Pierde USD 200');
  });
});

describe('dólar observado (17-oct)', () => {
  it('SIN_DOLAR nombra el día que falta; sin fecha, dice «del día de confirmación»', () => {
    expect(motivoSinUtilidad('SIN_DOLAR', 'USD', null, '2026-11-14')).toBe('Falta el dólar observado del 14 nov 2026: la ganancia no se calcula');
    expect(motivoSinUtilidad('SIN_DOLAR')).toBe('Falta el dólar observado del día de confirmación: la ganancia no se calcula');
  });

  it('SIN_FECHA_CONFIRMACION no se confunde con una falla de la fuente', () => {
    const m = motivoSinUtilidad('SIN_FECHA_CONFIRMACION');
    expect(m).toBe('Falta la fecha de confirmación: sin ella no se sabe qué dólar usar y la ganancia no se calcula');
    expect(m).not.toContain('dólar observado del');
  });

  it('la ficha usa ConfirmedAt para el motivo SIN_DOLAR', () => {
    const u = utilidadDe(reserva({ Profit: { ...sinNumero('SIN_DOLAR'), ConfirmedAt: '2026-11-14' } }));
    expect(u).toMatchObject({ valor: '—', motivo: 'Falta el dólar observado del 14 nov 2026: la ganancia no se calcula' });
  });

  it.each(['SIN_DOLAR', 'SIN_FECHA_CONFIRMACION'])('pendiente con %s: se calcula al confirmar', (reason) => {
    const u = utilidadDe(reserva({ Status: 'PENDING', Profit: sinNumero(reason) }));
    expect(u.motivo).toBe('Se calcula al confirmar la reserva, con el dólar observado de ese día.');
  });

  it('formatos: dólar con dos decimales y fecha con día de la semana sin coma', () => {
    expect(fmtDolar(948)).toBe('CLP 948,00');
    expect(fmtDolar(984.09)).toBe('CLP 984,09');
    expect(fechaCorta('2026-11-13', true)).toBe('vie 13 nov 2026');
    expect(fechaCorta('2026-11-14')).toBe('14 nov 2026');
    expect(fechaCorta(null)).toBe('');
  });
});

describe('llegadasProximas', () => {
  it('usa la ventana del backend: hoy <= llegada < hoy + 30', () => {
    const l = llegadasProximas(
      [
        reserva({ BookingID: 'hoy', CheckIn: '2026-10-16' }),
        reserva({ BookingID: 'dia29', CheckIn: '2026-11-14' }),
        reserva({ BookingID: 'dia30', CheckIn: '2026-11-15' }),
        reserva({ BookingID: 'ayer', CheckIn: '2026-10-15' }),
        reserva({ BookingID: 'pend', Status: 'PENDING', CheckIn: '2026-10-20' }),
      ],
      '2026-10-16',
    );
    expect(l.confirmadas.map((r) => r.BookingID)).toEqual(['hoy', 'dia29']);
    expect(l.pendientes).toBe(1);
    expect(l.siguiente?.BookingID).toBe('dia30');
  });
});

describe('pescadoresConfirmados', () => {
  const h = (GuestID: string) => ({ GuestID, FullName: GuestID, Contact: {}, OriginCountry: null, VIP_Tags: [], DietaryRestrictions: [], MobilityNotes: '', SpecialNotes: '', TotalLTV: 0 }) as unknown as HuespedItem;

  it('deja solo a quien tiene una reserva confirmada y marca a quien ya viajó', () => {
    const filas = pescadoresConfirmados(
      [h('confirmado'), h('pendiente'), h('cancelado'), h('viajo'), h('sin_reservas')],
      [
        reserva({ BookingID: 'b1', GuestID: 'confirmado', CheckIn: '2026-11-10' }),
        reserva({ BookingID: 'b0', GuestID: 'confirmado', Status: 'CANCELLED', CheckIn: '2026-10-20' }),
        reserva({ BookingID: 'b2', GuestID: 'pendiente', Status: 'PENDING' }),
        reserva({ BookingID: 'b3', GuestID: 'cancelado', Status: 'CANCELLED' }),
        reserva({ BookingID: 'b4', GuestID: 'viajo', CheckIn: '2026-10-05' }),
      ],
      '2026-10-16',
    );
    expect(filas.map((f) => f.GuestID)).toEqual(['confirmado', 'viajo']);
    const [c, v] = filas;
    expect(c.reservas.map((r) => r.BookingID)).toEqual(['b1']);
    expect(c.abrir.BookingID).toBe('b1');
    expect(c.yaViajo).toBe(false);
    expect(v.yaViajo).toBe(true);
    expect(v.abrir.BookingID).toBe('b4');
  });
});

describe('nombrePrograma', () => {
  it('traduce los códigos de programa y deja tal cual cualquier otro RoomID', () => {
    expect(nombrePrograma('FULL_DAY')).toBe('Full Day');
    expect(nombrePrograma('ALL_INCLUSIVE')).toBe('All Inclusive');
    expect(nombrePrograma('Suite 1')).toBe('Suite 1');
    expect(nombrePrograma('constructor')).toBe('constructor');
  });
});

describe('fmtMonto', () => {
  it('con centavos, siempre dos decimales; sin centavos, ninguno', () => {
    expect(fmtMonto('USD', 43.5)).toBe('USD 43,50');
    expect(fmtMonto('USD', 43.53)).toBe('USD 43,53');
    expect(fmtMonto('USD', 9800)).toBe('USD 9.800');
    expect(fmtMonto('USD', 12966.47)).toBe('USD 12.966,47');
    expect(fmtMonto('CLP', 360000)).toBe('CLP 360.000');
    expect(fmtMonto('USD', -40)).toBe('−USD 40');
    expect(fmtMonto('USD', 100.004)).toBe('USD 100');
  });
});
