import Phaser from 'phaser';
import { CRIT_MULTIPLIER, KNOCKBACK, MISSION_EVENTS } from '../config/constants';
import { COLORS } from '../config/palette';
import { rollDamage } from '../core/combat';
import type { Rng } from '../core/rng';
import type { Actor } from '../entities/Actor';
import type { ProjectileSystem } from './ProjectileSystem';

const SWING_MS = 150;
const FLOAT_TEXT_MS = 650;

/** Wickelt Treffer ab (Schaden würfeln, anwenden) und zeigt Rückmeldung: Schwung, Zahlen, Erschütterung. */
export class CombatSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rng: Rng,
  ) {}

  /** Grundangriff der Figur: Nahkampfschlag oder Geschoss, je nach Klasse. */
  basicAttack(attacker: Actor, target: Actor): number {
    if (attacker.basic.kind === 'melee') return this.meleeAttack(attacker, target);

    attacker.faceToward(target.x, target.y);
    const crit = attacker.critChance > 0 && this.rng.chance(attacker.critChance);
    const amount = Math.round(rollDamage(attacker.stats, this.rng) * attacker.damageMultiplier * (crit ? CRIT_MULTIPLIER : 1));
    const angle = Math.atan2(target.y - attacker.y, target.x - attacker.x);
    this.projectiles?.spawn({
      source: attacker,
      x: attacker.x + Math.cos(angle) * (attacker.radius + 4),
      y: attacker.y + Math.sin(angle) * (attacker.radius + 4),
      angle,
      speed: attacker.basic.projectileSpeed,
      damage: amount,
      crit,
      tint: 0x9fe8ff,
      radius: 3.5,
      knockback: KNOCKBACK.projectile,
    });
    // Rückstoß in der Schwerelosigkeit: jeder Schuss schiebt die Schützin entgegen.
    attacker.pushAlong(-Math.cos(angle), -Math.sin(angle), attacker.basic.recoil ?? KNOCKBACK.recoil);
    return amount;
  }

  /** Verbindet das Geschoss-System (wird nach dem Erzeugen beider Systeme gesetzt). */
  projectiles: ProjectileSystem | null = null;

  /**
   * Flächenschaden um einen Punkt gegen alle `targets` im Radius (bis zum Rand der Ziele gemessen).
   * In der Schwerelosigkeit stößt die Druckwelle die Getroffenen vom Mittelpunkt weg. Liefert die Zahl der Getroffenen.
   */
  areaDamage(
    source: Actor,
    x: number,
    y: number,
    radius: number,
    multiplier: number,
    targets: readonly Actor[],
    stunMs = 0,
    knockback: number = KNOCKBACK.area,
  ): number {
    let hits = 0;
    for (const target of targets) {
      if (target.isDead || Math.hypot(target.x - x, target.y - y) - target.radius > radius) continue;
      this.attack(source, target, multiplier, 0);
      target.knockFrom(x, y, knockback);
      if (stunMs > 0) target.stun(stunMs);
      hits++;
    }
    return hits;
  }

  /** Grundangriff im Nahkampf, optional mit Schadensfaktor (z. B. für Fähigkeiten). */
  meleeAttack(attacker: Actor, target: Actor, multiplier = 1): number {
    attacker.faceToward(target.x, target.y);
    this.swingFx(attacker, Math.atan2(target.y - attacker.y, target.x - attacker.x));
    return this.attack(attacker, target, multiplier);
  }

  /**
   * Würfelt einen Treffer (mit Chance auf Kritisch) und wendet ihn an. Liefert den tatsächlichen Schaden.
   * `knockback` stößt das Ziel in der Schwerelosigkeit vom Angreifer weg.
   */
  attack(attacker: Actor, target: Actor, multiplier = 1, knockback: number = KNOCKBACK.melee): number {
    const crit = attacker.critChance > 0 && this.rng.chance(attacker.critChance);
    const amount = Math.round(rollDamage(attacker.stats, this.rng) * multiplier * attacker.damageMultiplier * (crit ? CRIT_MULTIPLIER : 1));
    const dealt = this.dealDamage(attacker, target, amount, crit);
    if (knockback > 0) target.knockFrom(attacker.x, attacker.y, knockback);
    return dealt;
  }

  /** Würfelt Schaden aus den Werten des Angreifers, ohne ihn anzuwenden (für Geschosse). */
  rollDamage(attacker: Actor, multiplier = 1): number {
    return Math.round(rollDamage(attacker.stats, this.rng) * multiplier * attacker.damageMultiplier);
  }

  /** Wendet Schaden an, zeigt die Zahl und meldet einen Todesfall. Liefert den tatsächlichen Schaden. */
  dealDamage(source: Actor | null, target: Actor, amount: number, crit = false): number {
    if (target.isDead) return 0;
    const dealt = target.takeDamage(amount);
    const color = target.team === 'player' ? COLORS.damageTaken : crit ? COLORS.crit : COLORS.damage;
    this.floatText(target.x, target.y - target.radius - 6, crit ? `${dealt}!` : String(dealt), color, crit ? 17 : 13);
    if (target.team === 'player') this.scene.cameras.main.shake(90, 0.004);

    if (source && !source.isDead && source.lifesteal > 0 && target.team !== source.team) {
      const healed = source.heal(dealt * source.lifesteal);
      if (healed >= 1) this.floatText(source.x, source.y - source.radius - 18, `+${Math.round(healed)}`, COLORS.heal, 11);
    }
    if (target.isDead) this.scene.events.emit(MISSION_EVENTS.actorKilled, target, source);
    return dealt;
  }

  /** Aufsteigender Text in der Welt (Schaden, Heilung, Erfahrung). */
  floatText(x: number, y: number, text: string, color: string, size = 13): void {
    const label = this.scene.add.text(x, y, text, {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
      stroke: '#000000',
      strokeThickness: 3,
    });
    // Welt-Text wird mit der Kamera vergrößert; höhere Auflösung hält ihn scharf.
    label.setResolution(Math.ceil(this.scene.cameras.main.zoom)).setOrigin(0.5).setDepth(100);
    this.scene.tweens.add({
      targets: label,
      y: label.y - 22,
      alpha: 0,
      duration: FLOAT_TEXT_MS,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  /** Sich ausbreitender Ring für Flächeneffekte. */
  ring(x: number, y: number, radius: number, color: number, durationMs = 260): void {
    const ring = this.scene.add.circle(x, y, radius, color, 0.18).setStrokeStyle(2, color, 0.95).setDepth(45);
    ring.setScale(0.25);
    this.scene.tweens.add({
      targets: ring,
      scale: 1,
      alpha: 0,
      duration: durationMs,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  /** Weißer Schwungbogen in Richtung `angle` (auch für Schläge ins Leere). */
  swingFx(attacker: Actor, angle: number): void {
    const reach = attacker.radius + attacker.stats.attackRange * 0.6 + 4;
    const swing = this.scene.add.graphics({ x: attacker.x, y: attacker.y });
    swing.setDepth(50).setRotation(angle);
    swing.lineStyle(3, 0xffffff, 0.9).beginPath().arc(0, 0, reach, -0.9, 0.9).strokePath();
    this.scene.tweens.add({
      targets: swing,
      alpha: 0,
      scale: 1.25,
      duration: SWING_MS,
      onComplete: () => swing.destroy(),
    });
  }
}
