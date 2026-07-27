import { useState, useEffect } from 'react';
import { Card } from './Card';
import { STATUS } from './status';

type WeatherDay = { date: string; max: number; min: number; code: number };

const WX_ICON: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️', 71: '❄️', 73: '❄️', 75: '❄️', 80: '🌦️', 81: '🌦️', 82: '🌧️', 95: '⛈️',
};
const WX_LABEL: Record<number, string> = {
  0: 'Despejado', 1: 'Casi despejado', 2: 'Parcial', 3: 'Nublado', 45: 'Niebla', 48: 'Niebla',
  51: 'Llovizna', 53: 'Llovizna', 55: 'Llovizna', 61: 'Lluvia leve', 63: 'Lluvia', 65: 'Lluvia fuerte',
  71: 'Nieve leve', 73: 'Nieve', 75: 'Nieve fuerte', 80: 'Chubascos', 81: 'Chubascos', 82: 'Chubascos', 95: 'Tormenta',
};
function wxIcon(c: number) {
  return WX_ICON[c] ?? '🌤️';
}
function wxLabel(c: number) {
  return WX_LABEL[c] ?? 'Variable';
}
function buildInsight(days: WeatherDay[]) {
  const good = days.filter((d) => d.code <= 3).length;
  if (good >= 4) return 'Los próximos 5 días se proyectan soleados. Excelente oportunidad para reforzar actividades al aire libre: pesca con mosca, senderismo y cabalgatas.';
  if (good >= 2) return `Se esperan ${good} días de buen tiempo. Ideal para planificar actividades al aire libre en esas ventanas soleadas.`;
  return 'Se esperan días con lluvias. Buen momento para destacar actividades interiores y el ambiente del lodge.';
}

// Fuente real (Open-Meteo, API publica) - no depende del backend de la
// Sesion 1, se porta tal cual del Make.
export function WeatherWidget() {
  const [days, setDays] = useState<WeatherDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const DAY = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  useEffect(() => {
    fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=-46.12&longitude=-72.15&daily=weathercode,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=America%2FSantiago'
    )
      .then((r) => r.json())
      .then((d) => {
        setDays(
          d.daily.time.map((t: string, i: number) => ({
            date: t,
            max: Math.round(d.daily.temperature_2m_max[i]),
            min: Math.round(d.daily.temperature_2m_min[i]),
            code: d.daily.weathercode[i],
          }))
        );
        setLoading(false);
      })
      .catch(() => {
        setDays([
          { date: '2026-01-26', max: 18, min: 9, code: 1 },
          { date: '2026-01-27', max: 20, min: 10, code: 0 },
          { date: '2026-01-28', max: 19, min: 11, code: 0 },
          { date: '2026-01-29', max: 15, min: 8, code: 3 },
          { date: '2026-01-30', max: 12, min: 7, code: 61 },
        ]);
        setOffline(true);
        setLoading(false);
      });
  }, []);

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>🌦️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Clima — Cerro Castillo</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Pronóstico 5 días · Región de Aysén
            {offline && ' · datos estimados'}
          </div>
        </div>
      </div>
      {loading ? (
        <div style={{ fontSize: 14, color: 'var(--text-muted)', padding: '8px 0' }}>Cargando pronóstico…</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {days.map((d, i) => {
              const name = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : DAY[new Date(d.date + 'T12:00:00').getDay()];
              return (
                <div
                  key={i}
                  style={{
                    flex: '1 1 64px',
                    background: i === 0 ? 'var(--primary)' : 'var(--bg)',
                    border: `1px solid ${i === 0 ? 'transparent' : 'var(--border)'}`,
                    borderRadius: 10,
                    padding: '12px 8px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: i === 0 ? 'rgba(255,255,255,0.60)' : 'var(--text-muted)',
                      marginBottom: 6,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {name}
                  </div>
                  <div style={{ fontSize: 22 }}>{wxIcon(d.code)}</div>
                  <div style={{ fontSize: 10, color: i === 0 ? 'rgba(255,255,255,0.55)' : 'var(--text-muted)', margin: '4px 0', lineHeight: 1.3 }}>
                    {wxLabel(d.code)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: i === 0 ? '#fff' : 'var(--text)' }}>
                    {d.max}° <span style={{ fontWeight: 400, opacity: 0.5 }}>{d.min}°</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              background: STATUS.bien.tagBg,
              border: '1px solid #BBE4CA',
              borderLeft: `3px solid ${STATUS.bien.dot}`,
              borderRadius: 8,
              padding: '12px 14px',
              fontSize: 13,
              color: STATUS.bien.tagText,
              lineHeight: 1.55,
            }}
          >
            💡 {buildInsight(days)}
          </div>
        </>
      )}
    </Card>
  );
}
