// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Player _$PlayerFromJson(Map<String, dynamic> json) => Player(
  id: json['id'] as String,
  name: json['name'] as String,
  avatar: json['avatar'] as String,
  isHost: json['isHost'] as bool? ?? false,
);

Map<String, dynamic> _$PlayerToJson(Player instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'avatar': instance.avatar,
  'isHost': instance.isHost,
};

GameManifest _$GameManifestFromJson(Map<String, dynamic> json) => GameManifest(
  id: json['id'] as String,
  name: json['name'] as String,
  version: json['version'] as String,
  sdkVersion: json['sdkVersion'] as String,
  permissions: (json['permissions'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
  author: json['author'] as String,
  entry: json['entry'] as String,
  minPlayers: (json['minPlayers'] as num).toInt(),
  maxPlayers: (json['maxPlayers'] as num).toInt(),
  preferredOrientation: json['preferredOrientation'] as String?,
  supportedOrientations: (json['supportedOrientations'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  displayOrder: (json['displayOrder'] as num?)?.toInt(),
  featured: json['featured'] as bool?,
  hidden: json['hidden'] as bool?,
  comingSoon: json['comingSoon'] as bool?,
  thumbnail: json['thumbnail'] as String?,
  settingsSchema: json['settingsSchema'] as Map<String, dynamic>?,
  description: json['description'] as String?,
  supportsHaptics: json['supportsHaptics'] as bool?,
  hapticProfile: json['hapticProfile'] as String?,
  accentColor: json['accentColor'] as String?,
  accentDark: json['accentDark'] as String?,
  badgeLabel: json['badgeLabel'] as String?,
);

Map<String, dynamic> _$GameManifestToJson(GameManifest instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'version': instance.version,
      'sdkVersion': instance.sdkVersion,
      'permissions': instance.permissions,
      'author': instance.author,
      'entry': instance.entry,
      'minPlayers': instance.minPlayers,
      'maxPlayers': instance.maxPlayers,
      'preferredOrientation': instance.preferredOrientation,
      'supportedOrientations': instance.supportedOrientations,
      'displayOrder': instance.displayOrder,
      'featured': instance.featured,
      'hidden': instance.hidden,
      'comingSoon': instance.comingSoon,
      'thumbnail': instance.thumbnail,
      'settingsSchema': instance.settingsSchema,
      'description': instance.description,
      'supportsHaptics': instance.supportsHaptics,
      'hapticProfile': instance.hapticProfile,
      'accentColor': instance.accentColor,
      'accentDark': instance.accentDark,
      'badgeLabel': instance.badgeLabel,
    };

Room _$RoomFromJson(Map<String, dynamic> json) => Room(
  id: json['id'] as String,
  code: json['code'] as String,
  game: GameManifest.fromJson(json['game'] as Map<String, dynamic>),
  players: (json['players'] as List<dynamic>)
      .map((e) => Player.fromJson(e as Map<String, dynamic>))
      .toList(),
  spectators: (json['spectators'] as List<dynamic>)
      .map((e) => Player.fromJson(e as Map<String, dynamic>))
      .toList(),
  hostId: json['hostId'] as String,
  status: $enumDecode(_$RoomStatusEnumMap, json['status']),
  settings: json['settings'] as Map<String, dynamic>,
  publicGameState: json['publicGameState'] as Map<String, dynamic>?,
  createdAt: DateTime.parse(json['createdAt'] as String),
);

Map<String, dynamic> _$RoomToJson(Room instance) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'game': instance.game,
  'players': instance.players,
  'spectators': instance.spectators,
  'hostId': instance.hostId,
  'status': _$RoomStatusEnumMap[instance.status]!,
  'settings': instance.settings,
  'publicGameState': instance.publicGameState,
  'createdAt': instance.createdAt.toIso8601String(),
};

const _$RoomStatusEnumMap = {
  RoomStatus.waiting: 'waiting',
  RoomStatus.active: 'active',
  RoomStatus.finished: 'finished',
  RoomStatus.abandoned: 'abandoned',
};
