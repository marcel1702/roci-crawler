import { REGISTRY_PROFILE, SCENE_KEYS } from '../config/constants';
import { COLORS } from '../config/palette';
import { BRANCH_COUNT, TIER_UNLOCK, availablePoints, canRankUp, isUnlocked, rankOf, rankUp, respecCost, spentInBranch } from '../core/talents';
import type { TalentNode } from '../core/talents';
import type { Profile } from '../core/profile';
import { CLASS_LIST } from '../data/classes';
import type { Player } from '../entities/Player';
import { t } from '../i18n';
import type { TextKey } from '../i18n';
import { talentLines, talentName } from '../i18n/talents';
import { PanelScene, hex } from '../ui/PanelScene';
import type { Rect } from '../ui/PanelScene';

const TIERS = 4;

/** Talentbaum der gewählten Figur: drei Zweige mit je vier Reihen. Zurücksetzen nur im Hub (kostet Credits). */
export class TalentScene extends PanelScene {
  private parent: string = SCENE_KEYS.hub;
  private profile!: Profile;
  private player!: Player;
  private selectedId: string | null = null;
  private confirmReset = false;
  private message: string | null = null;

  constructor() {
    super(SCENE_KEYS.talents);
  }

  init(data?: { parent: string }): void {
    this.parent = data?.parent ?? SCENE_KEYS.hub;
  }

  create(): void {
    this.profile = this.registry.get(REGISTRY_PROFILE) as Profile;
    this.player = (this.scene.get(this.parent) as unknown as { player: Player }).player;
    this.selectedId = null;
    this.confirmReset = false;
    this.message = null;
    this.setupPanel(true);
    this.input.keyboard?.on('keydown-ESC', this.close, this);
    this.input.keyboard?.on('keydown-T', this.close, this);
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown-ESC', this.close, this);
      this.input.keyboard?.off('keydown-T', this.close, this);
    });
    this.refresh();
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(this.parent);
  }

  private get tree() {
    return this.player.talentTree;
  }

  private select(id: string): void {
    this.selectedId = this.selectedId === id ? null : id;
    this.confirmReset = false;
    this.message = null;
    this.refresh();
  }

  private raise(node: TalentNode): void {
    const next = rankUp(this.tree, this.profile.talents, node.id, this.player.progression.level);
    if (!next) return;
    this.profile.talents = next;
    this.player.refreshStats();
    this.profile.touch();
    this.message = null;
    this.refresh();
  }

  private reset(): void {
    const cost = respecCost(this.player.progression.level);
    if (!this.confirmReset) {
      this.confirmReset = true;
      this.refresh();
      return;
    }
    this.confirmReset = false;
    if (this.profile.wallet.credits < cost) {
      this.message = t('talent.noCredits');
    } else {
      this.profile.wallet.credits -= cost;
      this.profile.talents = {};
      this.selectedId = null;
      this.player.refreshStats();
      this.profile.touch();
    }
    this.refresh();
  }

  protected render(): void {
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const m = 12 * u;
    const pad = 12 * u;
    const gap = 6 * u;
    const titleH = 44 * u;
    const panel: Rect = { x: m, y: m, w: W - 2 * m, h: H - 2 * m };
    const classInfo = CLASS_LIST.find((c) => c.id === this.player.classDef.id);
    const accent = classInfo?.color ?? COLORS.accent;
    const points = availablePoints(this.tree, this.profile.talents, this.player.progression.level);

    this.frame(panel);
    this.text(panel.x + pad, panel.y + titleH / 2, t('talent.title'), { size: 20, bold: true, color: '#dbe4f5', origin: [0, 0.5] });
    this.text(panel.x + panel.w - 58 * u, panel.y + titleH / 2, t('talent.points', { count: points }), {
      size: 15,
      bold: true,
      color: points > 0 ? '#8dffb0' : '#7d8aa8',
      origin: [1, 0.5],
    });
    this.closeButton({ x: panel.x + panel.w - 46 * u, y: panel.y + 4 * u, w: 40 * u, h: 40 * u }, () => this.close());

    const inner: Rect = { x: panel.x + pad, y: panel.y + titleH, w: panel.w - 2 * pad, h: panel.h - titleH - pad };
    const landscape = W >= H * 1.15;
    const detailW = landscape ? Math.min(inner.w * 0.38, 330 * u) : inner.w;
    const detailH = landscape ? inner.h : 250 * u;
    const treeRect: Rect = landscape
      ? { x: inner.x, y: inner.y, w: inner.w - detailW - pad, h: inner.h }
      : { x: inner.x, y: inner.y, w: inner.w, h: inner.h - detailH - pad };
    const detail: Rect = landscape
      ? { x: inner.x + inner.w - detailW, y: inner.y, w: detailW, h: detailH }
      : { x: inner.x, y: inner.y + inner.h - detailH, w: inner.w, h: detailH };

    // Drei Spalten, vier Reihen
    const headerH = 22 * u;
    const colW = (treeRect.w - (BRANCH_COUNT - 1) * gap) / BRANCH_COUNT;
    const cellH = Math.min((treeRect.h - headerH - (TIERS - 1) * gap) / TIERS, 64 * u);
    for (let branch = 0; branch < BRANCH_COUNT; branch++) {
      const x = treeRect.x + branch * (colW + gap);
      const spent = spentInBranch(this.tree, this.profile.talents, branch);
      this.text(x + colW / 2, treeRect.y + headerH / 2, `${t(this.tree.branches[branch] as TextKey)}  ${spent}`, {
        size: 13,
        bold: true,
        color: hex(accent),
        origin: [0.5, 0.5],
      });
      for (let tier = 1; tier <= TIERS; tier++) {
        const node = this.tree.nodes.find((n) => n.branch === branch && n.tier === tier);
        if (!node) continue;
        const rect: Rect = { x, y: treeRect.y + headerH + (tier - 1) * (cellH + gap), w: colW, h: cellH };
        if (tier > 1) {
          this.gfx.lineStyle(Math.max(2, u * 2), COLORS.uiDim, 0.5).lineBetween(x + colW / 2, rect.y - gap, x + colW / 2, rect.y);
        }
        this.drawNode(rect, node, accent);
      }
    }

    this.drawDetail(detail, accent);
  }

  private drawNode(rect: Rect, node: TalentNode, accent: number): void {
    const u = this.u;
    const rank = rankOf(this.profile.talents, node.id);
    const unlocked = isUnlocked(this.tree, this.profile.talents, node);
    const maxed = rank >= node.maxRank;
    const selected = this.selectedId === node.id;
    const g = this.gfx;
    const color = maxed ? 0xffd34d : rank > 0 ? accent : COLORS.uiDim;
    const alpha = unlocked ? 1 : 0.4;

    g.fillStyle(rank > 0 ? color : 0x1a2340, rank > 0 ? 0.2 : 0.7 * alpha).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 8 * u);
    g.lineStyle(selected ? 3 * u : Math.max(1, 1.5 * u), selected ? COLORS.accent : color, (rank > 0 || selected ? 1 : 0.6) * alpha);
    g.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 8 * u);

    const narrow = rect.w < 130 * u;
    this.text(rect.x + 7 * u, rect.y + 6 * u, talentName(node), {
      size: narrow ? 10 : 12,
      bold: true,
      color: unlocked ? '#ffffff' : '#7d8aa8',
      origin: [0, 0],
      wrap: rect.w - 14 * u,
    });
    this.text(rect.x + rect.w - 7 * u, rect.y + rect.h - 5 * u, `${rank}/${node.maxRank}`, {
      size: narrow ? 10 : 12,
      bold: true,
      color: maxed ? '#ffd34d' : rank > 0 ? '#ffffff' : '#7d8aa8',
      origin: [1, 1],
    });
    this.hits.push({ rect, action: () => this.select(node.id) });
  }

  private drawDetail(rect: Rect, accent: number): void {
    const u = this.u;
    const node = this.selectedId ? this.tree.nodes.find((n) => n.id === this.selectedId) : null;
    const level = this.player.progression.level;
    const inHub = this.parent === SCENE_KEYS.hub;
    const btnH = 40 * u;

    this.gfx.fillStyle(0x1a2340, 0.7).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 10 * u);
    const pad = 12 * u;
    let y = rect.y + pad;
    const x = rect.x + pad;
    const w = rect.w - 2 * pad;

    if (!node) {
      this.text(x, y, t('talent.hint'), { size: 13, color: '#9fb0d0', origin: [0, 0], wrap: w });
    } else {
      const rank = rankOf(this.profile.talents, node.id);
      this.text(x, y, talentName(node), { size: 17, bold: true, color: hex(accent), origin: [0, 0], wrap: w });
      y += 26 * u;
      this.text(x, y, t('talent.rank', { rank, max: node.maxRank }), { size: 12, color: '#9fb0d0', origin: [0, 0] });
      y += 22 * u;
      this.text(x, y, t('talent.perRank'), { size: 12, color: '#7d8aa8', origin: [0, 0] });
      y += 18 * u;
      for (const line of talentLines(node, this.player.classDef)) {
        this.text(x, y, line, { size: 13, color: '#dbe4f5', origin: [0, 0], wrap: w });
        y += 20 * u;
      }

      const maxed = rank >= node.maxRank;
      const unlocked = isUnlocked(this.tree, this.profile.talents, node);
      const can = canRankUp(this.tree, this.profile.talents, node.id, level);
      let note: string | null = null;
      if (maxed) note = t('talent.maxed');
      else if (!unlocked) note = t('talent.locked', { need: TIER_UNLOCK[node.tier] ?? 0, have: spentInBranch(this.tree, this.profile.talents, node.branch) });
      else if (!can) note = t('talent.noPoints');
      if (note) this.text(x, y + 4 * u, note, { size: 12, color: maxed ? '#ffd34d' : '#ff9a8a', origin: [0, 0], wrap: w });
      this.button({ x, y: rect.y + rect.h - 2 * btnH - pad - 6 * u, w, h: btnH }, t('talent.rankUp'), can ? 0x2c6b4a : 0x1a2340, can ? '#ffffff' : '#5d6b8c', can ? () => this.raise(node) : null, 14);
    }

    // Zurücksetzen
    const cost = respecCost(level);
    const hasTalents = Object.keys(this.profile.talents).length > 0;
    const label = !inHub ? t('talent.resetHub') : this.confirmReset ? t('talent.resetConfirm') : t('talent.reset', { cost });
    const enabled = inHub && hasTalents;
    this.button(
      { x, y: rect.y + rect.h - btnH - pad, w, h: btnH },
      label,
      this.confirmReset ? 0x7a2b2b : 0x2a3556,
      enabled ? '#dbe4f5' : '#5d6b8c',
      enabled ? () => this.reset() : null,
      13,
    );
    if (this.message) this.text(x, rect.y + rect.h - btnH - pad - 4 * u, this.message, { size: 12, bold: true, color: '#ff8a8a', origin: [0, 1] });
  }
}
