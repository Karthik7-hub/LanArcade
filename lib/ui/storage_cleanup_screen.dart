import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../kernel/kernel_manager.dart';
import '../kernel/cleanup_settings.dart';
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

    setState(() {
      _stats = stats;
      _autoCleanup = settings.autoCleanup;
      _completedDays = settings.completedMatchesDays;
      _abandonedHours = settings.abandonedRoomsHours;
      _reconnectHours = settings.reconnectStatesHours;
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
        backgroundColor: ArcadeTheme.surfaceColor,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: Colors.white10),
        ),
        title: Text(
          'CONFIRM CLEANUP',
          style: GoogleFonts.blackOpsOne(
            color: ArcadeTheme.secondaryColor,
            fontSize: 20,
            letterSpacing: 1,
          ),
        ),
        content: Text(
          'Are you sure you want to perform this cleanup action? $message',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('CANCEL', style: TextStyle(color: Colors.white30, fontWeight: FontWeight.bold)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: ArcadeTheme.primaryColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text('PROCEED', style: TextStyle(fontWeight: FontWeight.bold)),
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
            backgroundColor: ArcadeTheme.surfaceColor,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(24),
              side: const BorderSide(color: Colors.redAccent, width: 1.5),
            ),
            title: Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 28),
                const SizedBox(width: 8),
                Text(
                  'DANGER ZONE',
                  style: GoogleFonts.blackOpsOne(
                    color: Colors.redAccent,
                    fontSize: 20,
                    letterSpacing: 1,
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
                  style: TextStyle(color: Colors.white70, fontSize: 13),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: textController,
                  autofocus: true,
                  style: GoogleFonts.firaCode(color: Colors.white),
                  decoration: const InputDecoration(
                    fillColor: Colors.black26,
                    filled: true,
                    border: OutlineInputBorder(),
                    hintText: 'DELETE',
                    hintStyle: TextStyle(color: Colors.white24),
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
                child: const Text('CANCEL', style: TextStyle(color: Colors.white30, fontWeight: FontWeight.bold)),
              ),
              ElevatedButton(
                onPressed: canDelete ? () => Navigator.of(context).pop(true) : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.redAccent,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: Colors.redAccent.withValues(alpha: 0.3),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('DELETE ALL', style: TextStyle(fontWeight: FontWeight.bold)),
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
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: ArcadeTheme.primaryColor))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildStatsSection(),
                  const SizedBox(height: 24),
                  _buildAutoCleanupSettings(),
                  const SizedBox(height: 24),
                  _buildCleanupActions(),
                  const SizedBox(height: 24),
                  _buildDangerZone(),
                  const SizedBox(height: 40),
                ],
              ),
            ),
    );
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
                const Text('DATABASE STORAGE USED', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white70)),
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
            const Divider(height: 24, color: Colors.white10),
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
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 14)),
          Text(
            value.toString(),
            style: GoogleFonts.firaCode(fontWeight: FontWeight.bold, fontSize: 14),
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
                Row(
                  children: [
                    const Icon(Icons.auto_delete_outlined, color: ArcadeTheme.accentColor),
                    const SizedBox(width: 12),
                    Text(
                      'AUTOMATIC CLEANUP',
                      style: GoogleFonts.blackOpsOne(fontSize: 16, letterSpacing: 1),
                    ),
                  ],
                ),
                Switch(
                  value: _autoCleanup,
                  activeThumbColor: ArcadeTheme.accentColor,
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
                backgroundColor: ArcadeTheme.primaryColor,
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(50),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('SAVE POLICIES', style: TextStyle(fontWeight: FontWeight.bold)),
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
    // Gracefully fallback to closest option if value is not exact
    if (!options.containsKey(currentValue)) {
      currentValue = options.keys.first;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          Text(subtitle, style: const TextStyle(color: Colors.white30, fontSize: 11)),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.black12,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.white10),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<int>(
                value: currentValue,
                isExpanded: true,
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
                const Icon(Icons.cleaning_services_outlined, color: ArcadeTheme.primaryColor),
                const SizedBox(width: 12),
                Text(
                  'MANUAL CLEANUP OPTIONS',
                  style: GoogleFonts.blackOpsOne(fontSize: 16, letterSpacing: 1),
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
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(height: 2),
                Text(description, style: const TextStyle(color: Colors.white38, fontSize: 11)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          ElevatedButton(
            onPressed: onTap,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white10,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
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
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: Colors.redAccent, width: 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.report_gmailerrorred_rounded, color: Colors.redAccent),
                const SizedBox(width: 12),
                Text(
                  'DANGER ZONE',
                  style: GoogleFonts.blackOpsOne(fontSize: 16, letterSpacing: 1, color: Colors.redAccent),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Text(
              'Full cleanup will permanently delete all room data, reconnect states, and gameplay log tables.\n'
              'Statistics, achievements, and player profiles are fully preserved.',
              style: TextStyle(color: Colors.white54, fontSize: 12),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _triggerFullCleanup,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.redAccent,
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(50),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('FULL PLATFORM CLEANUP', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}
