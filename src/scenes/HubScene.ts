import Phaser from 'phaser';
import {
  GAME_EVENTS,
  MAX_FRAME_SECONDS,
  REGISTRY_PROFILE,
  REGISTRY_SESSION,
  SCENE_KEYS,
  TEXTURE_KEYS,
  TEXTURE_RES,
  TEXTURE_SCALE,
  TILE_SIZE,
  actorTextureKey,
} from '../config/constants';
import { COLORS } from '../config/palette';
import type { TileGrid } from '../core/grid';
import { parseLevel } from '../core/level';
import type { Vec2 } from '../core/math';
import type { Profile } from '../core/profile';
import { createRng } from '../core/rng';
import type { Rng } from '../core/rng';
import { CLASSES, CLASS_LIST } from '../data/classes';
import type { ImplementedClassId } from '../data/classes';
import { HUB_LAYOUT, HUB_MARKERS } from '../data/levels/hub';
import type { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Station, STATION_INTERACT_RADIUS } from '../entities/Station';
import type { StationKind } from '../entities/Station';
import type { WorldContext } from '../entities/WorldContext';
import { t } from '../i18n';
import type { TextKey } from '../i18n';
import type { Session } from '../persistence/session';
import { CombatSystem } from '../systems/CombatSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { ResponsiveCamera } from '../systems/ResponsiveCamera';
import { TapControlSystem } from '../systems/TapControlSystem';
import type { HudScene } from './HudScene';

/** Abstand in Pixeln, in dem ein Tipp eine Station oder ein Besatzungsmitglied trifft. */
const TAP_RADIUS = 26;
const SPEECH_MS = 4200;

interface CrewMember {
  id: string;
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  lineIndex: number;
}

/**
 * Die Rocinante als begehbarer Hub: Die Figur läuft per Tippen zu Stationen (Missionskonsole, Waffenkammer,
 * Händler, Spielstand-Terminal) und benutzt sie; Besatzungsmitglieder haben ein paar Worte.
 */
export class HubScene extends Phaser.Scene implements WorldContext {
  grid!: TileGrid;
  rng!: Rng;
  combat!: CombatSystem;
  projectiles!: ProjectileSystem;
  player!: Player;
  readonly enemies: readonly Enemy[] = [];

  /** Im Hub gibt es keine Kämpfe, also auch keine Verbündeten. */
  spawnAlly(): null {
    return null;
  }

  private stations: Station[] = [];
  private crew: CrewMember[] = [];
  private pending: Station | null = null;
  private speech: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(SCENE_KEYS.hub);
  }

  create(): void {
    const profile = this.registry.get(REGISTRY_PROFILE) as Profile;
    const level = parseLevel(HUB_LAYOUT, TILE_SIZE, HUB_MARKERS);
    this.grid = level.grid;
    this.rng = createRng(Date.now());
    this.combat = new CombatSystem(this, this.rng);
    this.projectiles = new ProjectileSystem(this, this, () => []);
    this.combat.projectiles = this.projectiles;
    this.stations = [];
    this.crew = [];
    this.pending = null;
    this.speech = null;

    this.createTilemap();
    const kinds: [string, StationKind][] = [['M', 'missions'], ['W', 'locker'], ['H', 'trader'], ['T', 'terminal']];
    for (const [marker, kind] of kinds) {
      const at = level.markers[marker]?.[0];
      if (at) this.stations.push(new Station(this, at.x, at.y, kind));
    }
    this.placeCrew(level.markers.n ?? [], profile.classId);

    const classDef = CLASSES[profile.classId as ImplementedClassId] ?? CLASSES.amos;
    this.player = new Player(this, this, level.playerStart.x, level.playerStart.y, classDef, profile);

    new ResponsiveCamera(this, this.grid, this.player);
    new TapControlSystem(
      this,
      this.player,
      () => [],
      (x, y) => (this.scene.get(SCENE_KEYS.hud) as HudScene).isOverUi(x, y),
      () => this.sys.isPaused(),
      (x, y) => this.onWorldTap(x, y),
    );

    if (!this.scene.isActive(SCENE_KEYS.hud)) this.scene.launch(SCENE_KEYS.hud);
    this.game.events.emit(GAME_EVENTS.hubReady, this.player);
  }

  override update(time: number, delta: number): void {
    const dt = Math.min(delta / 1000, MAX_FRAME_SECONDS);
    this.player.tick(dt);
    for (const station of this.stations) station.tick(time);

    const station = this.pending;
    if (station && Phaser.Math.Distance.Between(this.player.x, this.player.y, station.x, station.y) <= STATION_INTERACT_RADIUS) {
      this.pending = null;
      this.player.cancelCommands();
      this.open(station.kind);
    }
  }

  // ---------------------------------------------------------------- Eingabe

  /** Tipp auf eine Station: hinlaufen und benutzen; Tipp auf Besatzung: sprechen. Alles andere läuft normal. */
  private onWorldTap(x: number, y: number): boolean {
    this.pending = null;

    const station = this.stations.find((s) => Phaser.Math.Distance.Between(x, y, s.x, s.y) <= TAP_RADIUS);
    if (station) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, station.x, station.y) <= STATION_INTERACT_RADIUS) {
        this.open(station.kind);
      } else if (this.player.commandMoveTo(station.x, station.y)) {
        this.pending = station;
      }
      return true;
    }

    const member = this.crew.find((c) => Phaser.Math.Distance.Between(x, y, c.x, c.y) <= TAP_RADIUS);
    if (member) {
      this.say(member);
      return true;
    }
    return false;
  }

  private open(kind: StationKind): void {
    switch (kind) {
      case 'missions':
        this.openOverlay(SCENE_KEYS.missionSelect);
        break;
      case 'locker':
        this.openOverlay(SCENE_KEYS.inventory);
        break;
      case 'trader':
        this.openOverlay(SCENE_KEYS.shop);
        break;
      case 'terminal':
        (this.registry.get(REGISTRY_SESSION) as Session).end();
        this.scene.start(SCENE_KEYS.title);
        break;
    }
  }

  private openOverlay(key: string): void {
    this.scene.pause();
    this.scene.launch(key, { parent: SCENE_KEYS.hub });
  }

  // ---------------------------------------------------------------- Besatzung

  /** Die übrigen drei Figuren stehen an den Besatzungsplätzen (die gewählte Figur spielst du selbst). */
  private placeCrew(spots: Vec2[], playerClassId: string): void {
    const others = CLASS_LIST.filter((info) => info.id !== playerClassId);
    spots.forEach((spot, i) => {
      const info = others[i];
      if (!info) return;
      const sprite = this.add.image(spot.x, spot.y, actorTextureKey(info.id)).setScale(TEXTURE_SCALE).setDepth(9);
      sprite.setRotation(this.rng.next() * Math.PI * 2);
      this.add
        .text(spot.x, spot.y + 18, t(info.nameKey), {
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: `#${info.color.toString(16).padStart(6, '0')}`,
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0)
        .setDepth(9)
        .setResolution(Math.ceil(this.cameras.main.zoom));
      this.crew.push({ id: info.id, sprite, x: spot.x, y: spot.y, lineIndex: 0 });
    });
  }

  private say(member: CrewMember): void {
    const key = `crew.${member.id}.${(member.lineIndex % 2) + 1}` as TextKey;
    member.lineIndex++;
    this.speech?.destroy();
    this.speech = this.add
      .text(member.x, member.y - 20, t(key), {
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#121a30',
        padding: { x: 6, y: 4 },
        wordWrap: { width: 170 },
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setDepth(100)
      .setResolution(Math.ceil(this.cameras.main.zoom));
    const bubble = this.speech;
    this.time.delayedCall(SPEECH_MS, () => {
      if (this.speech === bubble) this.speech = null;
      bubble.destroy();
    });
  }

  private createTilemap(): void {
    const tileSizeInTexture = TILE_SIZE * TEXTURE_RES;
    const data = this.grid.toRowsOfIds().map((line, row) => line.map((id, col) => (id === 1 && !this.grid.isWallEdge(col, row) ? -1 : id)));
    const map = this.make.tilemap({ data, tileWidth: tileSizeInTexture, tileHeight: tileSizeInTexture });
    const tileset = map.addTilesetImage('tiles', TEXTURE_KEYS.tiles);
    if (!tileset) throw new Error('Tileset konnte nicht erzeugt werden');
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('Tilemap-Ebene konnte nicht erzeugt werden');
    layer.setScale(TEXTURE_SCALE).setDepth(0);
    this.cameras.main.setBackgroundColor(COLORS.background);
  }
}
