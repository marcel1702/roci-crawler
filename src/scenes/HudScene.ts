import Phaser from 'phaser';
import { GAME_EVENTS, REGISTRY_KEYS, SCENE_KEYS, TILE_SIZE } from '../config/constants';
import { COLORS } from '../config/palette';
import type { Cooldown } from '../core/cooldown';
import { clamp } from '../core/math';
import type { Player } from '../entities/Player';
import { t } from '../i18n';
import type { TextKey } from '../i18n';
import { readSafeArea } from '../platform/safeArea';
import { MINIMAP_KEY } from '../systems/FogSystem';
import { AbilityButton } from '../ui/AbilityButton';
import { ResourceBar } from '../ui/ResourceBar';
import type { MissionScene, MissionStats } from './MissionScene';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const HINT_VISIBLE_MS = 7000;
const TARGET_LINGER_MS = 1200;
const RETRY_DELAY_MS = 700;
const BANNER_MS = 2200;

/**
 * Bedienoberfläche über der Mission. Alle Maße sind in CSS-Pixeln gedacht und werden mit dem
 * Pixelverhältnis `u` auf die (devicePixelRatio-mal größere) Spielfläche umgerechnet.
 */
export class HudScene extends Phaser.Scene {
  private u = 1;
  private player: Player | null = null;
  private mission: MissionScene | null = null;
  /** Wo die Figur gerade ist: im Hub (nur Leisten, Rucksack, Credits) oder in einer Mission (alle Tasten). */
  private world: 'hub' | 'mission' = 'mission';
  private creditsText!: Phaser.GameObjects.Text;

  private playerBar!: ResourceBar;
  private xpBar!: ResourceBar;
  private playerName!: Phaser.GameObjects.Text;
  private playerHp!: Phaser.GameObjects.Text;
  private targetBar!: ResourceBar;
  private targetName!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private minimapPanel!: Phaser.GameObjects.Graphics;
  private minimapMarkers!: Phaser.GameObjects.Graphics;
  private minimapImage: Phaser.GameObjects.Image | null = null;
  private minimapRect = { x: 0, y: 0, w: 0, h: 0, scale: 1 };
  private abilityButtons: AbilityButton[] = [];
  private potionButton!: AbilityButton;
  private bagButton!: AbilityButton;
  private hint!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private overlayShade!: Phaser.GameObjects.Rectangle;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlayLabels!: Phaser.GameObjects.Text;
  private overlayValues!: Phaser.GameObjects.Text;
  private overlayHint!: Phaser.GameObjects.Text;
  private fpsText: Phaser.GameObjects.Text | null = null;

  private shownTargetUntil = 0;
  private lastHpText = '';
  private lastNameText = '';
  /** Tot oder Mission vorbei: Tasten sind gesperrt, ein Tipp startet neu. */
  private locked = false;

  constructor() {
    super(SCENE_KEYS.hud);
  }

  create(): void {
    this.abilityButtons = [];
    this.player = null;
    this.mission = null;
    this.minimapImage = null;
    this.shownTargetUntil = 0;
    this.lastHpText = '';
    this.lastNameText = '';
    this.locked = false;

    this.playerBar = new ResourceBar(this, COLORS.hpFill);
    this.xpBar = new ResourceBar(this, COLORS.xp);
    this.playerName = this.makeText({ fontStyle: 'bold', color: '#dbe4f5' }).setOrigin(0, 1);
    this.playerHp = this.makeText({ fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);

    this.targetBar = new ResourceBar(this, COLORS.hpFill);
    this.targetName = this.makeText({ fontStyle: 'bold', color: '#dbe4f5' }).setOrigin(0.5, 1);
    this.targetBar.setVisible(false);
    this.targetName.setVisible(false);

    this.waveText = this.makeText({ fontStyle: 'bold', color: '#7d8aa8' }).setOrigin(1, 0).setVisible(false);
    this.creditsText = this.makeText({ fontStyle: 'bold', color: COLORS.credits }).setOrigin(1, 0).setVisible(false);
    this.objectiveText = this.makeText({ fontStyle: 'bold', color: '#dbe4f5', align: 'right' }).setOrigin(1, 0).setVisible(false);
    this.minimapPanel = this.add.graphics();
    this.minimapMarkers = this.add.graphics();

    for (let i = 0; i < 3; i++) this.abilityButtons.push(new AbilityButton(this, COLORS.accent));
    this.potionButton = new AbilityButton(this, 0x6dff9a);
    this.potionButton.setIcon('potion');
    this.bagButton = new AbilityButton(this, COLORS.uiDim);
    this.bagButton.setIcon('bag');

    this.hint = this.makeText({ color: '#dbe4f5', align: 'center' }).setOrigin(0.5, 1).setText(t('hud.hint.controls'));
    this.banner = this.makeText({ fontStyle: 'bold', color: '#ffe08a', align: 'center' }).setOrigin(0.5).setVisible(false);

    this.overlayShade = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.6).setOrigin(0).setVisible(false);
    this.overlayTitle = this.makeText({ fontStyle: 'bold', color: '#ff8a8a', align: 'center' }).setOrigin(0.5);
    this.overlayLabels = this.makeText({ color: '#9fb0d0', align: 'right' }).setOrigin(1, 0);
    this.overlayValues = this.makeText({ fontStyle: 'bold', color: '#ffffff', align: 'left' }).setOrigin(0, 0);
    this.overlayHint = this.makeText({ color: '#dbe4f5', align: 'center' }).setOrigin(0.5);
    this.setOverlayVisible(false);

    if (import.meta.env.DEV) {
      this.fpsText = this.makeText({ color: '#7d8aa8' }).setOrigin(0, 1);
    }

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.keyboard?.on('keydown-I', this.openInventory, this);
    const on = this.game.events;
    on.on(GAME_EVENTS.missionReady, this.onMissionReady, this);
    on.on(GAME_EVENTS.hubReady, this.onHubReady, this);
    on.on(GAME_EVENTS.waveStarted, this.onWaveStarted, this);
    on.on(GAME_EVENTS.waveCleared, this.onWaveCleared, this);
    on.on(GAME_EVENTS.playerLevelUp, this.onLevelUp, this);
    on.on(GAME_EVENTS.playerDied, this.onPlayerDied, this);
    on.on(GAME_EVENTS.objectiveChanged, this.onObjectiveChanged, this);
    on.on(GAME_EVENTS.missionCompleted, this.onMissionCompleted, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
      this.input.keyboard?.off('keydown-I', this.openInventory, this);
      on.off(GAME_EVENTS.missionReady, this.onMissionReady, this);
      on.off(GAME_EVENTS.hubReady, this.onHubReady, this);
      on.off(GAME_EVENTS.waveStarted, this.onWaveStarted, this);
      on.off(GAME_EVENTS.waveCleared, this.onWaveCleared, this);
      on.off(GAME_EVENTS.playerLevelUp, this.onLevelUp, this);
      on.off(GAME_EVENTS.playerDied, this.onPlayerDied, this);
      on.off(GAME_EVENTS.objectiveChanged, this.onObjectiveChanged, this);
      on.off(GAME_EVENTS.missionCompleted, this.onMissionCompleted, this);
    });

    // Beim ersten Start läuft MissionScene.create() vor diesem create(): das Ereignis wäre verpasst.
    const hub = this.scene.get(SCENE_KEYS.hub) as unknown as { player?: Player };
    const mission = this.scene.get(SCENE_KEYS.mission) as MissionScene;
    if (this.scene.isActive(SCENE_KEYS.hub) && hub.player) {
      this.onHubReady(hub.player);
    } else if (mission.sys.isActive() && mission.player) {
      this.onMissionReady(mission.player);
      if (mission.waveNumber > 0) this.onWaveStarted(mission.waveNumber);
    }
  }

  override update(time: number): void {
    this.fpsText?.setText(`${Math.round(this.game.loop.actualFps)} fps${this.seedLabel()}`);
    const player = this.player;
    if (!player) return;

    this.playerBar.setFraction(player.hp / player.stats.maxHp);
    this.xpBar.setFraction(player.progression.fraction);
    const hpText = t('hud.hp', { current: Math.ceil(player.hp), max: player.stats.maxHp });
    if (hpText !== this.lastHpText) {
      this.lastHpText = hpText;
      this.playerHp.setText(hpText);
    }
    const nameText = `${t(player.classDef.nameKey)}  ·  ${t('hud.level', { level: player.progression.level })}`;
    if (nameText !== this.lastNameText) {
      this.lastNameText = nameText;
      this.playerName.setText(nameText);
    }

    if (this.world === 'hub') {
      this.creditsText.setText(t('inv.credits', { amount: player.profile.wallet.credits }));
      this.targetBar.setVisible(false);
      this.targetName.setVisible(false);
      return;
    }

    player.abilities.forEach((slot, i) => {
      const button = this.abilityButtons[i];
      button?.setIcon(slot.def.icon);
      button?.setState(cooldownState(slot.cooldown, true));
    });
    this.potionButton.setState({
      ...cooldownState(player.potionCooldown, player.potions > 0 && player.hp < player.stats.maxHp),
      badge: player.potions,
    });

    const target = player.attackTarget;
    if (target && !target.isDead) this.shownTargetUntil = time + TARGET_LINGER_MS;
    const showTarget = !!target && !target.isDead && time < this.shownTargetUntil;
    this.targetBar.setVisible(showTarget);
    this.targetName.setVisible(showTarget);
    if (showTarget && target) {
      this.targetBar.setFraction(target.hp / target.stats.maxHp);
      this.targetName.setText(t(target.def.nameKey)).setColor(target.isElite ? COLORS.elite : '#dbe4f5');
    }

    this.drawMinimapMarkers();
  }

  /** True, wenn ein Bildschirmpunkt auf einem Bedienelement liegt (Tipp darf dann nicht laufen lassen). */
  isOverUi(screenX: number, screenY: number): boolean {
    const pad = 10 * this.u;
    const buttons = this.world === 'hub' ? [this.bagButton] : [...this.abilityButtons, this.potionButton, this.bagButton];
    return buttons.some((button) => button.contains(screenX, screenY, pad));
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const player = this.player;
    if (!player || this.locked || this.overlayOpen()) return;
    const pad = 6 * this.u;

    if (this.bagButton.contains(pointer.x, pointer.y, pad)) {
      this.bagButton.press();
      this.openInventory();
      return;
    }
    if (this.world === 'hub') return;
    const index = this.abilityButtons.findIndex((button) => button.contains(pointer.x, pointer.y, pad));
    if (index >= 0) {
      this.abilityButtons[index]?.press();
      player.useAbility(index);
    } else if (this.potionButton.contains(pointer.x, pointer.y, pad)) {
      this.potionButton.press();
      player.usePotion();
    }
  }

  /** True, solange Rucksack, Händler oder Auftragswahl offen sind: dann gehören alle Tipps dem Fenster. */
  private overlayOpen(): boolean {
    return [SCENE_KEYS.inventory, SCENE_KEYS.shop, SCENE_KEYS.missionSelect].some((key) => this.scene.isActive(key));
  }

  /** Öffnet Rucksack und Ausrüstung; die Welt (Hub oder Mission) pausiert, solange er offen ist. */
  private openInventory(): void {
    if (!this.player || this.locked || this.overlayOpen()) return;
    const parent = this.world === 'hub' ? SCENE_KEYS.hub : SCENE_KEYS.mission;
    this.scene.pause(parent);
    this.scene.launch(SCENE_KEYS.inventory, { parent });
  }

  private setCombatUi(visible: boolean): void {
    for (const button of [...this.abilityButtons, this.potionButton]) button.setVisible(visible);
  }

  private onHubReady(player: Player): void {
    this.player = player;
    this.mission = null;
    this.world = 'hub';
    this.locked = false;
    this.shownTargetUntil = 0;
    this.setOverlayVisible(false);
    this.banner.setVisible(false);
    this.setCombatUi(false);
    this.waveText.setVisible(false);
    this.objectiveText.setVisible(false);
    this.creditsText.setVisible(true);
    this.hint.setText(t('hub.hint')).setAlpha(1).setVisible(true);
    this.tweens.killTweensOf(this.hint);
    this.tweens.add({ targets: this.hint, alpha: 0, delay: HINT_VISIBLE_MS, duration: 800 });
    this.rebuildMinimap();
    this.layout();
  }

  private onMissionReady(player: Player): void {
    this.player = player;
    this.mission = this.scene.get(SCENE_KEYS.mission) as MissionScene;
    this.world = 'mission';
    this.setCombatUi(true);
    this.creditsText.setVisible(false);
    this.hint.setText(t('hud.hint.controls'));
    this.locked = false;
    this.shownTargetUntil = 0;
    this.setOverlayVisible(false);
    this.banner.setVisible(false);
    this.hint.setAlpha(1).setVisible(true);
    this.tweens.killTweensOf(this.hint);
    this.tweens.add({ targets: this.hint, alpha: 0, delay: HINT_VISIBLE_MS, duration: 800 });

    const isDungeon = this.mission.config.kind === 'dungeon';
    this.waveText.setVisible(!isDungeon);
    this.objectiveText.setVisible(isDungeon);
    this.rebuildMinimap();
    this.layout();
    if (this.mission.objectiveKey) this.onObjectiveChanged(this.mission.objectiveKey);
  }

  private onWaveStarted(wave: number): void {
    this.waveText.setText(t('hud.wave', { wave }));
  }

  private onWaveCleared(): void {
    this.showBanner(t('hud.waveCleared'), '#ffe08a');
  }

  private onLevelUp(level: number): void {
    this.showBanner(t('hud.levelUp', { level }), COLORS.elite);
  }

  private onObjectiveChanged(key: TextKey): void {
    this.objectiveText.setText(t(key));
  }

  private onPlayerDied(): void {
    this.locked = true;
    this.overlayTitle.setText(t('hud.death.title')).setColor('#ff8a8a');
    this.overlayLabels.setText('');
    this.overlayValues.setText('');
    this.overlayHint.setText(this.mission?.config.kind === 'arena' ? t('hud.death.retry') : t('hud.death.hub'));
    this.showOverlay();
  }

  private onMissionCompleted(stats: MissionStats): void {
    this.locked = true;
    this.overlayTitle.setText(t('hud.result.title')).setColor('#8dffb0');
    this.overlayLabels.setText(
      [
        t('hud.result.time'),
        t('hud.result.kills'),
        t('hud.result.chests'),
        t('hud.result.items'),
        t('hud.result.credits'),
        t('hud.result.xp'),
      ].join('\n'),
    );
    this.overlayValues.setText(
      [
        formatTime(stats.timeMs),
        String(stats.kills),
        `${stats.chestsOpened} / ${stats.chestsTotal}`,
        String(stats.items),
        String(stats.credits),
        t('hud.result.xpValue', { amount: stats.xp }),
      ].join('\n'),
    );
    this.overlayHint.setText(t('hud.result.next'));
    this.showOverlay();
  }

  private showOverlay(): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setVisible(false);
    this.setOverlayVisible(true);
    this.layout();
    this.time.delayedCall(RETRY_DELAY_MS, () => {
      this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.game.events.emit(GAME_EVENTS.restartRequested));
    });
  }

  private setOverlayVisible(visible: boolean): void {
    for (const item of [this.overlayShade, this.overlayTitle, this.overlayLabels, this.overlayValues, this.overlayHint]) {
      item.setVisible(visible);
    }
  }

  private showBanner(text: string, color: string): void {
    this.banner.setText(text).setColor(color).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, alpha: 0, delay: BANNER_MS, duration: 600 });
  }

  // ---------------------------------------------------------------- Minikarte

  private rebuildMinimap(): void {
    this.minimapImage?.destroy();
    this.minimapImage = null;
    const mission = this.mission;
    if (!mission?.fog) return;

    this.textures.get(MINIMAP_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.minimapImage = this.add.image(0, 0, MINIMAP_KEY).setOrigin(0);
    // Unter die Markierungen sortieren.
    this.children.sendToBack(this.minimapImage);
    this.children.sendToBack(this.minimapPanel);
  }

  private drawMinimapMarkers(): void {
    const g = this.minimapMarkers.clear();
    const mission = this.mission;
    if (!mission?.fog || !this.minimapImage || !this.player) return;

    const { x, y, scale } = this.minimapRect;
    const toMap = (wx: number, wy: number) => ({ mx: x + (wx / TILE_SIZE) * scale, my: y + (wy / TILE_SIZE) * scale });
    const dot = Math.max(2, 1.4 * this.u + scale * 0.5);

    for (const chest of mission.chests) {
      if (chest.isOpen || !mission.fog.isExploredAt(chest.x, chest.y)) continue;
      const { mx, my } = toMap(chest.x, chest.y);
      g.fillStyle(0xffd34d, 1).fillRect(mx - dot * 0.6, my - dot * 0.6, dot * 1.2, dot * 1.2);
    }
    const exit = mission.exitPortal;
    if (exit && mission.fog.isExploredAt(exit.x, exit.y)) {
      const { mx, my } = toMap(exit.x, exit.y);
      g.fillStyle(exit.isOpen ? COLORS.exitOpen : COLORS.exitLocked, 1).fillCircle(mx, my, dot * 1.2);
    }
    const p = toMap(this.player.x, this.player.y);
    g.fillStyle(0xffffff, 1).fillCircle(p.mx, p.my, dot * 1.1);
    g.fillStyle(COLORS.accent, 1).fillCircle(p.mx, p.my, dot * 0.7);
  }

  private seedLabel(): string {
    const config = this.mission?.config;
    return config?.kind === 'dungeon' ? `  ·  seed ${config.seed}` : '';
  }

  // ---------------------------------------------------------------- Layout

  private layout(): void {
    const dpr = (this.registry.get(REGISTRY_KEYS.devicePixelRatio) as number | undefined) ?? 1;
    this.u = dpr;
    const u = dpr;
    const { width, height } = this.scale;
    const shortCss = Math.min(width, height) / u;
    const safe = readSafeArea();
    const margin = 14 * u;
    const left = safe.left * u + margin;
    const right = width - safe.right * u - margin;
    const top = safe.top * u + margin;
    const bottom = height - safe.bottom * u - margin;

    // Spieler: oben links (Name + Stufe, Lebensbalken, dünne Erfahrungsleiste)
    const barWcss = clamp(shortCss * 0.42, 150, 240);
    const barW = barWcss * u;
    const barH = 18 * u;
    this.playerName.setFontSize(Math.round(13 * u)).setPosition(left, top + 15 * u);
    this.playerBar.setLayout(left, top + 19 * u, barW, barH);
    this.playerHp.setFontSize(Math.round(12 * u)).setPosition(left + barW / 2, top + 19 * u + barH / 2);
    this.xpBar.setLayout(left, top + 19 * u + barH + 3 * u, barW, 5 * u);

    // Rucksack-Taste: links unter den Leisten
    const bagR = 24 * u;
    this.bagButton.layout(left + bagR, top + 19 * u + barH + 3 * u + 5 * u + 10 * u + bagR, bagR);

    // Ziel: oben Mitte
    const targetW = clamp(shortCss * 0.5, 160, 260) * u;
    this.targetName.setFontSize(Math.round(13 * u)).setPosition(width / 2, top + 14 * u);
    this.targetBar.setLayout(width / 2 - targetW / 2, top + 18 * u, targetW, 12 * u);

    // Rechts oben: Aufgabe/Welle und Minikarte. Auf schmalen Bildschirmen bleibt links Platz für die Leisten.
    const rightColCss = clamp(width / u - barWcss - 56, 110, 220);
    this.waveText.setFontSize(Math.round(13 * u)).setPosition(right, top);
    this.creditsText.setFontSize(Math.round(14 * u)).setPosition(right, top);
    this.objectiveText
      .setFontSize(Math.round(12 * u))
      .setWordWrapWidth(rightColCss * u)
      .setPosition(right, top);
    this.layoutMinimap(right, top + 42 * u, Math.min(rightColCss, clamp(shortCss * 0.34, 120, 200)) * u);
    this.fpsText?.setFontSize(Math.round(11 * u)).setPosition(left, bottom);

    // Tasten: Fächer im Daumenbereich unten rechts, Trank in der Mitte des Fächers
    const radius = clamp(shortCss * 0.085, 30, 46) * u;
    const cx = right - radius;
    const cy = bottom - radius;
    const arc = radius * 3;
    [185, 227, 269].forEach((degrees, i) => {
      const a = Phaser.Math.DegToRad(degrees);
      this.abilityButtons[i]?.layout(cx + Math.cos(a) * arc, cy + Math.sin(a) * arc, radius);
    });
    this.potionButton.layout(cx, cy, radius * 0.8);

    // Texte und Overlays
    this.hint.setFontSize(Math.round(14 * u)).setPosition(width / 2, bottom).setWordWrapWidth(width * 0.55 - 2 * margin);
    this.banner.setFontSize(Math.round(22 * u)).setPosition(width / 2, height * 0.3).setWordWrapWidth(width * 0.8);
    this.layoutOverlay(width, height);
  }

  private layoutMinimap(right: number, top: number, widthPx: number): void {
    const mission = this.mission;
    const grid = mission?.grid;
    const image = this.minimapImage;
    this.minimapPanel.clear();
    if (!mission?.fog || !grid || !image) return;

    const scale = widthPx / grid.cols;
    const heightPx = grid.rows * scale;
    const x = right - widthPx;
    this.minimapRect = { x, y: top, w: widthPx, h: heightPx, scale };
    image.setPosition(x, top).setScale(scale);
    this.minimapPanel
      .fillStyle(COLORS.uiPanel, 0.55)
      .fillRoundedRect(x - 4 * this.u, top - 4 * this.u, widthPx + 8 * this.u, heightPx + 8 * this.u, 6 * this.u)
      .lineStyle(Math.max(1, this.u), COLORS.uiDim, 0.6)
      .strokeRoundedRect(x - 4 * this.u, top - 4 * this.u, widthPx + 8 * this.u, heightPx + 8 * this.u, 6 * this.u);
  }

  private layoutOverlay(width: number, height: number): void {
    const u = this.u;
    const resultMode = this.overlayLabels.text.length > 0;
    this.overlayShade.setSize(width, height);
    this.overlayTitle.setFontSize(Math.round((resultMode ? 34 : 44) * u)).setPosition(width / 2, height * (resultMode ? 0.24 : 0.42));
    const lineH = Math.round(24 * u);
    for (const text of [this.overlayLabels, this.overlayValues]) {
      text.setFontSize(Math.round(18 * u)).setLineSpacing(lineH - Math.round(18 * u * 1.2));
    }
    const rowsTop = height * 0.34;
    this.overlayLabels.setPosition(width / 2 - 10 * u, rowsTop);
    this.overlayValues.setPosition(width / 2 + 10 * u, rowsTop);
    const hintY = resultMode ? rowsTop + lineH * 6 + 32 * u : height * 0.42 + 56 * u;
    this.overlayHint.setFontSize(Math.round(18 * u)).setPosition(width / 2, hintY);
  }

  private makeText(style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    return this.add.text(0, 0, '', { fontFamily: FONT, ...style });
  }
}

function cooldownState(cooldown: Cooldown, usable: boolean) {
  return {
    cooldownFraction: cooldown.fraction,
    cooldownSeconds: cooldown.remaining > 0 ? Math.ceil(cooldown.remaining / 1000) : 0,
    usable,
  };
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
