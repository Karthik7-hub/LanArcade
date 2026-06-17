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
}

class ConnectionManager {
  final Map<String, Connection> _connections = {};

  int get activeCount => _connections.length;

  void addConnection(String id, WebSocketChannel socket) {
    _connections[id] = Connection(id, socket);
  }

  void removeConnection(String id) {
    _connections.remove(id);
  }

  Connection? getConnection(String id) => _connections[id];

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
}
