import { audio } from '../audio';
import { REGISTRY_PROFILE, SCENE_KEYS } from '../config/constants';
import { clamp } from '../core/math';
import type { Profile } from '../core/profile';
import { t } from '../i18n';
import type { TextKey } from '../i18n';
import { PanelScene } from '../ui/PanelScene';
import type { Rect } from '../ui/PanelScene';

/** Die Erzählseiten des Abspanns; danach folgen Dank und Hinweis auf der letzten Seite. */
const PAGES: readonly TextKey[] = ['ending.page.1', 'ending.page.2', 'ending.page.3', 'ending.page.4', 'ending.page.5'];

/**
 * Abspann nach dem Finale am Ringtor: ein paar Erzählseiten (Tippen blättert weiter), dann Dank, Hinweis auf das
 * Fanprojekt und der Weg zurück zur Rocinante. Der Spielstand merkt sich, dass er gesehen wurde.
 */
export class EndingScene extends PanelScene {
  private page = 0;

  constructor() {
    super(SCENE_KEYS.ending);
  }

  create(): void {
    this.page = 0;
    this.cameras.main.setBackgroundColor(0x05070d);
    const profile = this.registry.get(REGISTRY_PROFILE) as Profile | undefined;
    if (profile && !profile.endingSeen) {
      profile.endingSeen = true;
      profile.touch();
    }
    audio.setMusic('hub');
    this.setupPanel(false);
    this.input.on('pointerdown', this.next, this);
    this.input.keyboard?.on('keydown-SPACE', this.next, this);
    this.input.keyboard?.on('keydown-ENTER', this.next, this);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', this.next, this);
      this.input.keyboard?.off('keydown-SPACE', this.next, this);
      this.input.keyboard?.off('keydown-ENTER', this.next, this);
    });
    this.cameras.main.fadeIn(900, 5, 7, 13);
    this.refresh();
  }

  /** Letzte Seite: Dank und Rückweg. */
  private get last(): boolean {
    return this.page >= PAGES.length;
  }

  private next(): void {
    if (this.last) return;
    this.page++;
    this.cameras.main.fadeIn(500, 5, 7, 13);
    this.refresh();
  }

  private leave(): void {
    this.scene.start(SCENE_KEYS.hub);
  }

  protected render(): void {
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const textW = clamp(W * 0.8, 260 * u, 640 * u);

    if (!this.last) {
      this.text(W / 2, H / 2, t(PAGES[this.page] as TextKey), { size: clamp(H / u / 22, 16, 22), color: '#dbe4f5', origin: [0.5, 0.5], wrap: textW, align: 'center' });
      this.text(W / 2, H - 28 * u, t('ending.next', { n: this.page + 1, total: PAGES.length + 1 }), { size: 12, color: '#56637f', origin: [0.5, 0.5] });
      return;
    }

    this.text(W / 2, H * 0.16, t('title.name'), { size: 32, bold: true, color: '#ffd34d', origin: [0.5, 0.5] });
    this.text(W / 2, H * 0.27, t('ending.thanks'), { size: 20, bold: true, color: '#dbe4f5', origin: [0.5, 0.5], wrap: textW, align: 'center' });
    this.text(W / 2, H * 0.46, t('ending.credits'), { size: 14, color: '#9fb0d0', origin: [0.5, 0.5], wrap: textW, align: 'center' });
    this.text(W / 2, H * 0.66, t('ending.continue'), { size: 14, color: '#7d8aa8', origin: [0.5, 0.5], wrap: textW, align: 'center' });
    const button: Rect = { x: W / 2 - 150 * u, y: H * 0.8, w: 300 * u, h: 46 * u };
    this.button(button, t('ending.back'), 0x2c6b4a, '#ffffff', () => this.leave(), 16);
  }
}
