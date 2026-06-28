import 'package:flutter/material.dart';
import 'arcade_fonts.dart';
import '../kernel/kernel_manager.dart';
import '../kernel/cleanup_settings.dart';
import '../shared/models.dart';
import 'theme.dart';

class StorageCleanupScreen extends StatefulWidget {
  final KernelManager kernel;
  const StorageCleanupScreen({super.key, required this.kernel});

  @override
  State<StorageCleanupScreen> createState() => _StorageCleanupScreenState();
}

class _StorageCleanupScreenState extends State<StorageCleanupScreen> {
  static final TextStyle _firaCodeStyle = ArcadeFonts.firaCode();
  static final TextStyle _plusJakartaSansStyle = ArcadeFonts.plusJakartaSans();

  bool _isLoading = true;
  Map<String, dynamic> _stats = {};
  List<RoomStorageDetail> _rooms = [];

  // Auto-cleanup dropdown selections
  bool _autoCleanup = true;
  int _completedDays = 7;
  int _abandonedHours = 24;
  int _reconnectHours = 48;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
    });

    final stats = await widget.kernel.getStorageStats();
    final settings = await widget.kernel.getCleanupSettings();
    final rooms = await widget.kernel.getRoomStorageDetails();

    setState(() {
      _stats = stats;
      _autoCleanup = settings.autoCleanup;
      _completedDays = settings.completedMatchesDays;
      _abandonedHours = settings.abandonedRoomsHours;
      _reconnectHours = settings.reconnectStatesHours;
      _rooms = rooms;
      _isLoading = false;
    });
  }

  Future<void> _saveSettings() async {
    final newSettings = CleanupSettings(
      autoCleanup: _autoCleanup,
      completedMatchesDays: _completedDays,
      abandonedRoomsHours: _abandonedHours,
      reconnectStatesHours: _reconnectHours,
    );

    await widget.kernel.saveCleanupSettings(newSettings);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Settings saved!'),
        backgroundColor: ArcadeTheme.cardColor,
      ),
    );
    _loadData();
  }

  Future<void> _triggerCleanup(Future<void> Function() cleanupFn, String message) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('DELETE DATA?'),
        content: Text(
          'Are you sure you want to delete this data? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('CANCEL'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: ArcadeTheme.errorColor,
              foregroundColor: Colors.white,
            ),
            child: const Text('DELETE'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      setState(() {
        _isLoading = true;
      });
      await cleanupFn();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Data deleted.'),
          backgroundColor: ArcadeTheme.cardColor,
        ),
      );
      _loadData();
    }
  }

  Future<void> _triggerFullCleanup() async {
    final textController = TextEditingController();
    bool canDelete = false;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            title: Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: ArcadeTheme.errorColor, size: 28),
                const SizedBox(width: 8),
                const Text(
                  'DELETE EVERYTHING?',
                  style: TextStyle(color: ArcadeTheme.errorColor),
                ),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'This will permanently delete all rooms, logs, and reconnect data. '
                  'Player stats and profiles will NOT be deleted. '
                  'This cannot be undone. Type "DELETE" to confirm:',
                  style: TextStyle(fontSize: 13),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: textController,
                  autofocus: true,
                  style: ArcadeFonts.firaCode(color: ArcadeTheme.textPrimary),
                  decoration: const InputDecoration(
                    hintText: 'DELETE',
                  ),
                  onChanged: (text) {
                    setDialogState(() {
                      canDelete = text.trim().toUpperCase() == 'DELETE';
                    });
                  },
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('CANCEL'),
              ),
              ElevatedButton(
                onPressed: canDelete ? () => Navigator.of(context).pop(true) : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: ArcadeTheme.errorColor,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: ArcadeTheme.errorColor.withValues(alpha: 0.3),
                ),
                child: const Text('DELETE ALL'),
              ),
            ],
          );
        },
      ),
    );

    if (confirm == true) {
      setState(() {
        _isLoading = true;
      });
      await widget.kernel.fullCleanup();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('All data deleted.'),
          backgroundColor: ArcadeTheme.cardColor,
        ),
      );
      _loadData();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ArcadeTheme.backgroundColor,
      appBar: AppBar(
        title: Text(
          'STORAGE SETTINGS',
          style: ArcadeFonts.blackOpsOne(
            fontSize: 20,
            letterSpacing: 1.5,
            color: ArcadeTheme.primaryColor,
          ),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(color: ArcadeTheme.primaryColor))
            : SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildStatsSection(),
                    const SizedBox(height: 20),
                    _buildAutoCleanupSettings(),
                    const SizedBox(height: 20),
                    _buildCleanupActions(),
                    const SizedBox(height: 20),
                    _buildRoomsListSection(),
                    const SizedBox(height: 20),
                    _buildDangerZone(),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildRoomsListSection() {
    return ArcadeCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.grid_view_rounded, color: ArcadeTheme.primaryColor, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'SAVED ROOMS',
                  style: ArcadeFonts.plusJakartaSans(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.0,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_rooms.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  'No rooms currently stored in the database.',
                  style: TextStyle(color: Colors.white38, fontSize: 13, fontStyle: FontStyle.italic),
                ),
              ),
            )
          else
            Column(
              children: [
                for (int i = 0; i < _rooms.length; i++) ...[
                  _buildRoomRow(_rooms[i]),
                  if (i < _rooms.length - 1) const Divider(height: 20),
                ]
              ],
            ),
        ],
      ),
    );
  }

  String _getGameName(String gameId) {
    final games = widget.kernel.availableGames;
    for (final g in games) {
      if (g.id == gameId) return g.name;
    }
    if (gameId.isEmpty) return 'Unknown Game';
    return gameId[0].toUpperCase() + gameId.substring(1);
  }

  Widget _buildRoomRow(RoomStorageDetail room) {
    Color statusColor;
    String statusLabel;
    switch (room.status) {
      case RoomStatus.waiting:
        statusColor = Colors.blueAccent;
        statusLabel = 'WAITING';
        break;
      case RoomStatus.active:
        statusColor = ArcadeTheme.successColor;
        statusLabel = 'ACTIVE';
        break;
      case RoomStatus.finished:
        statusColor = Colors.grey;
        statusLabel = 'FINISHED';
        break;
      case RoomStatus.abandoned:
        statusColor = ArcadeTheme.errorColor;
        statusLabel = 'ABANDONED';
        break;
    }

    final gameName = _getGameName(room.gameId);
    final formattedTime = room.lastActiveAt != null
        ? 'Active: ${_formatDateTime(room.lastActiveAt!)}'
        : 'Created: ${_formatDateTime(room.createdAt)}';

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    room.code.toUpperCase(),
                    style: _firaCodeStyle.copyWith(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                      color: ArcadeTheme.primaryColor,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '($gameName)',
                      style: _plusJakartaSansStyle.copyWith(
                        color: ArcadeTheme.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  _buildBadge(statusLabel, statusColor),
                  const SizedBox(width: 6),
                  if (room.isActiveInMemory)
                    _buildBadge('ACTIVE', ArcadeTheme.successColor)
                  else
                    _buildBadge('SAVED', Colors.white30),
                  const SizedBox(width: 10),
                  const Icon(Icons.people_alt_rounded, size: 12, color: Colors.white38),
                  const SizedBox(width: 4),
                  Text(
                    '${room.playersCount} Players',
                    style: _plusJakartaSansStyle.copyWith(color: ArcadeTheme.textSecondary, fontSize: 11),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                formattedTime,
                style: _plusJakartaSansStyle.copyWith(color: ArcadeTheme.textSecondary, fontSize: 11),
              ),
            ],
          ),
        ),
        IconButton(
          icon: const Icon(Icons.delete_sweep_outlined, color: ArcadeTheme.errorColor, size: 22),
          onPressed: () => _confirmPurgeRoom(room),
          tooltip: 'Delete Room Data',
        ),
      ],
    );
  }

  Widget _buildBadge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        border: Border.all(color: color.withValues(alpha: 0.4), width: 1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: _plusJakartaSansStyle.copyWith(
          color: color,
          fontSize: 9,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.6,
        ),
      ),
    );
  }

  String _formatDateTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) {
      return 'just now';
    } else if (diff.inHours < 1) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inDays < 1) {
      return '${diff.inHours}h ago';
    } else {
      return '${dt.month}/${dt.day} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    }
  }

  Future<void> _confirmPurgeRoom(RoomStorageDetail room) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('DELETE ROOM DATA?'),
        content: Text(
          'Are you sure you want to delete Room ${room.code.toUpperCase()}?\n\n'
          'All saved data for this room will be deleted.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('CANCEL'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: ArcadeTheme.errorColor,
              foregroundColor: Colors.white,
            ),
            child: const Text('DELETE'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      setState(() {
        _isLoading = true;
      });
      await widget.kernel.deleteRoom(room.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Room ${room.code.toUpperCase()} data deleted.'),
          backgroundColor: ArcadeTheme.cardColor,
        ),
      );
      _loadData();
    }
  }

  Widget _buildStatsSection() {
    return ArcadeCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'STORAGE USED',
                style: ArcadeFonts.plusJakartaSans(fontWeight: FontWeight.bold, color: ArcadeTheme.textPrimary, fontSize: 13),
              ),
              Text(
                '${_stats['storageUsedMb']} MB',
                style: ArcadeFonts.firaCode(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: ArcadeTheme.primaryColor,
                ),
              ),
            ],
          ),
          const Divider(height: 24),
          _buildStatRow('Completed Games', _stats['completedGames']),
          _buildStatRow('Abandoned Rooms', _stats['abandonedRooms']),
          _buildStatRow('Saved Reconnect States', _stats['reconnectStates']),
          _buildStatRow('Event Logs', _stats['eventLogs']),
        ],
      ),
    );
  }

  Widget _buildStatRow(String label, int value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: ArcadeFonts.plusJakartaSans(color: ArcadeTheme.textSecondary, fontSize: 14)),
          Text(
            value.toString(),
            style: ArcadeFonts.firaCode(fontWeight: FontWeight.bold, fontSize: 14, color: ArcadeTheme.textPrimary),
          ),
        ],
      ),
    );
  }

  Widget _buildAutoCleanupSettings() {
    return ArcadeCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    const Icon(Icons.auto_delete_outlined, color: ArcadeTheme.primaryColor, size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'AUTO CLEANUP',
                        style: ArcadeFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.0,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
              Switch(
                value: _autoCleanup,
                activeThumbColor: ArcadeTheme.backgroundColor,
                activeTrackColor: ArcadeTheme.primaryColor,
                inactiveThumbColor: ArcadeTheme.textSecondary,
                inactiveTrackColor: Colors.white10,
                onChanged: (val) {
                  setState(() {
                    _autoCleanup = val;
                  });
                },
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_autoCleanup) ...[
            _buildDropdownRow(
              'Finished Games',
              'Delete finished games after:',
              _completedDays,
              {
                -1: 'Never',
                1: '24 Hours',
                3: '3 Days',
                7: '7 Days',
                30: '30 Days',
              },
              (val) => setState(() => _completedDays = val ?? 7),
            ),
            _buildDropdownRow(
              'Empty Rooms',
              'Delete empty rooms after:',
              _abandonedHours,
              {
                -1: 'Never',
                24: '24 Hours',
                72: '3 Days',
                168: '7 Days',
                720: '30 Days',
              },
              (val) => setState(() => _abandonedHours = val ?? 24),
            ),
            _buildDropdownRow(
              'Disconnected Players data',
              'Delete disconnected data after:',
              _reconnectHours,
              {
                -1: 'Never',
                24: '24 Hours',
                48: '48 Hours',
                168: '7 Days',
                720: '30 Days',
              },
              (val) => setState(() => _reconnectHours = val ?? 48),
            ),
          ],
          const SizedBox(height: 20),
          ArcadeButton.primary(
            label: 'SAVE SETTINGS',
            onPressed: _saveSettings,
            isFullWidth: true,
          ),
        ],
      ),
    );
  }

  Widget _buildDropdownRow(
    String title,
    String subtitle,
    int currentValue,
    Map<int, String> options,
    void Function(int?) onChanged,
  ) {
    if (!options.containsKey(currentValue)) {
      currentValue = options.keys.first;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: ArcadeFonts.plusJakartaSans(fontWeight: FontWeight.bold, fontSize: 14, color: ArcadeTheme.textPrimary),
          ),
          Text(
            subtitle,
            style: ArcadeFonts.plusJakartaSans(color: ArcadeTheme.textSecondary, fontSize: 11),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white10),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<int>(
                value: currentValue,
                isExpanded: true,
                dropdownColor: ArcadeTheme.surfaceColor,
                icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.white70),
                style: ArcadeFonts.plusJakartaSans(color: ArcadeTheme.textPrimary, fontSize: 14),
                onChanged: onChanged,
                items: options.entries
                    .map((e) => DropdownMenuItem<int>(
                          value: e.key,
                          child: Text(e.value),
                        ))
                     .toList(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCleanupActions() {
    return ArcadeCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.cleaning_services_outlined, color: ArcadeTheme.primaryColor, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'DELETE DATA MANUALLY',
                  style: ArcadeFonts.plusJakartaSans(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.0,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildActionRow(
            'Delete Finished Games',
            'Deletes finished matches. Preserves statistics, profiles, and achievements.',
            () => _triggerCleanup(widget.kernel.clearCompletedGames, 'This removes finished matches history.'),
          ),
          _buildActionRow(
            'Delete Empty Rooms',
            'Deletes rooms where all players disconnected without finishing.',
            () => _triggerCleanup(widget.kernel.clearAbandonedRooms, 'This removes abandoned matches history.'),
          ),
          _buildActionRow(
            'Delete Disconnected Players data',
            'Deletes room recovery data for matches not active.',
            () => _triggerCleanup(widget.kernel.clearExpiredReconnectStates, 'Players will not be able to reconnect to these old matches.'),
          ),
          _buildActionRow(
            'Delete Event Logs',
            'Purges all gameplay action event logs across rooms.',
            () => _triggerCleanup(widget.kernel.clearEventLogs, 'This will remove event logs and replay action lists.'),
          ),
        ],
      ),
    );
  }

  Widget _buildActionRow(String title, String description, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: ArcadeFonts.plusJakartaSans(fontWeight: FontWeight.bold, fontSize: 14, color: ArcadeTheme.textPrimary),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: ArcadeFonts.plusJakartaSans(color: ArcadeTheme.textSecondary, fontSize: 11),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          ArcadeButton.secondary(
            label: 'CLEAR',
            onPressed: onTap,
          ),
        ],
      ),
    );
  }

  Widget _buildDangerZone() {
    return ArcadeCard(
      border: Border.all(color: ArcadeTheme.errorColor, width: 1.2),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.report_gmailerrorred_rounded, color: ArcadeTheme.errorColor, size: 20),
              const SizedBox(width: 12),
              Text(
                'DELETE EVERYTHING',
                style: ArcadeFonts.plusJakartaSans(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.0,
                  color: ArcadeTheme.errorColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Full cleanup will permanently delete all room data, reconnect states, and gameplay log tables.\n'
            'Statistics, achievements, and player profiles are fully preserved.',
            style: ArcadeFonts.plusJakartaSans(color: ArcadeTheme.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 16),
          ArcadeButton.danger(
            label: 'DELETE EVERYTHING',
            onPressed: _triggerFullCleanup,
            isFullWidth: true,
          ),
        ],
      ),
    );
  }
}
