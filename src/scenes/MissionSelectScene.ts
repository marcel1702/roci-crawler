import { REGISTRY_PROFILE, SCENE_KEYS } from '../config/constants';
import { DIFFICULTY_RULES, contractSalt, generateContracts, progressSeed } from '../core/contracts';
import type { Contract } from '../core/contracts';
import { clamp } from '../core/math';
import { highestUnlockedAct, mainMission } from '../core/story';
import type { MainMission } from '../core/story';
import type { Profile } from '../core/profile';
import { createRng } from '../core/rng';
import { actDef, actText } from '../data/acts';
import { t } from '../i18n';
import type { TextKey } from '../i18n';
import { PanelScene, hex } from '../ui/PanelScene';
import type { Rect } from '../ui/PanelScene';
import type { MissionConfig } from './MissionScene';

/** Missionskonsole: pro Akt drei Aufträge (zwei normale, ein schwerer), die nach jeder Mission wechseln, und der Hauptauftrag mit dem Boss. */
export class MissionSelectScene extends PanelScene {
  private parent: string = SCENE_KEYS.hub;
  private profile!: Profile;
  private contracts: Contract[] = [];
  /** Gewählter Akt (1-basiert); zu Beginn der höchste freigeschaltete. */
  private act = 1;

  constructor() {
    super(SCENE_KEYS.missionSelect);
  }

  init(data?: { parent: string }): void {
    this.parent = data?.parent ?? SCENE_KEYS.hub;
  }

  create(): void {
    this.profile = this.registry.get(REGISTRY_PROFILE) as Profile;
    this.selectAct(highestUnlockedAct(this.profile.actsCleared));
    this.setupPanel(true);
    this.input.keyboard?.on('keydown-ESC', this.close, this);
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', this.close, this));
    this.refresh();
  }

  /** Wechselt den Akt und würfelt seine Aufträge (gleicher Spielstand, gleiche Aufträge). */
  private selectAct(act: number): void {
    this.act = act;
    this.contracts = generateContracts(createRng(progressSeed(this.profile.missionsCompleted, contractSalt(act))));
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(this.parent);
  }

  private start(contract: Contract): void {
    this.launch({
      kind: 'dungeon',
      seed: contract.seed,
      act: this.act,
      difficulty: contract.difficulty,
      briefingKey: actText(this.act, `briefing.${contract.location}`),
    });
  }

  /** Hauptauftrag: der Boss des Akts in einem Dungeon mit festem Seed; ein erneuter Kampf gilt als schwer. */
  private startBoss(main: MainMission): void {
    const act = actDef(main.act);
    this.launch({
      kind: 'dungeon',
      seed: act.bossSeed,
      act: act.id,
      difficulty: main.status === 'repeat' ? 'hard' : 'normal',
      boss: act.boss,
      briefingKey: actText(act.id, 'boss.briefing'),
    });
  }

  private launch(config: MissionConfig): void {
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
    this.drawActTabs(panel.x + panel.w - 56 * u, panel.y + titleH / 2);

    const inner: Rect = { x: panel.x + pad, y: panel.y + titleH, w: panel.w - 2 * pad, h: panel.h - titleH - pad };
    const landscape = W >= H * 1.15;
    const n = this.contracts.length;
    const mainH = (landscape ? (H < 420 * u ? 78 : 84) : 148) * u;
    const cardsArea = inner.h - mainH - gap;
    const cardW = landscape ? (inner.w - (n - 1) * gap) / n : inner.w;
    const cardH = landscape ? Math.min(cardsArea, 260 * u) : clamp((cardsArea - (n - 1) * gap) / n, 96 * u, 190 * u);

    this.contracts.forEach((contract, i) => {
      const rect: Rect = landscape
        ? { x: inner.x + i * (cardW + gap), y: inner.y, w: cardW, h: cardH }
        : { x: inner.x, y: inner.y + i * (cardH + gap), w: cardW, h: cardH };
      this.drawCard(rect, contract, landscape && cardH >= 215 * u);
    });

    const cardsBottom = landscape ? inner.y + cardH : inner.y + n * cardH + (n - 1) * gap;
    this.drawMain({ x: inner.x, y: Math.min(cardsBottom + gap, inner.y + inner.h - mainH), w: inner.w, h: mainH }, landscape);
  }

  /** Reiter für die freigeschalteten Akte (erst ab Akt 2 sichtbar), rechts neben dem Titel. */
  private drawActTabs(right: number, centerY: number): void {
    const unlocked = highestUnlockedAct(this.profile.actsCleared);
    if (unlocked < 2) return;
    const u = this.u;
    const w = 64 * u;
    const h = 30 * u;
    for (let act = unlocked; act >= 1; act--) {
      const x = right - (unlocked - act + 1) * w - (unlocked - act) * 6 * u;
      const rect: Rect = { x, y: centerY - h / 2, w, h };
      const selected = act === this.act;
      this.button(rect, t('contract.actLabel', { act }), selected ? 0x3a4f86 : 0x232c47, selected ? '#ffffff' : '#9fb0d0', () => {
        if (this.act === act) return;
        this.selectAct(act);
        this.refresh();
      }, 13);
    }
  }

  /** Hauptauftrag: gesperrt, bis genug Missionen im Akt geschafft sind; danach der Boss. */
  private drawMain(rect: Rect, wide: boolean): void {
    const u = this.u;
    const pad = 12 * u;
    const main = mainMission(this.act, this.profile.actsCleared, this.profile.actMissions);
    const locked = main.status === 'locked';
    const color = locked ? 0x56637f : main.status === 'ready' ? 0xffd34d : 0x5ad66f;
    const g = this.gfx;
    g.fillStyle(0x1a2340, 1).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 10 * u);
    g.lineStyle(2 * u, color, locked ? 0.7 : 1).strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 10 * u);

    const btnW = wide ? Math.min(rect.w * 0.3, 240 * u) : rect.w - 2 * pad;
    const btnH = 38 * u;
    const textW = wide ? rect.w - btnW - 3 * pad : rect.w - 2 * pad;
    this.text(rect.x + pad, rect.y + pad * 0.8, t('contract.main.title', { act: main.act }), { size: 11, color: '#7d8aa8', origin: [0, 0] });
    this.text(rect.x + pad, rect.y + pad * 0.8 + 15 * u, t(actText(main.act, 'boss.name')), { size: 16, bold: true, color: locked ? '#9fb0d0' : hex(color), origin: [0, 0], wrap: textW });
    const info = locked
      ? t('contract.main.locked', { n: main.remaining })
      : main.status === 'repeat'
        ? t('contract.main.cleared', { act: main.act }) + t(main.allCleared ? 'contract.main.more' : 'contract.main.next')
        : t(actText(main.act, 'boss.text'));
    this.text(rect.x + pad, rect.y + pad * 0.8 + 38 * u, info, { size: 12, color: locked ? '#7d8aa8' : '#c9d4ee', origin: [0, 0], wrap: textW });
    if (locked) return;

    const btn: Rect = wide
      ? { x: rect.x + rect.w - btnW - pad, y: rect.y + (rect.h - btnH) / 2, w: btnW, h: btnH }
      : { x: rect.x + pad, y: rect.y + rect.h - btnH - pad * 0.8, w: btnW, h: btnH };
    this.button(btn, t(main.status === 'repeat' ? 'contract.main.repeat' : actText(main.act, 'boss.action')), 0x7a5a12, '#ffffff', () => this.startBoss(main), 14);
  }

  private drawCard(rect: Rect, contract: Contract, tall: boolean): void {
    const u = this.u;
    const pad = 12 * u;
    const hard = contract.difficulty === 'hard';
    const color = hard ? 0xe0603a : 0x5ad66f;
    const g = this.gfx;
    g.fillStyle(0x1a2340, 1).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 10 * u);
    g.lineStyle(2 * u, color, 0.9).strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 10 * u);

    this.text(rect.x + pad, rect.y + pad, t('contract.actLabel', { act: this.act }), { size: 11, color: '#7d8aa8', origin: [0, 0] });
    this.text(rect.x + pad, rect.y + pad + 16 * u, t(actText(this.act, `location.${contract.location}`)), {
      size: 17,
      bold: true,
      color: '#ffffff',
      origin: [0, 0],
      wrap: rect.w - 2 * pad,
    });
    this.text(rect.x + pad, rect.y + pad + (tall ? 64 : 44) * u, t(`contract.${contract.difficulty}` as TextKey), { size: 14, bold: true, color: hex(color), origin: [0, 0] });
    const recommended = Math.max(this.profile.progression.level, actDef(this.act).baseLevel) + (hard ? 1 : 0);
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
