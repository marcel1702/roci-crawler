export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Sichere Ränder (Notch, Home-Indikator) in CSS-Pixeln; 0 auf Geräten ohne Aussparungen. */
export function readSafeArea(): SafeArea {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const area = {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
  probe.remove();
  return area;
}
