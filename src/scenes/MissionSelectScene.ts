import { REGISTRY_PROFILE, SCENE_KEYS } from '../config/constants';
import { DIFFICULTY_RULES, generateContracts, progressSeed } from '../core/contracts';
import type { Contract } from '../core/contracts';
import { clamp } from '../core/math';
import type { Profile } from '../core/profile';
import { createRng } from '../core/rng';
import { t } from '../i18n';
import type { TextKey } from '../i18n';
import { PanelScene, hex } from '../ui/PanelScene';
import type { Rect } from '../ui/PanelScene';
import type { MissionConfig } from './MissionScene';

/** Missionskonsole: drei Aufträge zur Wahl (zwei normale, ein schwerer); sie wechseln nach jeder Mission. */
export class MissionSelectScene extends PanelScene {
  private parent: string = SCENE_KEYS.hub;
  private profile!: Profile;
  private contracts: Contract[] = [];

  constructor() {
    super(SCENE_KEYS.missionSelect);
  }

  init(data?: { parent: string }): void {
    this.parent = data?.parent ?? SCENE_KEYS.hub;
  }

  create(): void {
    this.profile = this.registry.get(REGISTRY_PROFILE) as Profile;
    this.contracts = generateContracts(createRng(progressSeed(this.profile.missionsCompleted, 1)));
    this.setupPanel(true);
    this.input.keyboard?.on('keydown-ESC', this.close, this);
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', this.close, this));
    this.refresh();
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(this.parent);
  }

  private start(contract: Contract): void {
    const config: MissionConfig = { kind: 'dungeon', seed: contract.seed, difficulty: contract.difficulty };
    this.scene.stop(this.parent);
    this.scene.start(SCENE_KEYS.mission, config);
  }

  protected render(): void {
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const m = 12 * u;
    const pad = 14 * u;
    const gap = 10 * u;
    const titleH = 44 * u;
    const panel: Rect = { x: m, y: m, w: W - 2 * m, h: H - 2 * m };
    this.frame(panel);
    this.text(panel.x + pad, panel.y + titleH / 2, t('contract.title'), { size: 20, bold: true, color: '#dbe4f5', origin: [0, 0.5] });
    this.closeButton({ x: panel.x + panel.w - 46 * u, y: panel.y + 4 * u, w: 40 * u, h: 40 * u }, () => this.close());

    const inner: Rect = { x: panel.x + pad, y: panel.y + titleH, w: panel.w - 2 * pad, h: panel.h - titleH - pad };
    const landscape = W >= H * 1.15;
    const n = this.contracts.length;
    const cardW = landscape ? (inner.w - (n - 1) * gap) / n : inner.w;
    const cardH = landscape ? Math.min(inner.h, 320 * u) : clamp((inner.h - (n - 1) * gap) / n, 110 * u, 200 * u);

    this.contracts.forEach((contract, i) => {
      const rect: Rect = landscape
        ? { x: inner.x + i * (cardW + gap), y: inner.y, w: cardW, h: cardH }
        : { x: inner.x, y: inner.y + i * (cardH + gap), w: cardW, h: cardH };
      this.drawCard(rect, contract, landscape);
    });
  }

  private drawCard(rect: Rect, contract: Contract, tall: boolean): void {
    const u = this.u;
    const pad = 12 * u;
    const hard = contract.difficulty === 'hard';
    const color = hard ? 0xe0603a : 0x5ad66f;
    const g = this.gfx;
    g.fillStyle(0x1a2340, 1).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 10 * u);
    g.lineStyle(2 * u, color, 0.9).strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 10 * u);

    this.text(rect.x + pad, rect.y + pad, t('contract.act'), { size: 11, color: '#7d8aa8', origin: [0, 0] });
    this.text(rect.x + pad, rect.y + pad + 16 * u, t(`contract.location.${contract.location}` as TextKey), {
      size: 17,
      bold: true,
      color: '#ffffff',
      origin: [0, 0],
      wrap: rect.w - 2 * pad,
    });
    this.text(rect.x + pad, rect.y + pad + (tall ? 64 : 44) * u, t(`contract.${contract.difficulty}` as TextKey), { size: 14, bold: true, color: hex(color), origin: [0, 0] });
    const recommended = this.profile.progression.level + (hard ? 1 : 0);
    this.text(rect.x + pad, rect.y + pad + (tall ? 86 : 64) * u, t('contract.recommended', { level: recommended }), { size: 12, color: '#9fb0d0', origin: [0, 0] });
    const rules = DIFFICULTY_RULES[contract.difficulty];
    this.text(rect.x + pad, rect.y + pad + (tall ? 106 : 82) * u, hard ? t('contract.hardBonus') : t('contract.normalInfo'), {
      size: 12,
      color: rules.loot > 1 ? '#ffd34d' : '#7d8aa8',
      origin: [0, 0],
      wrap: rect.w - 2 * pad,
    });

    const btn: Rect = { x: rect.x + pad, y: rect.y + rect.h - 40 * u - pad * 0.8, w: rect.w - 2 * pad, h: 40 * u };
    this.button(btn, t('contract.start'), hard ? 0x8a3b24 : 0x2c6b4a, '#ffffff', () => this.start(contract), 15);
    // Auch die ganze Karte startet den Auftrag (große Trefferfläche für Finger); der Knopf liegt darüber.
    this.hits.unshift({ rect, action: () => this.start(contract) });
  }
}
