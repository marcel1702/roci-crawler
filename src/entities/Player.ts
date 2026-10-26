import { shake } from '../platform/effects';
import Phaser from 'phaser';
import { audio } from '../audio';
import { ABILITIES } from '../abilities';
import type { AbilityDef } from '../abilities';
import { GAME_EVENTS, INFECTION, MISSION_EVENTS, POTION, TAP, TEXTURE_SCALE, ZEROG, actorTextureKey } from '../config/constants';
import { COLORS } from '../config/palette';
import { hasLineOfSight } from '../core/collision';
import { edgeDistance, isInReach } from '../core/combat';
import { Cooldown } from '../core/cooldown';
import { findPath } from '../core/pathfinding';
import { addMods, deriveStats } from '../core/items';
import type { DerivedStats } from '../core/items';
import type { Profile } from '../core/profile';
import type { Progression } from '../core/progression';
import { statsAtLevel } from '../core/stats';
import { NO_BOOST, availablePoints, sanitizeRanks, talentEffects } from '../core/talents';
import type { AbilityBoost, TalentTree } from '../core/talents';
import { TALENTS } from '../data/talents';
import type { ClassDef } from '../data/types';
import { t } from '../i18n';
import { Actor } from './Actor';
import type { Enemy } from './Enemy';
import type { WorldContext } from './WorldContext';

const CHASE_REPATH_SECONDS = 0.2;
/** Berührungsabstand (Ränder), ab dem ein Sturmangriff einen Gegner rammt. */
const RAM_CONTACT = 4;
const GHOST_INTERVAL_S = 0.035;
const STABILIZE_COLOR = 0x9fd8ff;
/** Unter diesem Lebensanteil kommt (einmalig) der Hinweis auf den Trank. */
const LOW_HP_TIP = 0.4;

export interface AbilitySlot {
  def: AbilityDef;
  cooldown: Cooldown;
}

interface DashState {
  dirX: number;
  dirY: number;
  remaining: number;
  speed: number;
  onHit: (enemy: Enemy) => void;
}

interface BuffEffect {
  /** Faktor auf erlittenen Schaden. */
  damageTaken?: number;
  /** Faktor auf das Lauftempo. */
  speed?: number;
  /** Faktor auf verursachten Schaden. */
  damage?: number;
  /** Farbe eines Leuchtrings um die Figur. */
  aura?: number;
}

/** Werte der Figur aus Klasse, Stufe, Ausrüstung und Talenten. */
function derive(classDef: ClassDef, profile: Profile): DerivedStats & { boosts: AbilityBoost[] } {
  const base = statsAtLevel(classDef.stats, classDef.growth, profile.progression.level);
  const effects = talentEffects(TALENTS[classDef.id], profile.talents);
  const mods = profile.inventory.mods();
  addMods(mods, effects.mods);
  return { ...deriveStats(base, mods), boosts: effects.boosts };
}

/** Die Spielfigur. Bekommt Befehle (laufen / Gegner angreifen / Fähigkeit) von Eingabe und HUD. */
export class Player extends Actor {
  readonly team = 'player';
  readonly classDef: ClassDef;
  readonly profile: Profile;
  readonly abilities: AbilitySlot[];
  readonly potionCooldown = new Cooldown();
  /** „Stabilisieren“: bremst in der Schwerelosigkeit stark ab. */
  readonly brakeCooldown = new Cooldown();
  attackTarget: Enemy | null = null;
  maxPotions: number = POTION.charges;
  potions: number = POTION.charges;
  /** Anteil, um den Abklingzeiten der Fähigkeiten kürzer sind (aus Ausrüstung). */
  cooldownReduction = 0;
  /** Zusätzlicher Anteil, den Tränke heilen (aus Ausrüstung). */
  potionHealPct = 0;

  /** Verbesserungen der drei Fähigkeiten aus Talenten. */
  boosts: AbilityBoost[] = [{ ...NO_BOOST }, { ...NO_BOOST }, { ...NO_BOOST }];

  private repathTimer = 0;
  private brakeMs = 0;
  private infectionMs = 0;
  private zeroGAnnounced = false;
  private dash: DashState | null = null;
  private ghostTimer = 0;
  private readonly buffs = new Map<string, { ms: number; effect: BuffEffect }>();
  private readonly aura: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    world: WorldContext,
    x: number,
    y: number,
    classDef: ClassDef,
    profile: Profile,
  ) {
    // Gespeicherte Talente prüfen (z. B. nach Änderungen am Baum oder manipulierten Daten), bevor sie wirken.
    profile.talents = sanitizeRanks(TALENTS[classDef.id], profile.talents, profile.progression.level);
    const derived = derive(classDef, profile);
    super(scene, world, x, y, derived.stats, classDef.id);
    this.classDef = classDef;
    this.profile = profile;
    this.basic = classDef.basic;
    this.directThrust = true;
    this.brakeDamping = 0;
    this.applyDerived(derived);
    this.potions = this.maxPotions;
    this.abilities = classDef.abilities.map((id) => ({ def: ABILITIES[id], cooldown: new Cooldown() }));

    this.aura = new Phaser.GameObjects.Graphics(scene).setVisible(false);
    this.addAt(this.aura, 1);
  }

  get progression(): Progression {
    return this.profile.progression;
  }

  get talentTree(): TalentTree {
    return TALENTS[this.classDef.id];
  }

  /** Unverteilte Talentpunkte. */
  get talentPoints(): number {
    return availablePoints(this.talentTree, this.profile.talents, this.progression.level);
  }

  /** Berechnet die Werte neu (nach Stufenaufstieg oder Wechsel der Ausrüstung); das Verhältnis der Lebenspunkte bleibt. */
  refreshStats(): void {
    const ratio = this.hp / this.stats.maxHp;
    this.applyDerived(derive(this.classDef, this.profile));
    this.hp = Math.min(this.stats.maxHp, Math.max(1, Math.round(this.stats.maxHp * ratio)));
    this.potions = Math.min(this.potions, this.maxPotions);
  }

  private applyDerived(derived: DerivedStats & { boosts: AbilityBoost[] }): void {
    this.boosts = derived.boosts;
    this.stats = derived.stats;
    this.armor = derived.armor;
    this.critChance = derived.critChance;
    this.lifesteal = derived.lifesteal;
    this.cooldownReduction = derived.cooldownReduction;
    this.zeroGControl = 1 + derived.zeroGControl;
    this.potionHealPct = derived.potionHealPct;
    this.maxPotions = POTION.charges + derived.extraPotions;
  }

  get isDashing(): boolean {
    return this.dash !== null;
  }

  /** Läuft zum Zielpunkt. Liefert false, wenn es dorthin keinen Weg gibt oder die Figur gerade stürmt. */
  commandMoveTo(x: number, y: number): boolean {
    if (this.dash) return false;
    const path = findPath(this.world.grid, this, { x, y }, this.radius, TAP.snapTiles);
    if (!path) return false;
    this.setAttackTarget(null);
    this.follower.setPath(path);
    return true;
  }

  /** Läuft zum Gegner und greift ihn an, bis er tot ist oder ein neuer Befehl kommt. */
  commandAttack(enemy: Enemy): void {
    if (this.dash) return;
    this.setAttackTarget(enemy);
    this.follower.clear();
    this.repathTimer = 0;
  }

  /** Bricht Laufen und Angreifen ab (z. B. am Missionsende). */
  cancelCommands(): void {
    this.setAttackTarget(null);
    this.follower.clear();
  }

  /** Löst die Fähigkeit auf Taste `index` aus. Liefert true, wenn sie gewirkt hat. */
  useAbility(index: number): boolean {
    const slot = this.abilities[index];
    if (!slot || this.isDead || this.isStunned || this.dash || !slot.cooldown.ready) return false;
    const boost = this.boosts[index] ?? NO_BOOST;
    const done = slot.def.execute({ player: this, world: this.world, scene: this.scene, boost });
    if (done) audio.play('ability');
    if (done) slot.cooldown.trigger(slot.def.cooldownMs * (1 - this.cooldownReduction) * (1 - Math.min(0.6, boost.cooldown)));
    return done;
  }

  usePotion(): boolean {
    if (this.isDead || this.potions <= 0 || !this.potionCooldown.ready || this.hp >= this.stats.maxHp) return false;
    const healed = this.heal(Math.round(this.stats.maxHp * (POTION.healFraction + this.potionHealPct)));
    this.potions--;
    this.potionCooldown.trigger(POTION.cooldownMs);
    audio.play('potion');
    this.world.combat.floatText(this.x, this.y - this.radius - 6, `+${healed}`, COLORS.heal);
    this.world.combat.ring(this.x, this.y, 38, 0x6dff9a, 320);
    return true;
  }

  /** „Stabilisieren“: bremst kurz stark ab. Wirkt nur in der Schwerelosigkeit, sonst bleibt die Abklingzeit unberührt. */
  stabilize(): boolean {
    if (this.isDead || !this.isFloating || !this.brakeCooldown.ready) return false;
    this.brakeMs = ZEROG.brakeMs;
    this.braking = true;
    this.brakeCooldown.trigger(ZEROG.brakeCooldownMs);
    this.cancelCommands();
    audio.play('whoosh');
    this.world.combat.ring(this.x, this.y, 30, STABILIZE_COLOR, 300);
    return true;
  }

  /** Stürmt `distance` Pixel in Richtung `angle`; stoppt am ersten gerammten Gegner und ruft dann `onHit`. */
  startDash(angle: number, distance: number, speed: number, onHit: (enemy: Enemy) => void): void {
    this.follower.clear();
    this.vx = 0;
    this.vy = 0;
    this.sprite.rotation = angle;
    this.ghostTimer = 0;
    this.dash = { dirX: Math.cos(angle), dirY: Math.sin(angle), remaining: distance, speed, onHit };
  }

  /** Zeitlich begrenzter Verstärkungszauber; gleiche Kennungen ersetzen einander, verschiedene wirken gemeinsam. */
  startBuff(id: string, durationMs: number, effect: BuffEffect): void {
    this.buffs.set(id, { ms: durationMs, effect });
    this.applyBuffs();
  }

  /** Setzt die Faktoren aus allen aktiven Verstärkungen neu zusammen. */
  private applyBuffs(): void {
    let taken = 1;
    let speed = 1;
    let damage = 1;
    let aura: number | undefined;
    for (const { effect } of this.buffs.values()) {
      taken *= effect.damageTaken ?? 1;
      speed *= effect.speed ?? 1;
      damage *= effect.damage ?? 1;
      aura ??= effect.aura;
    }
    this.damageTakenMultiplier = taken;
    this.speedMultiplier = speed;
    this.damageMultiplier = damage;
    this.auraColor = aura ?? null;
    if (aura === undefined) this.aura.clear().setVisible(false);
  }

  private auraColor: number | null = null;

  gainXp(amount: number): void {
    const reached = this.progression.gain(amount);
    const level = reached.at(-1);
    if (level === undefined) return;

    this.refreshStats();
    this.hp = this.stats.maxHp;
    this.profile.touch();
    audio.play('levelUp');
    this.world.combat.ring(this.x, this.y, 50, 0xffd34d, 450);
    if (this.talentPoints > 0) this.scene.events.emit(MISSION_EVENTS.tip, 'talents');
    this.world.combat.floatText(this.x, this.y - this.radius - 20, t('hud.levelUp', { level }), COLORS.elite, 15);
    this.scene.game.events.emit(GAME_EVENTS.playerLevelUp, level);
  }

  tick(dt: number): void {
    if (this.isDead) return;
    this.tickTimers(dt);
    this.potionCooldown.update(dt * 1000);
    this.brakeCooldown.update(dt * 1000);
    if (this.potions > 0 && this.hp < this.stats.maxHp * LOW_HP_TIP) this.scene.events.emit(MISSION_EVENTS.tip, 'potion');
    this.brakeMs = Math.max(0, this.brakeMs - dt * 1000);
    this.braking = this.brakeMs > 0;
    this.tickInfection(dt);
    for (const slot of this.abilities) slot.cooldown.update(dt * 1000);
    this.tickBuffs(dt);

    if (this.dash) {
      this.tickDash(dt);
      return;
    }
    if (this.isStunned) return;

    const target = this.attackTarget;
    if (target?.isDead) this.setAttackTarget(null);
    else if (target) {
      // Fernkämpfer brauchen freie Sicht; sonst laufen sie weiter, bis sie schießen können.
      const sight = this.basic.kind === 'melee' || hasLineOfSight(this.world.grid, this.x, this.y, target.x, target.y);
      if (sight && isInReach(this, target, this.stats.attackRange)) {
        this.follower.clear();
        this.faceToward(target.x, target.y);
        // Angriffshilfe: Wer zielt, treibt in der Schwerelosigkeit nicht davon.
        this.braking = true;
        this.tryAttack(target);
      } else {
        this.chase(target, dt);
      }
      return;
    }
    this.followPath(dt);
  }

  protected override onDeath(): void {
    this.setAttackTarget(null);
    this.dash = null;
    this.buffs.clear();
    this.applyBuffs();
    this.setAlpha(0.45);
  }

  private tickDash(dt: number): void {
    const dash = this.dash;
    if (!dash) return;

    const step = Math.min(dash.remaining, dash.speed * dt);
    const moved = this.moveBy(dash.dirX * step, dash.dirY * step);
    dash.remaining -= step;

    this.ghostTimer -= dt;
    if (this.ghostTimer <= 0) {
      this.ghostTimer = GHOST_INTERVAL_S;
      this.spawnGhost();
    }

    const rammed = this.world.enemies.find((enemy) => !enemy.isDead && edgeDistance(this, enemy) <= RAM_CONTACT);
    if (rammed) {
      this.endDash(dash);
      dash.onHit(rammed);
    } else if (dash.remaining <= 0.01 || moved < step * 0.5) {
      this.endDash(dash);
    }
  }

  /** Auf infiziertem Boden: bremst und schadet in regelmäßigen Takten (Anteil der Lebenspunkte). */
  private tickInfection(dt: number): void {
    const { grid } = this.world;
    if (!grid.isInfected(grid.toCol(this.x), grid.toRow(this.y))) {
      this.infectionMs = 0;
      return;
    }
    this.slow(INFECTION.tileSlow, 250);
    this.scene.events.emit(MISSION_EVENTS.tip, 'infection');
    this.infectionMs -= dt * 1000;
    if (this.infectionMs > 0) return;
    this.infectionMs = INFECTION.tickMs;
    this.world.combat.dealDamage(null, this, Math.max(1, Math.round(this.stats.maxHp * INFECTION.tilePct)), false, true);
  }

  /** Nach dem Sturmangriff bleibt in der Schwerelosigkeit ein Teil des Schwungs. */
  private endDash(dash: DashState): void {
    this.dash = null;
    if (!this.isFloating) return;
    this.vx = dash.dirX * dash.speed * ZEROG.dashCarry;
    this.vy = dash.dirY * dash.speed * ZEROG.dashCarry;
  }

  protected override onFloatStart(): void {
    if (this.zeroGAnnounced) return;
    this.zeroGAnnounced = true;
    this.scene.game.events.emit(GAME_EVENTS.zeroGEntered);
  }

  protected override onBump(speed: number): void {
    shake(this.scene, 70, Math.min(0.006, 0.0015 + speed / 90000));
  }

  private tickBuffs(dt: number): void {
    if (this.buffs.size === 0) return;
    let expired = false;
    for (const [id, buff] of this.buffs) {
      buff.ms -= dt * 1000;
      if (buff.ms <= 0) {
        this.buffs.delete(id);
        expired = true;
      }
    }
    if (expired) this.applyBuffs();

    if (this.auraColor !== null) {
      const pulse = 0.55 + 0.3 * Math.sin(this.scene.time.now / 120);
      this.aura
        .setVisible(true)
        .clear()
        .fillStyle(this.auraColor, 0.14)
        .fillCircle(0, 0, this.radius + 7)
        .lineStyle(2, this.auraColor, pulse)
        .strokeCircle(0, 0, this.radius + 7);
    }
  }

  private spawnGhost(): void {
    const ghost = this.scene.add
      .image(this.x, this.y, actorTextureKey(this.classDef.id))
      .setScale(TEXTURE_SCALE)
      .setRotation(this.sprite.rotation)
      .setTint(COLORS.accent)
      .setAlpha(0.45)
      .setDepth(9);
    this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 200, onComplete: () => ghost.destroy() });
  }

  private chase(target: Enemy, dt: number): void {
    this.repathTimer -= dt;
    if (this.repathTimer <= 0 || !this.follower.active) {
      this.repathTimer = CHASE_REPATH_SECONDS;
      const path = findPath(this.world.grid, this, target, this.radius, TAP.snapTiles);
      if (!path) {
        this.setAttackTarget(null);
        return;
      }
      this.follower.setPath(path);
    }
    this.followPath(dt);
  }

  private setAttackTarget(enemy: Enemy | null): void {
    if (this.attackTarget === enemy) return;
    this.attackTarget?.setTargeted(false);
    this.attackTarget = enemy;
    enemy?.setTargeted(true);
  }
}
