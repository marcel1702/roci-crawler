/** Wie viele Akte spielbar sind (weitere folgen mit den Meilensteinen 9 und 10). */
export const IMPLEMENTED_ACTS = 2;

/** Orte (Aufträge) pro Akt. */
export const LOCATIONS_PER_ACT = 6;

/** So viele Missionen eines Akts müssen abgeschlossen sein, bevor der Boss erreichbar ist. */
export const MISSIONS_PER_ACT = 3;

export interface MainMission {
  /** Akt (1-basiert), dessen Boss der Hauptauftrag gilt. */
  act: number;
  /** `locked`: noch Missionen übrig; `ready`: Boss herausfordern; `repeat`: Akt schon geschafft, Boss erneut. */
  status: 'locked' | 'ready' | 'repeat';
  /** Fehlende Missionen bis zur Freischaltung (nur bei `locked` größer als 0). */
  remaining: number;
  /** Alle vorhandenen Akte sind geschafft; mehr gibt es noch nicht. */
  allCleared: boolean;
}

/** Der höchste Akt, der gespielt werden darf (der nächste nach dem letzten geschafften, höchstens der letzte vorhandene). */
export function highestUnlockedAct(actsCleared: number): number {
  return Math.min(actsCleared + 1, IMPLEMENTED_ACTS);
}

/** Zustand des Hauptauftrags von `act` aus dem Fortschritt im Spielstand (`act` wird auf die spielbaren Akte begrenzt). */
export function mainMission(act: number, actsCleared: number, actMissions: number): MainMission {
  const chosen = Math.max(1, Math.min(act, highestUnlockedAct(actsCleared)));
  const cleared = actsCleared >= chosen;
  const remaining = Math.max(0, MISSIONS_PER_ACT - actMissions);
  return {
    act: chosen,
    status: cleared ? 'repeat' : remaining === 0 ? 'ready' : 'locked',
    remaining: cleared ? 0 : remaining,
    allCleared: actsCleared >= IMPLEMENTED_ACTS,
  };
}
