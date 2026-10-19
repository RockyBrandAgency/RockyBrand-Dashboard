/** Marca de texto de Ventas («Bajo lista», «Pérdida»): nunca solo color
 *  (WCAG 2.2 1.4.1). Neutro por defecto; crítico solo para la pérdida.
 *  Geometría de §16 (alto 24, padding 0 6, radio 6) en `.chip` de index.css. */
export function Chip({ critico, children, className, ...resto }: { critico?: boolean; children: React.ReactNode } & React.HTMLAttributes<HTMLSpanElement> & Record<`data-${string}`, string | undefined>) {
  return (
    <span {...resto} className={`chip${critico ? ' chip--critico' : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  );
}
