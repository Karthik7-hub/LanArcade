import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../database/database.dart';
import '../kernel/kernel_manager.dart';
import '../shared/haptic_manager.dart';
import 'theme.dart';

class PlayersListScreen extends StatefulWidget {
  final AppDatabase database;
  final String ipAddress;

  const PlayersListScreen({
    super.key,
    required this.database,
    required this.ipAddress,
  });

  @override
  State<PlayersListScreen> createState() => _PlayersListScreenState();
}

class _PlayersListScreenState extends State<PlayersListScreen> {
  List<DbPlayer> _players = [];
  Map<String, int> _playerTotalWins = {};
  Map<String, Map<String, int>> _playerGameWins = {};
  bool _isLoading = true;
  String? _expandedPlayerId;
  final Map<String, Widget> _cachedQrWidgets = {};

  @override
  void initState() {
    super.initState();
    _loadPlayersData();
  }

  Future<void> _loadPlayersData() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final players = await widget.database.select(widget.database.players).get();
      final stats = await widget.database.select(widget.database.gameStats).get();

      final Map<String, int> playerTotalWins = {};
      final Map<String, Map<String, int>> playerGameWins = {};

      for (final s in stats) {
        playerTotalWins[s.playerId] = (playerTotalWins[s.playerId] ?? 0) + s.wins;
        
        if (!playerGameWins.containsKey(s.playerId)) {
          playerGameWins[s.playerId] = {};
        }
        playerGameWins[s.playerId]![s.gameId] = s.wins;
      }

      if (mounted) {
        setState(() {
          _players = players;
          _playerTotalWins = playerTotalWins;
          _playerGameWins = playerGameWins;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load players: $e')),
        );
      }
    }
  }

  Future<void> _deletePlayer(String playerId) async {
    await widget.database.transaction(() async {
      // 1. Delete Achievements
      await (widget.database.delete(widget.database.achievements)
            ..where((t) => t.playerId.equals(playerId)))
          .go();
      
      // 2. Delete GameStats
      await (widget.database.delete(widget.database.gameStats)
            ..where((t) => t.playerId.equals(playerId)))
          .go();
      
      // 3. Delete Player
      await (widget.database.delete(widget.database.players)
            ..where((t) => t.id.equals(playerId)))
          .go();
    });
  }

  Future<void> _confirmDeletePlayer(DbPlayer player) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          'DELETE PLAYER?',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold),
        ),
        content: Text(
          'Are you sure you want to delete ${player.name}? All stats, wins, and achievements will be permanently deleted.',
          style: GoogleFonts.plusJakartaSans(),
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
      HapticManager.trigger('error');
      setState(() {
        _isLoading = true;
      });
      try {
        await _deletePlayer(player.id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.delete_rounded, color: ArcadeTheme.errorColor, size: 18),
                  const SizedBox(width: 8),
                  Text('Player ${player.name} deleted successfully.'),
                ],
              ),
              behavior: SnackBarBehavior.floating,
              backgroundColor: ArcadeTheme.cardColor,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          );
          _expandedPlayerId = null;
          await _loadPlayersData();
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to delete player: $e')),
          );
        }
      }
    }
  }

  void _copyToClipboard(BuildContext context, String text, String message) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: ArcadeTheme.successColor, size: 18),
            const SizedBox(width: 8),
            Text(message),
          ],
        ),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
        backgroundColor: ArcadeTheme.cardColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
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
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _players.isEmpty
                      ? _buildEmptyState()
                      : _buildPlayersList(),
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
                  'PLAYERS',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: ArcadeTheme.textPrimary,
                    letterSpacing: 1.0,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Scan QR code to log in on your phone',
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
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.people_outline_rounded, size: 64, color: Colors.white24),
          const SizedBox(height: 16),
          Text(
            'No players registered',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: ArcadeTheme.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Players will appear here after they join.',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              color: Colors.white24,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildPlayersList() {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      itemCount: _players.length,
      itemBuilder: (context, index) {
        final player = _players[index];
        final totalWins = _playerTotalWins[player.id] ?? 0;
        final isExpanded = _expandedPlayerId == player.id;
        final avatarColor = _resolveAvatarColor(player.avatar);
        final loginUrl = 'http://${widget.ipAddress}:${KernelManager.serverPort}/?login_id=${player.id}';

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: ArcadeTheme.cardColor,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isExpanded ? ArcadeTheme.primaryColor : Colors.white.withValues(alpha: 0.05),
              width: 1,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header/Row item tap
              InkWell(
                onTap: () {
                  setState(() {
                    _expandedPlayerId = isExpanded ? null : player.id;
                  });
                },
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: avatarColor.withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                          border: Border.all(color: avatarColor, width: 2),
                        ),
                        child: Center(
                          child: Text(
                            player.name.isNotEmpty ? player.name[0].toUpperCase() : '?',
                            style: GoogleFonts.plusJakartaSans(
                              color: avatarColor,
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              player.name,
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                                color: ArcadeTheme.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'ID: ${player.id.substring(0, 8)}...',
                              style: GoogleFonts.firaCode(
                                fontSize: 11,
                                color: ArcadeTheme.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Wins Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: ArcadeTheme.primaryColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: ArcadeTheme.primaryColor.withValues(alpha: 0.2), width: 1),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.emoji_events_rounded, color: ArcadeTheme.primaryColor, size: 14),
                            const SizedBox(width: 4),
                            Text(
                              '$totalWins Wins',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: ArcadeTheme.primaryColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Icon(
                        isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                        color: ArcadeTheme.textSecondary,
                      ),
                    ],
                  ),
                ),
              ),
              
              // Expanded details with QR
              if (isExpanded) ...[
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Left side: Credentials
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildDetailField(
                                  label: 'PLAYER ID',
                                  value: player.id,
                                  onCopy: () => _copyToClipboard(
                                    context,
                                    player.id,
                                    'ID copied!',
                                  ),
                                ),
                                const SizedBox(height: 16),
                                _buildDetailField(
                                  label: 'LOGIN LINK',
                                  value: loginUrl,
                                  onCopy: () => _copyToClipboard(
                                    context,
                                    loginUrl,
                                    'Login link copied!',
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 20),
                          // Right side: QR Code
                          Column(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: _cachedQrWidgets.putIfAbsent(
                                  player.id,
                                  () => QrImageView(
                                    data: loginUrl,
                                    version: QrVersions.auto,
                                    size: 110,
                                    eyeStyle: const QrEyeStyle(
                                      eyeShape: QrEyeShape.square,
                                      color: Color(0xFF0F172A),
                                    ),
                                    dataModuleStyle: const QrDataModuleStyle(
                                      dataModuleShape: QrDataModuleShape.square,
                                      color: Color(0xFF0F172A),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'SCAN TO LOGIN',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                  color: ArcadeTheme.textSecondary,
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'WINS BY GAME',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: ArcadeTheme.textSecondary,
                              letterSpacing: 0.8,
                            ),
                          ),
                          TextButton.icon(
                            onPressed: () => _confirmDeletePlayer(player),
                            icon: const Icon(Icons.delete_outline_rounded, color: ArcadeTheme.errorColor, size: 16),
                            label: Text(
                              'DELETE PLAYER',
                              style: GoogleFonts.plusJakartaSans(
                                color: ArcadeTheme.errorColor,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.5,
                              ),
                            ),
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              backgroundColor: ArcadeTheme.errorColor.withValues(alpha: 0.08),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      _buildGameWinsBreakdown(player.id),
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildDetailField({
    required String label,
    required String value,
    required VoidCallback onCopy,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w900,
            color: ArcadeTheme.textSecondary,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.25),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.white10),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  value,
                  style: GoogleFonts.firaCode(
                    fontSize: 12,
                    color: ArcadeTheme.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.copy_rounded, size: 18, color: Colors.white54),
                onPressed: onCopy,
                padding: const EdgeInsets.all(12),
                constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
                splashRadius: 22,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildGameWinsBreakdown(String playerId) {
    final gameWins = _playerGameWins[playerId] ?? {};
    if (gameWins.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Text(
          'No game wins recorded yet.',
          style: GoogleFonts.plusJakartaSans(color: Colors.white24, fontSize: 12),
        ),
      );
    }

    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: gameWins.entries.map((entry) {
        final gameId = entry.key;
        final wins = entry.value;

        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.03),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                gameId.toUpperCase(),
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  color: ArcadeTheme.textSecondary,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '$wins Wins',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: ArcadeTheme.textPrimary,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}
