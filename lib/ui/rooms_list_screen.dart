import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../kernel/kernel_manager.dart';
import '../shared/models.dart';
import 'theme.dart';

class RoomsListScreen extends StatefulWidget {
  final KernelManager kernel;
  final String ipAddress;

  const RoomsListScreen({
    super.key,
    required this.kernel,
    required this.ipAddress,
  });

  @override
  State<RoomsListScreen> createState() => _RoomsListScreenState();
}

class _RoomsListScreenState extends State<RoomsListScreen> {
  List<Room> _rooms = [];
  bool _isLoading = true;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _loadRooms();
    // Auto-refresh active rooms every 3 seconds to keep UI responsive
    _refreshTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      _loadRooms(silent: true);
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  void _loadRooms({bool silent = false}) {
    if (!silent) {
      setState(() {
        _isLoading = true;
      });
    }

    final activeRoomsMap = widget.kernel.activeRooms;
    final List<Room> rooms = activeRoomsMap.values.toList();

    // Sort by status and code
    rooms.sort((a, b) => a.status.name.compareTo(b.status.name));

    if (mounted) {
      setState(() {
        _rooms = rooms;
        _isLoading = false;
      });
    }
  }

  Future<void> _terminateRoom(BuildContext context, Room room) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('CLOSE ROOM ${room.code}?'),
        content: const Text(
          'Are you sure you want to close this room? Players will be disconnected.',
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
            child: const Text('CLOSE ROOM'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await widget.kernel.deleteRoom(room.id);
      _loadRooms();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Room ${room.code} closed.'),
            backgroundColor: ArcadeTheme.cardColor,
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to close room: $e')),
        );
      }
    }
  }

  Color _resolveAvatarColor(String avatar) {
    switch (avatar) {
      case 'indigo': return const Color(0xFF6366F1);
      case 'pink': return const Color(0xFFEC4899);
      case 'emerald': return const Color(0xFF10B981);
      case 'amber': return const Color(0xFFF59E0B);
      case 'cyan': return const Color(0xFF06B6D4);
      case 'rose': return const Color(0xFFF43F5E);
      case 'violet': return const Color(0xFF8B5CF6);
      default:
        if (avatar.startsWith('#')) {
          try {
            final hex = avatar.replaceAll('#', '');
            return Color(int.parse('FF$hex', radix: 16));
          } catch (_) {}
        }
        return ArcadeTheme.primaryColor;
    }
  }

  Color _getStatusColor(RoomStatus status) {
    switch (status) {
      case RoomStatus.waiting:
        return ArcadeTheme.primaryColor; // Muted Gold
      case RoomStatus.active:
        return ArcadeTheme.successColor; // Green (Active/Connected)
      case RoomStatus.finished:
        return Colors.white30; // Muted Gray
      case RoomStatus.abandoned:
        return ArcadeTheme.errorColor; // Red (Error)
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ArcadeTheme.backgroundColor,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async {
                  _loadRooms();
                },
                backgroundColor: ArcadeTheme.surfaceColor,
                color: ArcadeTheme.primaryColor,
                child: _isLoading
                    ? const Center(child: CircularProgressIndicator())
                    : _rooms.isEmpty
                        ? _buildEmptyState()
                        : _buildRoomsList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white70),
            onPressed: () => Navigator.pop(context),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ACTIVE GAMES',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: ArcadeTheme.textPrimary,
                    letterSpacing: 1.0,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'View and manage active game rooms',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: ArcadeTheme.textSecondary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.25),
        Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.grid_view_rounded, size: 64, color: Colors.white24),
            const SizedBox(height: 16),
            Text(
              'No active rooms found',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: ArcadeTheme.textSecondary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Rooms will appear here when players start a game.',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                color: Colors.white24,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildRoomsList() {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      physics: const AlwaysScrollableScrollPhysics(),
      itemCount: _rooms.length,
      itemBuilder: (context, index) {
        final room = _rooms[index];
        final statusColor = _getStatusColor(room.status);

        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: ArcadeCard(
            padding: EdgeInsets.zero,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top strip: Game name, Code, Status badge, Evict button
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.sports_esports_rounded, color: ArcadeTheme.textPrimary),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    room.game.name.toUpperCase(),
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w900,
                                      color: ArcadeTheme.textPrimary,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: statusColor.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: statusColor.withValues(alpha: 0.3), width: 1),
                                  ),
                                  child: Text(
                                    room.status.name.toUpperCase(),
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 8,
                                      fontWeight: FontWeight.w900,
                                      color: statusColor,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Text(
                                  'ROOM CODE: ',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: ArcadeTheme.textSecondary,
                                  ),
                                ),
                                Text(
                                  room.code,
                                  style: GoogleFonts.firaCode(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w900,
                                    color: ArcadeTheme.primaryColor,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                InkWell(
                                  onTap: () {
                                    final joinUrl = 'http://${widget.ipAddress}:8080/?room=${room.code}';
                                    Clipboard.setData(ClipboardData(text: joinUrl));
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Row(
                                          children: [
                                            const Icon(Icons.check_circle_rounded, color: ArcadeTheme.successColor, size: 18),
                                            const SizedBox(width: 8),
                                            const Text('Link copied!'),
                                          ],
                                        ),
                                        behavior: SnackBarBehavior.floating,
                                        backgroundColor: ArcadeTheme.cardColor,
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                      ),
                                    );
                                  },
                                  borderRadius: BorderRadius.circular(4),
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Icon(Icons.copy_rounded, size: 11, color: Colors.white54),
                                        const SizedBox(width: 4),
                                        Text(
                                          'COPY LINK',
                                          style: GoogleFonts.plusJakartaSans(
                                            fontSize: 9,
                                            fontWeight: FontWeight.bold,
                                            color: ArcadeTheme.textSecondary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_forever_rounded, color: ArcadeTheme.errorColor),
                        onPressed: () => _terminateRoom(context, room),
                        tooltip: 'Close Room',
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                // Bottom strip: Players detail list
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'PLAYERS (${room.players.length}/${room.game.maxPlayers})',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: ArcadeTheme.textSecondary,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (room.players.isEmpty)
                        Text(
                          'No players connected.',
                          style: GoogleFonts.plusJakartaSans(color: Colors.white24, fontSize: 12),
                        )
                      else
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: room.players.map((p) {
                            final avatarColor = _resolveAvatarColor(p.avatar);
                            final isHost = p.id == room.hostId;

                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isHost ? ArcadeTheme.primaryColor.withValues(alpha: 0.3) : Colors.white.withValues(alpha: 0.05),
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 18,
                                    height: 18,
                                    decoration: BoxDecoration(
                                      color: avatarColor,
                                      shape: BoxShape.circle,
                                    ),
                                    child: Center(
                                      child: Text(
                                        p.name.isNotEmpty ? p.name[0].toUpperCase() : '?',
                                        style: GoogleFonts.plusJakartaSans(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 9,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    p.name,
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: ArcadeTheme.textPrimary,
                                    ),
                                  ),
                                  if (isHost) ...[
                                    const SizedBox(width: 4),
                                    const Icon(Icons.star_rounded, color: ArcadeTheme.primaryColor, size: 12),
                                  ],
                                ],
                              ),
                            );
                          }).toList(),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
