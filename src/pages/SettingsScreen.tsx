import { useState } from 'react';
import { Card } from '../components/Card';
import { ToggleRow } from '../components/ToggleRow';
import { useAuth } from '../context/AuthContext';

// Toggles de preferencias 100% locales - ni esta sesion ni la anterior
// construyeron un endpoint de notificaciones, asi que "Guardar" no manda
// nada a ningun servidor (no se finge una persistencia que no existe).
export function SettingsScreen({ isDesktop }: { isDesktop: boolean }) {
  const { logout } = useAuth();
  const [sw, setSw] = useState({ newBooking: true, cancellation: true, inquiry: false, syncError: true });
  const [time, setTime] = useState('08:00');
  const [saved, setSaved] = useState(false);
  const tog = (k: keyof typeof sw) => setSw((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: isDesktop ? '36px 40px 60px' : '20px 16px 80px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            Configuración
          </div>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 28 : 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Avisos y notificaciones
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-sub)' }}>Qué alertas recibir de forma inmediata en tu teléfono.</p>
        </div>

        <Card style={{ padding: '0 22px', marginBottom: 20 }}>
          <div style={{ padding: '18px 0 12px', borderBottom: '1px solid var(--border-soft)' }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Avisos inmediatos
            </span>
          </div>
          <ToggleRow label="Nueva reserva" sub="Al confirmar una nueva reserva" on={sw.newBooking} toggle={() => tog('newBooking')} />
          <ToggleRow label="Cancelación" sub="Si un huésped cancela su estadía" on={sw.cancellation} toggle={() => tog('cancellation')} />
          <ToggleRow label="Consulta importante" sub="Consultas marcadas como prioritarias" on={sw.inquiry} toggle={() => tog('inquiry')} />
          <div style={{ borderBottom: 'none' }}>
            <ToggleRow label="Problema de sincronización" sub="Si las reservas dejan de actualizarse" on={sw.syncError} toggle={() => tog('syncError')} />
          </div>
        </Card>

        <Card style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
            Resumen semanal
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Hora del resumen</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Cada lunes a esta hora</div>
            </div>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{
                background: 'var(--bg)',
                border: '1.5px solid var(--border)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 16,
                color: 'var(--text)',
                fontWeight: 700,
                minHeight: 46,
                outline: 'none',
                fontFamily: 'Inter, sans-serif',
                cursor: 'pointer',
              }}
            />
          </div>
        </Card>

        <button
          onClick={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          }}
          style={{
            all: 'unset',
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            background: 'var(--primary)',
            color: '#fff',
            borderRadius: 10,
            padding: '16px',
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
            textAlign: 'center',
            minHeight: 54,
          }}
        >
          {saved ? '✓ Guardado' : 'Guardar preferencias'}
        </button>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
          Preferencias guardadas solo en este dispositivo — todavía no hay un backend de notificaciones.
        </p>

        <button
          onClick={logout}
          style={{
            all: 'unset',
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            background: 'transparent',
            color: 'var(--primary)',
            border: '1.5px solid var(--primary)',
            borderRadius: 10,
            padding: '14px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            textAlign: 'center',
            marginTop: 24,
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
