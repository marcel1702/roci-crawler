import Phaser from 'phaser';
import {
  CHEST,
  EXIT_RADIUS,
  GAME_EVENTS,
  MAX_FRAME_SECONDS,
  MISSION_EVENTS,
  LEVEL_SCALING,
  LOOT,
  REGISTRY_PROFILE,
  SCENE_KEYS,
  TEXTURE_KEYS,
  TEXTURE_RES,
  TEXTURE_SCALE,
  TILE_SIZE,
} from '../config/constants';
import { COLORS } from '../config/palette';
import { DIFFICULTY_RULES } from '../core/contracts';
import type { Difficulty } from '../core/contracts';
import { generateDungeon } from '../core/dungeon';
import { planMission } from '../core/encounters';
import type { TileGrid } from '../core/grid';
import { parseLevel } from '../core/level';
import { rollItem } from '../core/items';
import type { Vec2 } from '../core/math';
import { Profile } from '../core/profile';
import { createRng } from '../core/rng';
import type { Rng } from '../core/rng';
import { CLASSES } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import type { EnemyId } from '../data/enemies';
import { ITEM_RULES } from '../data/items';
import { TEST_ARENA, TEST_ARENA_WAVES } from '../data/levels/testArena';
import { DROP_CHANCE, RARITY_WEIGHTS, boostedWeights } from '../data/loot';
import { ACT1_SPAWNS } from '../data/spawnTables';
import type { LootSource } from '../data/types';
import type { Actor, Team } from '../entities/Actor';
import { Chest } from '../entities/Chest';
import { Enemy } from '../entities/Enemy';
import type { Difficulty as EnemyDifficulty } from '../entities/Enemy';
import { ExitPortal } from '../entities/ExitPortal';
import { LootDrop } from '../entities/LootDrop';
import { Player } from '../entities/Player';
import type { WorldContext } from '../entities/WorldContext';
import { t } from '../i18n';
import type { TextKey } from '../i18n';
import { itemName } from '../i18n/items';
import { CombatSystem } from '../systems/CombatSystem';
import { FogSystem } from '../systems/FogSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { ResponsiveCamera } from '../systems/ResponsiveCamera';
import { separateActors } from '../systems/SeparationSystem';
import { TapControlSystem } from '../systems/TapControlSystem';
import type { HudScene } from './HudScene';

const NEXT_WAVE_DELAY_MS = 3000;
/** Neue Gegner der Testarena erscheinen nicht näher als so viele Pixel am Spieler. */
const MIN_SPAWN_DISTANCE = 170;

/** `dungeon`: zufällige Mission mit Ausgang; `arena`: Testarena mit endlosen Gegnerwellen (zum Ausprobieren). */
export type MissionConfig = { kind: 'dungeon'; seed: number; difficulty?: Difficulty } | { kind: 'arena' };

export interface MissionStats {
  timeMs: number;
  kills: number;
  chestsOpened: number;
  chestsTotal: number;
  credits: number;
  xp: number;
  items: number;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/**
 * Spielwelt einer Mission: Karte, Gegner, Truhen, Ausgang, Nebel. Die Szene wird mit einer `MissionConfig`
 * gestartet und bei Tod oder Missionsende mit einer neuen Konfiguration neu gestartet.
 */
export class MissionScene extends Phaser.Scene implements WorldContext {
  grid!: TileGrid;
  rng!: Rng;
  combat!: CombatSystem;
  projectiles!: ProjectileSystem;
  player!: Player;
  enemies: Enemy[] = [];
  chests: Chest[] = [];
  drops: LootDrop[] = [];
  exitPortal: ExitPortal | null = null;
  fog: FogSystem | null = null;
  config: MissionConfig = { kind: 'dungeon', seed: 1 };
  waveNumber = 0;
  objectiveKey: TextKey | null = null;
  missionOver = false;

  private playerStart!: Vec2;
  private arenaSpawns: Vec2[] = [];
  private guardians = new Set<Enemy>();
  private stats!: MissionStats;
  private startedAtMs = 0;
  private waveScheduled = false;
  private deathAnnounced = false;

  constructor() {
    super(SCENE_KEYS.mission);
  }

  init(config?: MissionConfig): void {
    this.config = config ?? { kind: 'dungeon', seed: randomSeed() };
  }

  create(): void {
    this.enemies = [];
    this.chests = [];
    this.drops = [];
    this.exitPortal = null;
    this.fog = null;
    this.guardians = new Set();
    this.waveNumber = 0;
    this.waveScheduled = false;
    this.deathAnnounced = false;
    this.missionOver = false;
    this.objectiveKey = null;
    this.stats = { timeMs: 0, kills: 0, chestsOpened: 0, chestsTotal: 0, credits: 0, xp: 0, items: 0 };
    this.startedAtMs = this.time.now;

    this.rng = createRng(Date.now());
    this.combat = new CombatSystem(this, this.rng);
    this.projectiles = new ProjectileSystem(this, this, (team) => this.actorsOf(team));

    if (this.config.kind === 'dungeon') this.buildDungeon(this.config.seed);
    else this.buildArena();
    this.createTilemap();

    this.player = new Player(this, this, this.playerStart.x, this.playerStart.y, CLASSES.amos, this.profile());
    this.spawnPending();

    if (this.config.kind === 'dungeon') {
      this.fog = new FogSystem(this, this.grid, this.player);
      this.setObjective('hud.objective.find');
    } else {
      this.startWave();
    }

    new ResponsiveCamera(this, this.grid, this.player);
    new TapControlSystem(
      this,
      this.player,
      () => this.enemies,
      (x, y) => (this.scene.get(SCENE_KEYS.hud) as HudScene).isOverUi(x, y),
      () => this.player.isDead || this.missionOver || this.sys.isPaused(),
    );

    this.events.on(MISSION_EVENTS.actorKilled, this.onActorKilled, this);
    this.game.events.on(GAME_EVENTS.restartRequested, this.restart, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(MISSION_EVENTS.actorKilled, this.onActorKilled, this);
      this.game.events.off(GAME_EVENTS.restartRequested, this.restart, this);
    });
    if (!this.scene.isActive(SCENE_KEYS.hud)) this.scene.launch(SCENE_KEYS.hud);
    this.game.events.emit(GAME_EVENTS.missionReady, this.player);
  }

  override update(time: number, delta: number): void {
    const dt = Math.min(delta / 1000, MAX_FRAME_SECONDS);

    this.player.tick(dt);
    if (!this.missionOver) for (const enemy of this.enemies) enemy.tick(dt, this.player);
    this.projectiles.update(dt);
    separateActors(this.player, this.enemies);
    this.enemies = this.enemies.filter((enemy) => !enemy.isDead);
    this.fog?.update();

    if (this.player.isDead) {
      if (!this.deathAnnounced) {
        this.deathAnnounced = true;
        this.game.events.emit(GAME_EVENTS.playerDied);
      }
      return;
    }
    this.collectLoot();
    if (this.config.kind === 'dungeon') this.updateDungeon(time);
    else this.updateArena();
  }

  spawnEnemy(id: EnemyId, x: number, y: number, difficulty?: EnemyDifficulty): Enemy {
    const enemy = new Enemy(this, this, x, y, ENEMIES[id], difficulty);
    this.enemies.push(enemy);
    return enemy;
  }

  // ---------------------------------------------------------------- Aufbau

  private pendingEnemies: { id: EnemyId; x: number; y: number; guardian: boolean }[] = [];
  private pendingChests: Vec2[] = [];
  private pendingExit: Vec2 | null = null;

  private buildDungeon(seed: number): void {
    const dungeon = generateDungeon(seed, TILE_SIZE);
    // Aufteilung und Gegner hängen nur vom Seed ab; der Kampf-Zufall (Schaden) bleibt davon getrennt.
    const plan = planMission(dungeon, ACT1_SPAWNS, createRng(seed ^ 0x9e3779b9));
    this.grid = dungeon.grid;
    this.playerStart = plan.playerStart;
    this.pendingEnemies = plan.encounters.flatMap((encounter) =>
      encounter.enemies.map((e) => ({ id: e.id, x: e.x, y: e.y, guardian: encounter.roomId === plan.exitRoomId })),
    );
    this.pendingChests = plan.chests.map((c) => ({ x: c.x, y: c.y }));
    this.pendingExit = plan.exit;
    this.stats.chestsTotal = plan.chests.length;
  }

  private buildArena(): void {
    const level = parseLevel(TEST_ARENA, TILE_SIZE);
    this.grid = level.grid;
    this.playerStart = level.playerStart;
    this.arenaSpawns = level.enemySpawns;
    this.pendingEnemies = [];
    this.pendingChests = [];
    this.pendingExit = null;
  }

  /** Legt Gegner, Truhen und Ausgang an, sobald die Welt steht. */
  private spawnPending(): void {
    const steps = this.player.progression.level - 1;
    const rules = this.difficultyRules();
    const difficulty = {
      hp: (1 + LEVEL_SCALING.hpPerLevel * steps) * rules.hp,
      damage: (1 + LEVEL_SCALING.damagePerLevel * steps) * rules.damage,
    };
    for (const e of this.pendingEnemies) {
      const enemy = this.spawnEnemy(e.id, e.x, e.y, difficulty);
      if (e.guardian) this.guardians.add(enemy);
    }
    this.chests = this.pendingChests.map((c) => new Chest(this, c.x, c.y));
    if (this.pendingExit) this.exitPortal = new ExitPortal(this, this.pendingExit.x, this.pendingExit.y);
  }

  private createTilemap(): void {
    const tileSizeInTexture = TILE_SIZE * TEXTURE_RES;
    // Gestein, das an keinen begehbaren Bereich grenzt, wird nicht gezeichnet (-1 = leer).
    const data = this.grid.toRowsOfIds().map((line, row) => line.map((id, col) => (id === 1 && !this.grid.isWallEdge(col, row) ? -1 : id)));
    const map = this.make.tilemap({ data, tileWidth: tileSizeInTexture, tileHeight: tileSizeInTexture });
    const tileset = map.addTilesetImage('tiles', TEXTURE_KEYS.tiles);
    if (!tileset) throw new Error('Tileset konnte nicht erzeugt werden');
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('Tilemap-Ebene konnte nicht erzeugt werden');
    layer.setScale(TEXTURE_SCALE).setDepth(0);
  }

  // ---------------------------------------------------------------- Dungeon-Mission

  private updateDungeon(time: number): void {
    const { player } = this;
    const exit = this.exitPortal;
    if (this.missionOver || !exit) return;

    for (const chest of this.chests) {
      if (!chest.isOpen && Phaser.Math.Distance.Between(player.x, player.y, chest.x, chest.y) <= CHEST.openRadius) {
        this.openChest(chest);
      }
    }

    exit.tick(time);
    if (!exit.isOpen && [...this.guardians].every((g) => g.isDead)) {
      exit.unlock();
      this.combat.floatText(exit.x, exit.y - 30, t('hud.exitUnlocked'), '#8dffb0', 13);
      this.combat.ring(exit.x, exit.y, 50, COLORS.exitOpen, 500);
    }
    if (exit.isOpen && Phaser.Math.Distance.Between(player.x, player.y, exit.x, exit.y) <= EXIT_RADIUS) {
      this.completeMission();
      return;
    }

    const next: TextKey = exit.isOpen
      ? 'hud.objective.reach'
      : this.fog?.isExploredAt(exit.x, exit.y)
        ? 'hud.objective.guards'
        : 'hud.objective.find';
    this.setObjective(next);
  }

  private openChest(chest: Chest): void {
    chest.markOpened();
    this.stats.chestsOpened++;
    const credits = Math.round(this.rng.int(CHEST.creditsMin, CHEST.creditsMax) * this.difficultyRules().credits);
    this.profile().wallet.add(credits);
    this.stats.credits += credits;
    this.dropLoot('chest', chest.x, chest.y);
    this.combat.floatText(chest.x, chest.y - 18, t('hud.credits', { amount: credits }), COLORS.credits, 14);
    this.combat.ring(chest.x, chest.y, 30, 0xffd34d, 350);
    if (this.rng.chance(CHEST.potionChance) && this.player.potions < this.player.maxPotions) this.player.potions++;
    this.profile().touch();
  }

  private completeMission(): void {
    this.missionOver = true;
    this.stats.timeMs = this.time.now - this.startedAtMs;
    this.player.cancelCommands();
    this.profile().missionsCompleted++;
    this.profile().touch();
    this.game.events.emit(GAME_EVENTS.missionCompleted, { ...this.stats });
  }

  private setObjective(key: TextKey): void {
    if (this.objectiveKey === key) return;
    this.objectiveKey = key;
    this.game.events.emit(GAME_EVENTS.objectiveChanged, key);
  }

  // ---------------------------------------------------------------- Testarena

  private updateArena(): void {
    if (this.enemies.length === 0 && !this.waveScheduled) {
      this.waveScheduled = true;
      this.game.events.emit(GAME_EVENTS.waveCleared, this.waveNumber);
      this.time.delayedCall(NEXT_WAVE_DELAY_MS, () => {
        if (this.player.isDead) return;
        this.startWave();
        this.waveScheduled = false;
      });
    }
  }

  /** Nächste Welle der Testarena; nach der letzten beginnt die Folge von vorn mit härteren Gegnern. */
  private startWave(): void {
    this.waveNumber++;
    const index = this.waveNumber - 1;
    const composition = TEST_ARENA_WAVES[index % TEST_ARENA_WAVES.length] ?? [];
    const loop = Math.floor(index / TEST_ARENA_WAVES.length);
    const difficulty = { hp: 1 + 0.25 * loop, damage: 1 + 0.12 * loop };

    const far = this.arenaSpawns.filter(
      (spawn) => Phaser.Math.Distance.Between(spawn.x, spawn.y, this.player.x, this.player.y) >= MIN_SPAWN_DISTANCE,
    );
    const spawns = this.rng.shuffle(far.length > 0 ? far : this.arenaSpawns);

    composition.forEach((id, i) => {
      const spawn = spawns[i % spawns.length];
      if (!spawn) return;
      // Gibt es mehr Gegner als Spawnpunkte, werden sie leicht versetzt, damit sie nicht aufeinander stehen.
      const offset = i >= spawns.length ? { x: this.rng.int(-14, 14), y: this.rng.int(-14, 14) } : { x: 0, y: 0 };
      this.spawnEnemy(id, spawn.x + offset.x, spawn.y + offset.y, difficulty);
    });
    this.game.events.emit(GAME_EVENTS.waveStarted, this.waveNumber);
  }

  // ---------------------------------------------------------------- Gemeinsames

  private actorsOf(team: Team): readonly Actor[] {
    return team === 'player' ? [this.player] : this.enemies;
  }

  private difficultyRules(): (typeof DIFFICULTY_RULES)[Difficulty] {
    return DIFFICULTY_RULES[this.config.kind === 'dungeon' ? (this.config.difficulty ?? 'normal') : 'normal'];
  }

  /** Spielstand (Fortschritt, Credits, Gegenstände); wird von der Titelseite oder dem Start geladen. */
  private profile(): Profile {
    let profile = this.registry.get(REGISTRY_PROFILE) as Profile | undefined;
    if (!profile) {
      profile = new Profile(ITEM_RULES);
      this.registry.set(REGISTRY_PROFILE, profile);
    }
    return profile;
  }

  /** Würfelt Beute für die Quelle und legt sie neben `(x, y)` ab. */
  private dropLoot(source: LootSource, x: number, y: number): void {
    if (!this.rng.chance(DROP_CHANCE[source])) return;
    const item = rollItem(this.rng, ITEM_RULES, {
      itemLevel: this.player.progression.level,
      rarityWeights: boostedWeights(RARITY_WEIGHTS[source], this.difficultyRules().loot),
    });
    const offset = LootDrop.randomOffset(this.rng);
    const drop = new LootDrop(this, x + offset.x, y + offset.y, item);
    // Nie in eine Wand fallen lassen.
    if (this.grid.isSolid(this.grid.toCol(drop.x), this.grid.toRow(drop.y))) drop.setPosition(x, y);
    drop.popFrom(x, y);
    this.drops.push(drop);
  }

  /** Hebt Beute auf, über die die Figur läuft; bei vollem Rucksack bleibt sie liegen. */
  private collectLoot(): void {
    const inventory = this.profile().inventory;
    for (const drop of this.drops) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, drop.x, drop.y) > LOOT.pickupRadius) continue;
      if (inventory.add(drop.item)) {
        this.drops = this.drops.filter((d) => d !== drop);
        this.stats.items++;
        this.combat.floatText(drop.x, drop.y - 16, t('inv.picked', { name: itemName(drop.item) }), rarityColor(drop.item.rarity), 12);
        drop.destroy();
        this.profile().touch();
      } else if (this.time.now - drop.lastFullWarningMs > 1500) {
        drop.lastFullWarningMs = this.time.now;
        this.combat.floatText(drop.x, drop.y - 16, t('inv.bagFull'), COLORS.damageTaken, 12);
      }
    }
  }

  private onActorKilled(victim: Actor): void {
    if (!(victim instanceof Enemy) || this.player.isDead) return;
    this.stats.kills++;
    this.stats.xp += victim.def.xp;
    this.player.gainXp(victim.def.xp);
    this.dropLoot(this.guardians.has(victim) ? 'guardian' : (victim.def.loot ?? 'enemy'), victim.x, victim.y);
    this.profile().touch();
    this.combat.floatText(victim.x, victim.y - victim.radius - 18, t('hud.xp', { amount: victim.def.xp }), COLORS.xpText, 12);
  }

  /** Nach Tod oder Missionsende: Dungeon-Missionen kehren in den Hub zurück, die Testarena startet neu. */
  private restart(): void {
    if (this.config.kind === 'dungeon') this.scene.start(SCENE_KEYS.hub);
    else this.scene.restart(this.config);
  }
}

function rarityColor(rarity: keyof typeof COLORS.rarity): string {
  return `#${COLORS.rarity[rarity].toString(16).padStart(6, '0')}`;
}
