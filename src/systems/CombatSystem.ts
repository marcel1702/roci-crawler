import Phaser from 'phaser';
import { COLORS } from '../config/palette';
import { rollDamage } from '../core/combat';
import type { Rng } from '../core/rng';
import type { Actor } from '../entities/Actor';

const SWING_MS = 150;
const DAMAGE_TEXT_MS = 650;

/** Wickelt Treffer ab (Schaden würfeln, anwenden) und zeigt Rückmeldung: Schwung, Zahlen, Treffer-Blitz. */
export class CombatSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rng: Rng,
  ) {}

  meleeAttack(attacker: Actor, target: Actor): void {
    const damage = rollDamage(attacker.stats, this.rng);
    attacker.faceToward(target.x, target.y);
    this.showSwing(attacker, target);
    target.takeDamage(damage);
    this.showDamageNumber(target, damage, attacker.team === 'enemy');
  }

  private showSwing(attacker: Actor, target: Actor): void {
    const angle = Math.atan2(target.y - attacker.y, target.x - attacker.x);
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

  private showDamageNumber(target: Actor, damage: number, againstPlayer: boolean): void {
    const zoom = this.scene.cameras.main.zoom;
    const text = this.scene.add.text(target.x, target.y - target.radius - 6, String(damage), {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: againstPlayer ? COLORS.damageTaken : COLORS.damage,
      stroke: '#000000',
      strokeThickness: 3,
    });
    // Welt-Text wird mit der Kamera vergrößert; höhere Auflösung hält ihn scharf.
    text.setResolution(Math.ceil(zoom)).setOrigin(0.5).setDepth(100);
    this.scene.tweens.add({
      targets: text,
      y: text.y - 22,
      alpha: 0,
      duration: DAMAGE_TEXT_MS,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }
}
