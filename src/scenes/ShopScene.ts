import { REGISTRY_PROFILE, SCENE_KEYS } from '../config/constants';
import { COLORS } from '../config/palette';
import { progressSeed } from '../core/contracts';
import { clamp } from '../core/math';
import type { Profile } from '../core/profile';
import { createRng } from '../core/rng';
import { buy, generateStock } from '../core/shop';
import type { BuyResult, ShopOffer } from '../core/shop';
import { ITEM_RULES } from '../data/items';
import { RARITY_WEIGHTS } from '../data/loot';
import type { Player } from '../entities/Player';
import { t } from '../i18n';
import { PanelScene } from '../ui/PanelScene';
import type { Rect } from '../ui/PanelScene';
import { drawItemCell, drawItemInfo } from '../ui/itemWidgets';

/** Händler: ein Angebot aus sechs Gegenständen, das nach jeder abgeschlossenen Mission wechselt. */
export class ShopScene extends PanelScene {
  private parent: string = SCENE_KEYS.hub;
  private profile!: Profile;
  private player!: Player;
  private stock: ShopOffer[] = [];
  private selected = -1;
  private message: BuyResult | null = null;

  constructor() {
    super(SCENE_KEYS.shop);
  }

  init(data?: { parent: string }): void {
    this.parent = data?.parent ?? SCENE_KEYS.hub;
  }

  create(): void {
    this.profile = this.registry.get(REGISTRY_PROFILE) as Profile;
    this.player = (this.scene.get(this.parent) as unknown as { player: Player }).player;
    const rng = createRng(progressSeed(this.profile.missionsCompleted, 2));
    this.stock = generateStock(rng, ITEM_RULES, this.profile.progression.level, RARITY_WEIGHTS.chest);
    this.selected = -1;
    this.message = null;

    this.setupPanel(true);
    this.input.keyboard?.on('keydown-ESC', this.close, this);
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', this.close, this));
    this.refresh();
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(this.parent);
  }

  private select(index: number): void {
    this.selected = this.selected === index ? -1 : index;
    this.message = null;
    this.refresh();
  }

  private purchase(offer: ShopOffer): void {
    this.message = buy(this.profile, offer);
    if (this.message === 'ok') {
      this.selected = -1;
      this.message = null;
    }
    this.refresh();
  }

  protected render(): void {
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const m = 12 * u;
    const pad = 14 * u;
    const gap = 8 * u;
    const titleH = 44 * u;
    const panel: Rect = { x: m, y: m, w: W - 2 * m, h: H - 2 * m };
    this.frame(panel);
    this.text(panel.x + pad, panel.y + titleH / 2, t('shop.title'), { size: 20, bold: true, color: '#dbe4f5', origin: [0, 0.5] });
    this.text(panel.x + panel.w - 60 * u, panel.y + titleH / 2, t('inv.credits', { amount: this.profile.wallet.credits }), {
      size: 14,
      bold: true,
      color: COLORS.credits,
      origin: [1, 0.5],
    });
    this.closeButton({ x: panel.x + panel.w - 46 * u, y: panel.y + 4 * u, w: 40 * u, h: 40 * u }, () => this.close());

    const inner: Rect = { x: panel.x + pad, y: panel.y + titleH, w: panel.w - 2 * pad, h: panel.h - titleH - pad };
    const landscape = W >= H * 1.15;
    const cols = 3;
    const rows = Math.ceil(this.stock.length / cols);
    const cell = clamp(
      landscape ? Math.min((inner.h - rows * (18 * u + gap)) / rows, (inner.w * 0.42 - (cols - 1) * gap) / cols) : (inner.w - (cols - 1) * gap) / cols,
      56 * u,
      96 * u,
    );
    // Unter jeder Zelle steht der Preis.
    const labelH = 18 * u;
    const rowH = cell + labelH + gap;
    const gridW = cols * cell + (cols - 1) * gap;
    const gridH = rows * rowH - gap;
    const gridX = inner.x;
    const gridY = inner.y;

    this.stock.forEach((offer, i) => {
      const rect: Rect = { x: gridX + (i % cols) * (cell + gap), y: gridY + Math.floor(i / cols) * rowH, w: cell, h: cell };
      const sold = this.profile.shopBought.has(offer.item.id);
      drawItemCell(this, rect, offer.item, i === this.selected, undefined, sold);
      this.text(rect.x + rect.w / 2, rect.y + rect.h + 3 * u, sold ? t('shop.sold') : t('shop.price', { price: offer.price }), {
        size: 11,
        bold: true,
        color: sold ? '#7d8aa8' : this.profile.wallet.credits >= offer.price ? COLORS.credits : '#ff8a8a',
        origin: [0.5, 0],
      });
      if (!sold) this.hits.push({ rect, action: () => this.select(i) });
    });

    const detail: Rect = landscape
      ? { x: gridX + gridW + pad, y: inner.y, w: inner.x + inner.w - (gridX + gridW + pad), h: inner.h }
      : { x: inner.x, y: gridY + gridH + pad, w: inner.w, h: inner.y + inner.h - (gridY + gridH + pad) };

    const offer = this.stock[this.selected];
    if (!offer) {
      this.text(detail.x, detail.y + 4 * u, t('shop.hint'), { size: 13, color: '#9fb0d0', origin: [0, 0], wrap: detail.w });
      return;
    }
    this.drawOffer(detail, offer);
  }

  private drawOffer(rect: Rect, offer: ShopOffer): void {
    const u = this.u;
    const btnH = 42 * u;
    drawItemInfo(this, rect, offer.item, {
      equipped: false,
      equippedItems: this.profile.inventory.equippedItems(),
      player: this.player,
      maxY: rect.y + rect.h - btnH - 30 * u,
    });

    if (this.message && this.message !== 'ok') {
      const text = this.message === 'no-credits' ? t('shop.noCredits') : this.message === 'bag-full' ? t('shop.bagFull') : t('shop.sold');
      this.text(rect.x, rect.y + rect.h - btnH - 8 * u, text, { size: 13, bold: true, color: '#ff8a8a', origin: [0, 1] });
    }
    const affordable = this.profile.wallet.credits >= offer.price;
    this.button(
      { x: rect.x, y: rect.y + rect.h - btnH, w: rect.w, h: btnH },
      t('shop.buy', { price: offer.price }),
      affordable ? 0x2c6b4a : 0x3a2a2a,
      affordable ? '#ffffff' : '#c99',
      () => this.purchase(offer),
      15,
    );
  }
}
