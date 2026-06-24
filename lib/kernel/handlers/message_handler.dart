import 'dart:async';

import 'package:uuid/uuid.dart';
import 'package:logging/logging.dart';

import '../connection_manager.dart';
import '../../rooms/room_service.dart';
import '../../database/database.dart';
import '../../shared/models.dart' as models;
import '../../plugins/js_engine.dart';
import '../../plugins/plugin_manager.dart';

/// Shared context exposing kernel state to message handlers.
///
/// Implemented by [KernelRuntime] so handlers can access shared mutable
/// state without depending on the full runtime class.
abstract class KernelContext {
  ConnectionManager get connectionManager;
  Map<String, JsEngine> get activeEngines;
  Map<String, models.Room> get roomData;
  Map<String, Timer> get cleanupTimers;
  Map<String, DateTime> get lastStateWrite;
  AppDatabase get db;
  RoomService get roomService;
  PluginManager get pluginManager;
  Uuid get uuid;

  void logSystemEvent(String msg);
  void addStats(Map<String, dynamic> event);
}

/// Base class for all WebSocket message handlers.
abstract class MessageHandler {
  Future<void> handle(
      String connectionId, dynamic payload, KernelContext ctx);
}

/// Routes incoming WebSocket messages to registered [MessageHandler]s by type.
///
/// Replaces the giant switch statement in KernelRuntime._handleMessage with
/// an O(1) map lookup.
class MessageRouter {
  static final _log = Logger('MessageRouter');
  final Map<String, MessageHandler> _registry = {};

  void register(String type, MessageHandler handler) {
    _registry[type] = handler;
  }

  Future<void> route(String connectionId, String type, dynamic payload,
      KernelContext ctx) async {
    // Common precondition: connection must still exist.
    if (ctx.connectionManager.getConnection(connectionId) == null) return;

    final handler = _registry[type];
    if (handler != null) {
      await handler.handle(connectionId, payload, ctx);
    } else {
      _log.warning('No handler registered for message type: $type');
    }
  }
}

/// Trivial handler for keep-alive pings.
class PingHandler extends MessageHandler {
  @override
  Future<void> handle(
      String connectionId, dynamic payload, KernelContext ctx) async {
    final connection = ctx.connectionManager.getConnection(connectionId);
    connection?.send('pong', null);
  }
}
