import 'package:json_annotation/json_annotation.dart';

part 'models.g.dart';

@JsonSerializable()
class Player {
  final String id;
  final String name;
  final String avatar;
  final bool isHost;

  Player({
    required this.id,
    required this.name,
    required this.avatar,
    this.isHost = false,
  });

  factory Player.fromJson(Map<String, dynamic> json) => _$PlayerFromJson(json);
  Map<String, dynamic> toJson() => _$PlayerToJson(this);

  Player copyWith({
    String? id,
    String? name,
    String? avatar,
    bool? isHost,
  }) {
    return Player(
      id: id ?? this.id,
      name: name ?? this.name,
      avatar: avatar ?? this.avatar,
      isHost: isHost ?? this.isHost,
    );
  }
}

@JsonSerializable()
class GameManifest {
  final String id;
  final String name;
  final String version;
  final String sdkVersion;
  final List<String> permissions;
  final String author;
  final String entry;
  final int minPlayers;
  final int maxPlayers;
  final String? thumbnail;
  final Map<String, dynamic>? settingsSchema;
  final String? description;

  GameManifest({
    required this.id,
    required this.name,
    required this.version,
    required this.sdkVersion,
    required this.permissions,
    required this.author,
    required this.entry,
    required this.minPlayers,
    required this.maxPlayers,
    this.thumbnail,
    this.settingsSchema,
    this.description,
  });

  factory GameManifest.fromJson(Map<String, dynamic> json) => _$GameManifestFromJson(json);
  Map<String, dynamic> toJson() => _$GameManifestToJson(this);
}

enum RoomStatus { waiting, active, finished, abandoned }

@JsonSerializable()
class Room {
  final String id;
  final String code;
  final GameManifest game;
  final List<Player> players;
  final List<Player> spectators;
  final String hostId;
  final RoomStatus status;
  final Map<String, dynamic> settings;
  final Map<String, dynamic>? publicGameState;
  final DateTime createdAt;

  Room({
    required this.id,
    required this.code,
    required this.game,
    required this.players,
    required this.spectators,
    required this.hostId,
    required this.status,
    required this.settings,
    this.publicGameState,
    required this.createdAt,
  });

  Room copyWith({
    String? id,
    String? code,
    GameManifest? game,
    List<Player>? players,
    List<Player>? spectators,
    String? hostId,
    RoomStatus? status,
    Map<String, dynamic>? settings,
    Map<String, dynamic>? publicGameState,
    DateTime? createdAt,
  }) {
    return Room(
      id: id ?? this.id,
      code: code ?? this.code,
      game: game ?? this.game,
      players: players ?? this.players,
      spectators: spectators ?? this.spectators,
      hostId: hostId ?? this.hostId,
      status: status ?? this.status,
      settings: settings ?? this.settings,
      publicGameState: publicGameState ?? this.publicGameState,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  factory Room.fromJson(Map<String, dynamic> json) => _$RoomFromJson(json);
  Map<String, dynamic> toJson() => _$RoomToJson(this);
}
