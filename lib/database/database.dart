import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'dart:io';
import '../shared/models.dart';

part 'database.g.dart';

@DataClassName('DbPlayer')
class Players extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get avatar => text()();
  TextColumn get sessionToken => text().nullable()();
  DateTimeColumn get lastSeen => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

@DataClassName('DbRoom')
class Rooms extends Table {
  TextColumn get id => text()();
  TextColumn get code => text()();
  TextColumn get gameId => text()();
  TextColumn get hostId => text()();
  TextColumn get playersJson => text()(); // Persist player list for recovery
  IntColumn get status => intEnum<RoomStatus>()();
  TextColumn get settingsJson => text()();
  TextColumn get publicGameStateJson => text().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get lastActiveAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class EventLog extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get roomId => text().references(Rooms, #id)();
  TextColumn get type => text()();
  TextColumn get payloadJson => text()();
  DateTimeColumn get timestamp => dateTime()();
}

class GameStats extends Table {
  TextColumn get playerId => text().references(Players, #id)();
  TextColumn get gameId => text()();
  IntColumn get wins => integer().withDefault(const Constant(0))();
  IntColumn get losses => integer().withDefault(const Constant(0))();
  IntColumn get totalPoints => integer().withDefault(const Constant(0))();
  TextColumn get customStatsJson => text().nullable()();

  @override
  Set<Column> get primaryKey => {playerId, gameId};
}

class Achievements extends Table {
  TextColumn get playerId => text().references(Players, #id)();
  TextColumn get gameId => text()();
  TextColumn get achievementId => text()();
  DateTimeColumn get unlockedAt => dateTime()();

  @override
  Set<Column> get primaryKey => {playerId, gameId, achievementId};
}

@DriftDatabase(tables: [Players, Rooms, EventLog, GameStats, Achievements])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 4;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) async {
          await m.createAll();
        },
        onUpgrade: (m, from, to) async {
          if (from < 2) {
            await m.createTable(achievements);
          }
          if (from < 3) {
            try {
              await m.addColumn(rooms, rooms.lastActiveAt);
            } catch (e) {
              // Ignore if column already exists due to partial upgrades
            }
          }
          if (from < 4) {
            try {
              await m.addColumn(players, players.sessionToken);
            } catch (e) {
              // Ignore if column already exists
            }
          }
        },
        beforeOpen: (details) async {
          await customStatement('PRAGMA foreign_keys = ON;');
        },
      );
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'arcade.sqlite'));
    return NativeDatabase(file, setup: (rawDb) {
      rawDb.execute('PRAGMA journal_mode = WAL;');
      rawDb.execute('PRAGMA synchronous = NORMAL;');
      rawDb.execute('PRAGMA foreign_keys = ON;');
    });
  });
}
