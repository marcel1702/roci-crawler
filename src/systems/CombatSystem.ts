import Phaser from 'phaser';
import { MISSION_EVENTS } from '../config/constants';
import { COLORS } from '../config/palette';
import { rollDamage } from '../core/combat';
import type { Rng } from '../core/rng';
import type { Actor } from '../entities/Actor';

const SWING_MS = 150;
const FLOAT_TEXT_MS = 650;

/** Wickelt Treffer ab (Schaden würfeln, anwenden) und zeigt Rückmeldung: Schwung, Zahlen, Erschütterung. */
export class CombatSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rng: Rng,
  ) {}

  /** Grundangriff im Nahkampf, optional mit Schadensfaktor (z. B. für Fähigkeiten). */
  meleeAttack(attacker: Actor, target: Actor, multiplier = 1): number {
    const damage = Math.round(rollDamage(attacker.stats, this.rng) * multiplier);
    attacker.faceToward(target.x, target.y);
    this.swingFx(attacker, Math.atan2(target.y - attacker.y, target.x - attacker.x));
    return this.dealDamage(attacker, target, damage);
  }

  /** Würfelt Schaden aus den Werten des Angreifers, ohne ihn anzuwenden (für Geschosse und Flächenangriffe). */
  rollDamage(attacker: Actor, multiplier = 1): number {
    return Math.round(rollDamage(attacker.stats, this.rng) * multiplier);
  }

  /** Wendet Schaden an, zeigt die Zahl und meldet einen Todesfall. Liefert den tatsächlichen Schaden. */
  dealDamage(source: Actor | null, target: Actor, amount: number): number {
    if (target.isDead) return 0;
    const dealt = target.takeDamage(amount);
    this.floatText(target.x, target.y - target.radius - 6, String(dealt), target.team === 'player' ? COLORS.damageTaken : COLORS.damage);
    if (target.team === 'player') this.scene.cameras.main.shake(90, 0.004);
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
