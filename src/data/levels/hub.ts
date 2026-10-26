import type { LevelLayout } from '../../core/level';

/**
 * Die Rocinante von oben: links das Cockpit, in der Mitte der Gang mit Messe (oben) und Waffenkammer (unten),
 * rechts der Frachtraum. Markierungen: `M` Missionskonsole, `W` Waffenkammer, `H` Händler, `T` Terminal
 * (Spielstand wechseln), `n` Platz für ein Besatzungsmitglied, `@` Start.
 */
export const HUB_LAYOUT: LevelLayout = {
  rows: [
    '####################################',
    '###########...........##############',
    '###########..n.....n..##############',
    '###########....###....#######......#',
    '###########.........n.#######.T....#',
    '#........##...........#######......#',
    '#........###..###############..#...#',
    '#..............................#...#',
    '#.M...................@............#',
    '#...............................#..#',
    '#........####..##############...#..#',
    '#........#.........##########....H.#',
    '##########.........##########......#',
    '##########..W......##########......#',
    '##########.........#################',
    '##########.........#################',
    '####################################',
  ],
};

/** Zeichen der Stationen und Besatzungsplätze in `HUB_LAYOUT`. */
export const HUB_MARKERS = 'MWHTn';
