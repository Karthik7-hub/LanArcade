import 'package:web_socket_channel/web_socket_channel.dart';
import 'dart:convert';
import '../shared/models.dart';

class Connection {
  final String id;
  final WebSocketChannel socket;
  Player? player;
  String? roomId;

  Connection(this.id, this.socket);

  void send(String type, dynamic payload) {
    socket.sink.add(jsonEncode({
      'type': type,
      'payload': payload,
    }));
  }

  void close() {
    socket.sink.close();
  }
}

class ConnectionManager {
  final Map<String, Connection> _connections = {};

  int get activeCount => _connections.length;

  /// Only counts connections that have completed player.identify
  int get identifiedCount => _connections.values.where((c) => c.player != null).length;

  int getActiveConnectionsCount(String roomId) {
    return _connections.values.where((conn) => conn.roomId == roomId).length;
  }

  bool isPlayerOnline(String playerId, String roomId) {
    return _connections.values.any((conn) => conn.player?.id == playerId && conn.roomId == roomId);
  }

  bool isPlayerOnlineGlobally(String playerId, String currentConnectionId) {
    return _connections.values.any((conn) => conn.player?.id == playerId && conn.id != currentConnectionId);
  }


  void addConnection(String id, WebSocketChannel socket) {
    _connections[id] = Connection(id, socket);
  }

  void removeConnection(String id) {
    _connections.remove(id);
  }

  Connection? getConnection(String id) => _connections[id];

  void removeStaleConnections(String playerId, String keepConnectionId) {
    final toRemove = <String>[];
    for (var conn in _connections.values) {
      if (conn.player?.id == playerId && conn.id != keepConnectionId) {
        toRemove.add(conn.id);
        try {
          conn.close();
        } catch (_) {}
      }
    }
    for (var id in toRemove) {
      _connections.remove(id);
    }
  }

  void broadcastToRoom(String roomId, String type, dynamic payload) {
    for (var conn in _connections.values) {
      if (conn.roomId == roomId) {
        conn.send(type, payload);
      }
    }
  }

  void sendPrivate(String playerId, String type, dynamic payload) {
    for (var conn in _connections.values) {
      if (conn.player?.id == playerId) {
        conn.send(type, payload);
      }
    }
  }

  void broadcastAll(String type, dynamic payload) {
    for (var conn in _connections.values) {
      conn.send(type, payload);
    }
  }

  void evictRoom(String roomId) {
    for (var conn in _connections.values) {
      if (conn.roomId == roomId) {
        conn.send('room.update', null);
        conn.roomId = null;
      }
    }
  }

  void closeAll() {
    for (var conn in _connections.values) {
      try {
        conn.close();
      } catch (_) {}
    }
    _connections.clear();
  }
}

