import Phaser from 'phaser';
import { GAME_EVENTS, REGISTRY_KEYS, SCENE_KEYS } from '../config/constants';
import { COLORS } from '../config/palette';
import { clamp } from '../core/math';
import type { Cooldown } from '../core/cooldown';
import type { Player } from '../entities/Player';
import { t } from '../i18n';
import { readSafeArea } from '../platform/safeArea';
import { AbilityButton } from '../ui/AbilityButton';
import { ResourceBar } from '../ui/ResourceBar';
import type { MissionScene } from './MissionScene';

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

  private playerBar!: ResourceBar;
  private xpBar!: ResourceBar;
  private playerName!: Phaser.GameObjects.Text;
  private playerHp!: Phaser.GameObjects.Text;
  private targetBar!: ResourceBar;
  private targetName!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private abilityButtons: AbilityButton[] = [];
  private potionButton!: AbilityButton;
  private hint!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private deathShade!: Phaser.GameObjects.Rectangle;
  private deathTitle!: Phaser.GameObjects.Text;
  private deathRetry!: Phaser.GameObjects.Text;
  private fpsText: Phaser.GameObjects.Text | null = null;

  private shownTargetUntil = 0;
  private lastHpText = '';
  private lastNameText = '';
  private dead = false;

  constructor() {
    super(SCENE_KEYS.hud);
  }

  create(): void {
    this.abilityButtons = [];
    this.player = null;
    this.shownTargetUntil = 0;
    this.lastHpText = '';
    this.lastNameText = '';
    this.dead = false;

    this.playerBar = new ResourceBar(this, COLORS.hpFill);
    this.xpBar = new ResourceBar(this, COLORS.xp);
    this.playerName = this.makeText({ fontStyle: 'bold', color: '#dbe4f5' }).setOrigin(0, 1);
    this.playerHp = this.makeText({ fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);

    this.targetBar = new ResourceBar(this, COLORS.hpFill);
    this.targetName = this.makeText({ fontStyle: 'bold', color: '#dbe4f5' }).setOrigin(0.5, 1);
    this.targetBar.setVisible(false);
    this.targetName.setVisible(false);

    this.waveText = this.makeText({ fontStyle: 'bold', color: '#7d8aa8' }).setOrigin(1, 0);

    for (let i = 0; i < 3; i++) this.abilityButtons.push(new AbilityButton(this, COLORS.accent));
    this.potionButton = new AbilityButton(this, 0x6dff9a);
    this.potionButton.setIcon('potion');

    this.hint = this.makeText({ color: '#dbe4f5', align: 'center' }).setOrigin(0.5, 1).setText(t('hud.hint.controls'));
    this.banner = this.makeText({ fontStyle: 'bold', color: '#ffe08a', align: 'center' }).setOrigin(0.5).setVisible(false);

    this.deathShade = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.6).setOrigin(0).setVisible(false);
    this.deathTitle = this.makeText({ fontStyle: 'bold', color: '#ff8a8a' }).setOrigin(0.5).setText(t('hud.death.title'));
    this.deathRetry = this.makeText({ color: '#dbe4f5' }).setOrigin(0.5).setText(t('hud.death.retry'));
    this.deathTitle.setVisible(false);
    this.deathRetry.setVisible(false);

    if (import.meta.env.DEV) {
      this.fpsText = this.makeText({ color: '#7d8aa8' }).setOrigin(1, 0);
    }

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.game.events.on(GAME_EVENTS.missionReady, this.onMissionReady, this);
    this.game.events.on(GAME_EVENTS.waveStarted, this.onWaveStarted, this);
    this.game.events.on(GAME_EVENTS.waveCleared, this.onWaveCleared, this);
    this.game.events.on(GAME_EVENTS.playerLevelUp, this.onLevelUp, this);
    this.game.events.on(GAME_EVENTS.playerDied, this.onPlayerDied, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
      this.game.events.off(GAME_EVENTS.missionReady, this.onMissionReady, this);
      this.game.events.off(GAME_EVENTS.waveStarted, this.onWaveStarted, this);
      this.game.events.off(GAME_EVENTS.waveCleared, this.onWaveCleared, this);
      this.game.events.off(GAME_EVENTS.playerLevelUp, this.onLevelUp, this);
      this.game.events.off(GAME_EVENTS.playerDied, this.onPlayerDied, this);
    });

    // Beim ersten Start läuft MissionScene.create() vor diesem create(): das Ereignis wäre verpasst.
    const mission = this.scene.get(SCENE_KEYS.mission) as MissionScene;
    if (mission.sys.isActive() && mission.player) {
      this.onMissionReady(mission.player);
      if (mission.waveNumber > 0) this.onWaveStarted(mission.waveNumber);
    }
  }

  override update(time: number): void {
    this.fpsText?.setText(`${Math.round(this.game.loop.actualFps)} fps`);
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
  }

  /** True, wenn ein Bildschirmpunkt auf einem Bedienelement liegt (Tipp darf dann nicht laufen lassen). */
  isOverUi(screenX: number, screenY: number): boolean {
    const pad = 10 * this.u;
    return [...this.abilityButtons, this.potionButton].some((button) => button.contains(screenX, screenY, pad));
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const player = this.player;
    if (!player || this.dead) return;
    const pad = 6 * this.u;

    const index = this.abilityButtons.findIndex((button) => button.contains(pointer.x, pointer.y, pad));
    if (index >= 0) {
      this.abilityButtons[index]?.press();
      player.useAbility(index);
    } else if (this.potionButton.contains(pointer.x, pointer.y, pad)) {
      this.potionButton.press();
      player.usePotion();
    }
  }

  private onMissionReady(player: Player): void {
    this.player = player;
    this.dead = false;
    this.layout();
    this.shownTargetUntil = 0;
    this.deathShade.setVisible(false);
    this.deathTitle.setVisible(false);
    this.deathRetry.setVisible(false);
    this.banner.setVisible(false);
    this.hint.setAlpha(1).setVisible(true);
    this.tweens.killTweensOf(this.hint);
    this.tweens.add({ targets: this.hint, alpha: 0, delay: HINT_VISIBLE_MS, duration: 800 });
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

  private onPlayerDied(): void {
    this.dead = true;
    this.deathShade.setVisible(true);
    this.deathTitle.setVisible(true);
    this.deathRetry.setVisible(true);
    this.time.delayedCall(RETRY_DELAY_MS, () => {
      this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.game.events.emit(GAME_EVENTS.restartRequested));
    });
  }

  private showBanner(text: string, color: string): void {
    this.banner.setText(text).setColor(color).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, alpha: 0, delay: BANNER_MS, duration: 600 });
  }

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
    const barW = clamp(shortCss * 0.42, 150, 240) * u;
    const barH = 18 * u;
    this.playerName.setFontSize(Math.round(13 * u)).setPosition(left, top + 15 * u);
    this.playerBar.setLayout(left, top + 19 * u, barW, barH);
    this.playerHp.setFontSize(Math.round(12 * u)).setPosition(left + barW / 2, top + 19 * u + barH / 2);
    this.xpBar.setLayout(left, top + 19 * u + barH + 3 * u, barW, 5 * u);

    // Ziel: oben Mitte
    const targetW = clamp(shortCss * 0.5, 160, 260) * u;
    this.targetName.setFontSize(Math.round(13 * u)).setPosition(width / 2, top + 14 * u);
    this.targetBar.setLayout(width / 2 - targetW / 2, top + 18 * u, targetW, 12 * u);

    // Welle: oben rechts (im Dev-Modus darunter die FPS)
    this.waveText.setFontSize(Math.round(13 * u)).setPosition(right, top);
    this.fpsText?.setFontSize(Math.round(11 * u)).setPosition(right, top + 18 * u);

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
    this.deathShade.setSize(width, height);
    this.deathTitle.setFontSize(Math.round(44 * u)).setPosition(width / 2, height * 0.42);
    this.deathRetry.setFontSize(Math.round(18 * u)).setPosition(width / 2, height * 0.42 + 56 * u);
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
