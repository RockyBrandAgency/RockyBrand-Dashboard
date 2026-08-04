import { Card } from './Card';
import { InfoRow } from './InfoRow';
import { STATUS } from './status';
import { countryFlag } from './countryFlags';
import { OriginBadge } from './OriginBadge';
import type { LlegadaGuest } from '../types';

function formatCheckIn(checkIn: string): string {
  const today = new Date();
  const d = new Date(checkIn + 'T00:00:00');
  const diffDays = Math.round((d.getTime() - new Date(today.toDateString()).getTime()) / 86400000);
  const dateLabel = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
  if (diffDays === 0) return `Hoy, ${dateLabel}`;
  if (diffDays === 1) return `Mañana, ${dateLabel}`;
  if (diffDays === 2) return `Pasado mañana, ${dateLabel}`;
  return dateLabel;
}

// Bandera operativa: hay algo que el staff necesita saber antes de que
// llegue este huesped (transfer, dieta, movilidad, o una nota especial).
export function hasAlert(guest: LlegadaGuest): boolean {
  return Boolean(
    guest.ArrivalInfo.transferType ||
      guest.DietaryRestrictions.length > 0 ||
      guest.MobilityNotes ||
      guest.SpecialNotes ||
      guest.BookingNotes
  );
}

export function GuestCard({ guest, isDesktop }: { guest: LlegadaGuest; isDesktop: boolean }) {
  const alert = hasAlert(guest);
  return (
    <Card
      style={{
        borderLeft: `4px solid ${alert ? STATUS.atencion.dot : STATUS.bien.dot}`,
        padding: isDesktop ? '22px 26px' : '18px 18px',
        boxShadow: alert ? '0 2px 12px rgba(180,83,9,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{countryFlag(guest.OriginCountry)}</span>
          <div>
            <div style={{ fontSize: isDesktop ? 16 : 15, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              {guest.FullName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{guest.OriginCountry ?? 'País no informado'}</div>
          </div>
        </div>
        <OriginBadge source={guest.Source} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <InfoRow icon="📅" label="Llegada" urgent={false}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {formatCheckIn(guest.CheckIn)}
            {guest.ArrivalInfo.time && <> · <span style={{ color: 'var(--primary)' }}>{guest.ArrivalInfo.time}</span></>}
          </span>
        </InfoRow>

        <InfoRow icon="🚐" label="Transfer" urgent={!!guest.ArrivalInfo.transferType}>
          <span style={{ fontSize: 14, fontWeight: guest.ArrivalInfo.transferType ? 700 : 400, color: guest.ArrivalInfo.transferType ? STATUS.atencion.tagText : 'var(--text-sub)' }}>
            {guest.ArrivalInfo.transferType || 'Sin datos de transfer'}
          </span>
        </InfoRow>

        <InfoRow icon="🍽️" label="Restricción alimenticia" urgent={false}>
          <span style={{ fontSize: 14, fontWeight: guest.DietaryRestrictions.length ? 600 : 400, color: guest.DietaryRestrictions.length ? 'var(--text)' : 'var(--text-muted)' }}>
            {guest.DietaryRestrictions.length ? guest.DietaryRestrictions.join(', ') : 'Sin restricciones'}
          </span>
        </InfoRow>

        {guest.MobilityNotes && (
          <InfoRow icon="♿" label="Movilidad" urgent>
            <span style={{ fontSize: 14, color: STATUS.atencion.tagText, fontWeight: 600 }}>{guest.MobilityNotes}</span>
          </InfoRow>
        )}

        {guest.SpecialNotes && (
          <InfoRow icon="📝" label="Nota del huésped" urgent={false} noteBg>
            <span style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.5 }}>{guest.SpecialNotes}</span>
          </InfoRow>
        )}

        {guest.BookingNotes && (
          <InfoRow icon="🛏️" label="Nota de la reserva" urgent={false} noteBg>
            <span style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.5 }}>{guest.BookingNotes}</span>
          </InfoRow>
        )}
      </div>
    </Card>
  );
}
