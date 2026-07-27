export type Screen = 'home' | 'detail' | 'settings' | 'login';

export const SIDEBAR_W = 220;

export const NAV: { id: Screen; icon: string; label: string }[] = [
  { id: 'home', icon: '◉', label: 'Estatus Actual' },
  { id: 'detail', icon: '↓', label: 'Próximas llegadas' },
];
