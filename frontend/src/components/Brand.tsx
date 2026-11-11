/** Marque NJMDev : logo officiel (repris de MGA, public/brand) et nom, avec le module en cours le cas échéant. */
export function Brand({ module, size = 22 }: { module?: string; size?: number }) {
  return (
    <span className="brand-mark">
      <img src="/brand/njmdev-white.png" alt="" height={size} style={{ width: "auto" }} />
      <span className="brand-name">
        NJMDev
      </span>
      {module && <span className="brand-module">{module}</span>}
    </span>
  );
}
