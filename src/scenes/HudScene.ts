import Phaser from 'phaser';
import { GAME_EVENTS, REGISTRY_KEYS, SCENE_KEYS } from '../config/constants';
import { COLORS } from '../config/palette';
import { clamp } from '../core/math';
import type { Player } from '../entities/Player';
import { t } from '../i18n';
import { readSafeArea } from '../platform/safeArea';
import type { MissionScene } from './MissionScene';
import { AbilityButton } from '../ui/AbilityButton';
import { ResourceBar } from '../ui/ResourceBar';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const HINT_VISIBLE_MS = 7000;
const TARGET_LINGER_MS = 1200;
const RETRY_DELAY_MS = 700;
const ABILITY_COUNT = 3;

/**
 * Bedienoberfläche über der Mission. Alle Maße sind in CSS-Pixeln gedacht und werden mit dem
 * Pixelverhältnis `u` auf die (devicePixelRatio-mal größere) Spielfläche umgerechnet.
 */
export class HudScene extends Phaser.Scene {
  private u = 1;
  private player: Player | null = null;

  private playerBar!: ResourceBar;
  private playerName!: Phaser.GameObjects.Text;
  private playerHp!: Phaser.GameObjects.Text;
  private targetBar!: ResourceBar;
  private targetName!: Phaser.GameObjects.Text;
  private abilityButtons: AbilityButton[] = [];
  private hint!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private deathShade!: Phaser.GameObjects.Rectangle;
  private deathTitle!: Phaser.GameObjects.Text;
  private deathRetry!: Phaser.GameObjects.Text;
  private fpsText: Phaser.GameObjects.Text | null = null;

  private shownTargetUntil = 0;
  private lastHpText = '';

  constructor() {
    super(SCENE_KEYS.hud);
  }

  create(): void {
    this.abilityButtons = [];
    this.player = null;
    this.shownTargetUntil = 0;
    this.lastHpText = '';

    this.playerBar = new ResourceBar(this, COLORS.hpFill);
    this.playerName = this.makeText({ fontStyle: 'bold', color: '#dbe4f5' }).setOrigin(0, 1);
    this.playerHp = this.makeText({ fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);

    this.targetBar = new ResourceBar(this, COLORS.hpFill);
    this.targetName = this.makeText({ fontStyle: 'bold', color: '#dbe4f5' }).setOrigin(0.5, 1);
    this.targetBar.setVisible(false);
    this.targetName.setVisible(false);

    for (let i = 0; i < ABILITY_COUNT; i++) this.abilityButtons.push(new AbilityButton(this, String(i + 1), COLORS.accent));

    this.hint = this.makeText({ color: '#dbe4f5', align: 'center' }).setOrigin(0.5, 1).setText(t('hud.hint.controls'));
    this.banner = this.makeText({ fontStyle: 'bold', color: '#ffe08a', align: 'center' })
      .setOrigin(0.5)
      .setText(t('hud.waveCleared'))
      .setVisible(false);

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
    this.game.events.on(GAME_EVENTS.missionReady, this.onMissionReady, this);
    // Beim ersten Start läuft MissionScene.create() vor diesem create(): das Ereignis wäre verpasst.
    const mission = this.scene.get(SCENE_KEYS.mission) as MissionScene;
    if (mission.sys.isActive() && mission.player) this.onMissionReady(mission.player);
    this.game.events.on(GAME_EVENTS.waveCleared, this.onWaveCleared, this);
    this.game.events.on(GAME_EVENTS.playerDied, this.onPlayerDied, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.game.events.off(GAME_EVENTS.missionReady, this.onMissionReady, this);
      this.game.events.off(GAME_EVENTS.waveCleared, this.onWaveCleared, this);
      this.game.events.off(GAME_EVENTS.playerDied, this.onPlayerDied, this);
    });
  }

  override update(time: number): void {
    this.fpsText?.setText(`${Math.round(this.game.loop.actualFps)} fps`);
    const player = this.player;
    if (!player) return;

    this.playerBar.setFraction(player.hp / player.stats.maxHp);
    const hpText = t('hud.hp', { current: Math.ceil(player.hp), max: player.stats.maxHp });
    if (hpText !== this.lastHpText) {
      this.lastHpText = hpText;
      this.playerHp.setText(hpText);
    }

    if (player.attackTarget && !player.attackTarget.isDead) this.shownTargetUntil = time + TARGET_LINGER_MS;
    const target = player.attackTarget;
    const showTarget = !!target && !target.isDead && time < this.shownTargetUntil;
    this.targetBar.setVisible(showTarget);
    this.targetName.setVisible(showTarget);
    if (showTarget && target) {
      this.targetBar.setFraction(target.hp / target.stats.maxHp);
      this.targetName.setText(t(target.def.nameKey));
    }
  }

  /** True, wenn ein Bildschirmpunkt auf einem Bedienelement liegt (Tipp darf dann nicht laufen lassen). */
  isOverUi(screenX: number, screenY: number): boolean {
    const pad = 10 * this.u;
    return this.abilityButtons.some((button) => button.contains(screenX, screenY, pad));
  }

  private onMissionReady(player: Player): void {
    this.player = player;
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

  private onWaveCleared(): void {
    this.banner.setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 2200, duration: 600 });
  }

  private onPlayerDied(): void {
    this.deathShade.setVisible(true);
    this.deathTitle.setVisible(true);
    this.deathRetry.setVisible(true);
    this.time.delayedCall(RETRY_DELAY_MS, () => {
      this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.game.events.emit(GAME_EVENTS.restartRequested));
    });
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

    // Spieler: oben links
    const barW = clamp(shortCss * 0.42, 150, 240) * u;
    const barH = 18 * u;
    this.playerName.setFontSize(Math.round(13 * u)).setPosition(left, top + 15 * u).setText(t(this.player?.classDef.nameKey ?? 'class.amos.name'));
    this.playerBar.setLayout(left, top + 19 * u, barW, barH);
    this.playerHp.setFontSize(Math.round(12 * u)).setPosition(left + barW / 2, top + 19 * u + barH / 2);

    // Ziel: oben Mitte
    const targetW = clamp(shortCss * 0.5, 160, 260) * u;
    const targetH = 12 * u;
    this.targetName.setFontSize(Math.round(13 * u)).setPosition(width / 2, top + 14 * u);
    this.targetBar.setLayout(width / 2 - targetW / 2, top + 18 * u, targetW, targetH);

    // Fähigkeiten: Bogen unten rechts im Daumenbereich
    const radius = clamp(shortCss * 0.085, 30, 46) * u;
    const cx = right - radius;
    const cy = bottom - radius;
    const arc = radius * 3.4;
    const angles = [185, 227.5, 270];
    this.abilityButtons.forEach((button, i) => {
      const a = Phaser.Math.DegToRad(angles[i] ?? 270);
      button.layout(cx + Math.cos(a) * arc, cy + Math.sin(a) * arc, radius);
    });

    // Texte und Overlays
    this.hint.setFontSize(Math.round(14 * u)).setPosition(width / 2, bottom).setWordWrapWidth(width * 0.55 - 2 * margin);
    this.banner.setFontSize(Math.round(22 * u)).setPosition(width / 2, height * 0.3).setWordWrapWidth(width * 0.8);
    this.deathShade.setSize(width, height);
    this.deathTitle.setFontSize(Math.round(44 * u)).setPosition(width / 2, height * 0.42);
    this.deathRetry.setFontSize(Math.round(18 * u)).setPosition(width / 2, height * 0.42 + 56 * u);
    this.fpsText?.setFontSize(Math.round(11 * u)).setPosition(right, top);
  }

  private makeText(style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    return this.add.text(0, 0, '', { fontFamily: FONT, ...style });
  }
}
