import { SCENE_KEYS } from '../config/constants';
import { clamp } from '../core/math';
import type { Settings } from '../core/settings';
import { t } from '../i18n';
import type { TextKey } from '../i18n';
import { getSettings, updateSettings } from '../platform/settingsRuntime';
import { PanelScene } from '../ui/PanelScene';
import type { Rect } from '../ui/PanelScene';

type Flag = 'muted' | 'screenShake' | 'hints' | 'largeUi';

const VOLUME_STEP = 0.1;

/** Einstellungsfenster (Ton, Grafik, Barrierefreiheit, Hinweise). Gilt für das Gerät, nicht für den Spielstand. */
export class SettingsScene extends PanelScene {
  private parent: string = SCENE_KEYS.title;

  constructor() {
    super(SCENE_KEYS.settings);
  }

  init(data?: { parent: string }): void {
    this.parent = data?.parent ?? SCENE_KEYS.title;
  }

  create(): void {
    this.setupPanel(true);
    this.input.keyboard?.on('keydown-ESC', this.close, this);
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', this.close, this));
    this.refresh();
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(this.parent);
  }

  private set(patch: Partial<Settings>): void {
    updateSettings(patch);
    this.refresh();
  }

  protected render(): void {
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const s = getSettings();
    const m = 12 * u;
    const pad = 16 * u;
    const titleH = 46 * u;
    const panelW = Math.min(W - 2 * m, 560 * u);
    const panel: Rect = { x: (W - panelW) / 2, y: m, w: panelW, h: H - 2 * m };
    this.frame(panel);
    this.text(panel.x + pad, panel.y + titleH / 2, t('settings.title'), { size: 20, bold: true, color: '#dbe4f5', origin: [0, 0.5] });
    this.closeButton({ x: panel.x + panel.w - 46 * u, y: panel.y + 4 * u, w: 40 * u, h: 40 * u }, () => this.close());

    const rows = 7;
    const hintH = 34 * u;
    const rowH = clamp((panel.h - titleH - pad - hintH) / rows, 40 * u, 56 * u);
    let y = panel.y + titleH;
    const controlW = Math.min(230 * u, panel.w * 0.5);
    const controlX = panel.x + panel.w - pad - controlW;

    const label = (key: TextKey, row: number): void => {
      this.text(panel.x + pad, y + row * rowH + rowH / 2, t(key), { size: 15, color: '#dbe4f5', origin: [0, 0.5], wrap: controlX - panel.x - pad - 8 * u });
    };
    const toggle = (row: number, key: TextKey, flag: Flag): void => {
      label(key, row);
      // „Ton“ ist im Speicher als `muted` abgelegt, also umgekehrt dargestellt.
      const on = flag === 'muted' ? !s.muted : s[flag];
      const rect: Rect = { x: controlX, y: y + row * rowH + (rowH - 34 * u) / 2, w: controlW, h: 34 * u };
      const apply = (value: boolean): void => this.set({ [flag]: flag === 'muted' ? !value : value } as Partial<Settings>);
      this.segmented(rect, [t('settings.on'), t('settings.off')], on ? 0 : 1, (i) => apply(i === 0));
    };
    const stepper = (row: number, key: TextKey, field: 'musicVolume' | 'sfxVolume'): void => {
      label(key, row);
      const rect: Rect = { x: controlX, y: y + row * rowH + (rowH - 34 * u) / 2, w: controlW, h: 34 * u };
      const btn = 44 * u;
      const change = (delta: number): void => this.set({ [field]: clamp(Math.round((s[field] + delta) * 10) / 10, 0, 1) } as Partial<Settings>);
      this.button({ x: rect.x, y: rect.y, w: btn, h: rect.h }, '−', 0x2a3556, '#dbe4f5', () => change(-VOLUME_STEP), 18);
      this.text(rect.x + rect.w / 2, rect.y + rect.h / 2, `${Math.round(s[field] * 100)} %`, { size: 15, bold: true, color: '#ffffff', origin: [0.5, 0.5] });
      this.button({ x: rect.x + rect.w - btn, y: rect.y, w: btn, h: rect.h }, '+', 0x2a3556, '#dbe4f5', () => change(VOLUME_STEP), 18);
    };

    toggle(0, 'settings.sound', 'muted');
    stepper(1, 'settings.music', 'musicVolume');
    stepper(2, 'settings.sfx', 'sfxVolume');
    label('settings.quality', 3);
    this.segmented(
      { x: controlX, y: y + 3 * rowH + (rowH - 34 * u) / 2, w: controlW, h: 34 * u },
      [t('settings.quality.high'), t('settings.quality.low')],
      s.quality === 'high' ? 0 : 1,
      (i) => this.set({ quality: i === 0 ? 'high' : 'low' }),
    );
    toggle(4, 'settings.shake', 'screenShake');
    toggle(5, 'settings.hints', 'hints');
    toggle(6, 'settings.largeUi', 'largeUi');
    y += rows * rowH;
    this.text(panel.x + pad, y + 6 * u, t('settings.qualityHint'), { size: 11, color: '#7d8aa8', origin: [0, 0], wrap: panel.w - 2 * pad });
  }

  /** Auswahl aus zwei oder mehr Feldern nebeneinander. */
  private segmented(rect: Rect, labels: string[], selected: number, onPick: (index: number) => void): void {
    const w = rect.w / labels.length;
    labels.forEach((text, i) => {
      const on = i === selected;
      this.button({ x: rect.x + i * w + 1, y: rect.y, w: w - 2, h: rect.h }, text, on ? 0x3a4f86 : 0x232c47, on ? '#ffffff' : '#9fb0d0', () => onPick(i), 14);
    });
  }
}
