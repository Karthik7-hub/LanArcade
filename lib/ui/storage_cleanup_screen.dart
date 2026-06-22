import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
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
        content: Text('Auto-cleanup policies saved!'),
        backgroundColor: ArcadeTheme.accentColor,
      ),
    );
    _loadData();
  }

  Future<void> _triggerCleanup(Future<void> Function() cleanupFn, String message) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          'CONFIRM CLEANUP',
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.bold,
            color: ArcadeTheme.secondaryColor,
          ),
        ),
        content: Text(
          'Are you sure you want to perform this cleanup action? $message',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('CANCEL'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: ArcadeTheme.primaryColor,
              foregroundColor: Colors.white,
            ),
            child: const Text('PROCEED'),
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
          content: Text('Cleanup complete!'),
          backgroundColor: ArcadeTheme.accentColor,
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
                const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 28),
                const SizedBox(width: 8),
                Text(
                  'DANGER ZONE',
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.bold,
                    color: Colors.redAccent,
                  ),
                ),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'This will permanently remove all saved matches, reconnect states, room history, and event logs.\n\n'
                  'Player profiles, achievements, and statistics will NOT be deleted.\n\n'
                  'This action cannot be undone. To confirm, type "DELETE" below:',
                  style: TextStyle(fontSize: 13),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: textController,
                  autofocus: true,
                  style: GoogleFonts.firaCode(color: Colors.white),
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
                  backgroundColor: const Color(0xFFEF4444),
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: const Color(0xFFEF4444).withValues(alpha: 0.3),
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
          content: Text('Full platform purge completed!'),
          backgroundColor: ArcadeTheme.accentColor,
        ),
      );
      _loadData();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'STORAGE & CLEANUP',
          style: GoogleFonts.blackOpsOne(
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
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [ArcadeTheme.backgroundColor, Color(0xFF020617)],
          ),
        ),
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.grid_view_rounded, color: ArcadeTheme.secondaryColor, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'ROOM STORAGE MANAGEMENT',
                    style: GoogleFonts.plusJakartaSans(
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
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _rooms.length,
                separatorBuilder: (context, index) => const Divider(height: 20),
                itemBuilder: (context, index) {
                  final room = _rooms[index];
                  return _buildRoomRow(room);
                },
              ),
          ],
        ),
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
        statusColor = Colors.greenAccent;
        statusLabel = 'ACTIVE';
        break;
      case RoomStatus.finished:
        statusColor = Colors.grey;
        statusLabel = 'FINISHED';
        break;
      case RoomStatus.abandoned:
        statusColor = Colors.redAccent;
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
                    style: GoogleFonts.firaCode(
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
                      style: GoogleFonts.plusJakartaSans(
                        color: Colors.white70,
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
                    _buildBadge('IN-MEMORY', ArcadeTheme.accentColor)
                  else
                    _buildBadge('DB ONLY', Colors.white30),
                  const SizedBox(width: 10),
                  Icon(Icons.people_alt_rounded, size: 12, color: Colors.white38),
                  const SizedBox(width: 4),
                  Text(
                    '${room.playersCount} Players',
                    style: GoogleFonts.plusJakartaSans(color: Colors.white38, fontSize: 11),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                formattedTime,
                style: GoogleFonts.plusJakartaSans(color: Colors.white30, fontSize: 11),
              ),
            ],
          ),
        ),
        IconButton(
          icon: const Icon(Icons.delete_sweep_outlined, color: Colors.redAccent, size: 22),
          onPressed: () => _confirmPurgeRoom(room),
          tooltip: 'Purge Room Storage',
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
        style: GoogleFonts.plusJakartaSans(
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
        title: Text(
          'PURGE ROOM STORAGE',
          style: GoogleFonts.plusJakartaSans(
            color: Colors.redAccent,
            fontWeight: FontWeight.bold,
          ),
        ),
        content: Text(
          'Are you sure you want to permanently delete Room ${room.code.toUpperCase()}?\n\n'
          'All database logs and in-memory game state will be destroyed immediately. Any active players will be returned to the lobby.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('CANCEL'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
            ),
            child: const Text('PURGE'),
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
          content: Text('Room ${room.code.toUpperCase()} purged successfully.'),
          backgroundColor: ArcadeTheme.accentColor,
        ),
      );
      _loadData();
    }
  }

  Widget _buildStatsSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'DATABASE STORAGE USED',
                  style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold, color: Colors.white70, fontSize: 13),
                ),
                Text(
                  '${_stats['storageUsedMb']} MB',
                  style: GoogleFonts.firaCode(
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
      ),
    );
  }

  Widget _buildStatRow(String label, int value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.plusJakartaSans(color: Colors.white60, fontSize: 14)),
          Text(
            value.toString(),
            style: GoogleFonts.firaCode(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
          ),
        ],
      ),
    );
  }

  Widget _buildAutoCleanupSettings() {
    return Card(
      child: Padding(
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
                      const Icon(Icons.auto_delete_outlined, color: ArcadeTheme.accentColor, size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'AUTOMATIC CLEANUP',
                          style: GoogleFonts.plusJakartaSans(
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
                  activeThumbColor: ArcadeTheme.accentColor,
                  activeTrackColor: ArcadeTheme.accentColor.withValues(alpha: 0.25),
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
                'Completed Games',
                'Delete finished matches after:',
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
                'Abandoned Rooms',
                'Delete empty, inactive rooms after:',
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
                'Reconnect States',
                'Delete disconnected recovery states after:',
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
            ElevatedButton(
              onPressed: _saveSettings,
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
              ),
              child: const Text('SAVE POLICIES'),
            ),
          ],
        ),
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
            style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
          ),
          Text(
            subtitle,
            style: GoogleFonts.plusJakartaSans(color: Colors.white30, fontSize: 11),
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
                style: GoogleFonts.plusJakartaSans(color: Colors.white, fontSize: 14),
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
    return Card(
      child: Padding(
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
                    'MANUAL CLEANUP OPTIONS',
                    style: GoogleFonts.plusJakartaSans(
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
              'Clear Completed Games',
              'Deletes finished matches. Preserves statistics, profiles, and achievements.',
              () => _triggerCleanup(widget.kernel.clearCompletedGames, 'This removes finished matches history and replay data.'),
            ),
            _buildActionRow(
              'Clear Abandoned Rooms',
              'Deletes rooms where all players disconnected without finishing.',
              () => _triggerCleanup(widget.kernel.clearAbandonedRooms, 'This removes abandoned matches history.'),
            ),
            _buildActionRow(
              'Clear Expired Reconnect States',
              'Deletes room recovery data for matches not active in-memory.',
              () => _triggerCleanup(widget.kernel.clearExpiredReconnectStates, 'Players will not be able to reconnect to these old matches.'),
            ),
            _buildActionRow(
              'Clear Event Logs',
              'Purges all gameplay action event logs across rooms.',
              () => _triggerCleanup(widget.kernel.clearEventLogs, 'This will remove event logs and replay action lists.'),
            ),
          ],
        ),
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
                  style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: GoogleFonts.plusJakartaSans(color: Colors.white38, fontSize: 11),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          OutlinedButton(
            onPressed: onTap,
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: const BorderSide(color: Colors.white10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              textStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold, fontSize: 12),
            ),
            child: const Text('CLEAR'),
          ),
        ],
      ),
    );
  }

  Widget _buildDangerZone() {
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Colors.redAccent, width: 1.2),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.report_gmailerrorred_rounded, color: Colors.redAccent, size: 20),
                const SizedBox(width: 12),
                Text(
                  'DANGER ZONE',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.0,
                    color: Colors.redAccent,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Full cleanup will permanently delete all room data, reconnect states, and gameplay log tables.\n'
              'Statistics, achievements, and player profiles are fully preserved.',
              style: GoogleFonts.plusJakartaSans(color: Colors.white54, fontSize: 12),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _triggerFullCleanup,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF4444),
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(50),
              ),
              child: const Text('FULL PLATFORM CLEANUP'),
            ),
          ],
        ),
      ),
    );
  }
}
