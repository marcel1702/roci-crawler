/** Kampfwerte, die jeder Akteur (Spieler wie Gegner) hat. Längen in Welt-Pixeln, Zeiten in ms. */
export interface ActorStats {
  maxHp: number;
  /** Pixel pro Sekunde. */
  moveSpeed: number;
  /** Kollisions- und Trefferradius. */
  radius: number;
  damageMin: number;
  damageMax: number;
  /** Reichweite des Grundangriffs, vom Rand des Angreifers zum Rand des Ziels gemessen. */
  attackRange: number;
  attackCooldownMs: number;
}

/** Wie stark Werte pro Stufe über Stufe 1 hinaus wachsen. */
export interface LevelGrowth {
  hpPerLevel: number;
  /** Anteil pro Stufe, z. B. 0.06 = +6 % Schaden je Stufe. */
  damagePerLevel: number;
}

export function statsAtLevel(base: ActorStats, growth: LevelGrowth, level: number): ActorStats {
  const steps = Math.max(0, level - 1);
  const damageFactor = 1 + growth.damagePerLevel * steps;
  return {
    ...base,
    maxHp: Math.round(base.maxHp + growth.hpPerLevel * steps),
    damageMin: Math.round(base.damageMin * damageFactor),
    damageMax: Math.round(base.damageMax * damageFactor),
  };
}

/** Skaliert Lebenspunkte und Schaden, z. B. für härtere Gegnerwellen. */
export function scaleStats(base: ActorStats, hpFactor: number, damageFactor: number): ActorStats {
  return {
    ...base,
    maxHp: Math.round(base.maxHp * hpFactor),
    damageMin: Math.max(1, Math.round(base.damageMin * damageFactor)),
    damageMax: Math.max(1, Math.round(base.damageMax * damageFactor)),
  };
}
