import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../database/database.dart';
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

  void _copyToClipboard(BuildContext context, String text, String message) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.greenAccent, size: 18),
            const SizedBox(width: 8),
            Text(message),
          ],
        ),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
        backgroundColor: ArcadeTheme.surfaceColor,
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
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [ArcadeTheme.backgroundColor, Color(0xFF020617)],
          ),
        ),
        child: SafeArea(
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
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'PLAYERS DIRECTORY',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: 1.0,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'Scan QR codes to easily log in on phone browsers',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  color: Colors.white38,
                ),
              ),
            ],
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
            'No registered players found',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.white38,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'New players will register upon joining from their browser.',
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
        final loginUrl = 'http://${widget.ipAddress}:8080/?login_id=${player.id}';

        return AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeInOut,
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: ArcadeTheme.surfaceColor,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isExpanded ? avatarColor.withValues(alpha: 0.5) : Colors.white.withValues(alpha: 0.05),
              width: 1,
            ),
            boxShadow: isExpanded
                ? [
                    BoxShadow(
                      color: avatarColor.withValues(alpha: 0.15),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    )
                  ]
                : [],
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
                borderRadius: BorderRadius.circular(16),
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
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'ID: ${player.id.substring(0, 8)}...',
                              style: GoogleFonts.firaCode(
                                fontSize: 11,
                                color: Colors.white30,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Wins Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.amber.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.amber.withValues(alpha: 0.2), width: 1),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.emoji_events_rounded, color: Colors.amber, size: 14),
                            const SizedBox(width: 4),
                            Text(
                              '$totalWins Wins',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Colors.amber,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Icon(
                        isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                        color: Colors.white30,
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
                                  label: 'FULL PLAYER ID',
                                  value: player.id,
                                  onCopy: () => _copyToClipboard(
                                    context,
                                    player.id,
                                    'Player ID copied to clipboard!',
                                  ),
                                ),
                                const SizedBox(height: 16),
                                _buildDetailField(
                                  label: 'QUICK LOGIN URL',
                                  value: loginUrl,
                                  onCopy: () => _copyToClipboard(
                                    context,
                                    loginUrl,
                                    'Quick Login URL copied to clipboard!',
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
                                  boxShadow: const [
                                    BoxShadow(
                                      color: Colors.black26,
                                      blurRadius: 8,
                                      offset: Offset(0, 4),
                                    )
                                  ],
                                ),
                                child: QrImageView(
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
                              const SizedBox(height: 6),
                              Text(
                                'SCAN TO LOGIN',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white54,
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      // Stats breakdown
                      Text(
                        'WINS BY GAME',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: Colors.white30,
                          letterSpacing: 0.8,
                        ),
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
            color: Colors.white30,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.25),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  value,
                  style: GoogleFonts.firaCode(
                    fontSize: 12,
                    color: Colors.white70,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.copy_rounded, size: 16, color: Colors.white54),
                onPressed: onCopy,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                splashRadius: 18,
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
          'No individual game wins recorded yet.',
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
        final isUno = gameId.toLowerCase() == 'uno';
        final gameColor = isUno ? ArcadeTheme.secondaryColor : ArcadeTheme.primaryColor;

        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: gameColor.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: gameColor.withValues(alpha: 0.15)),
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
                  color: gameColor.withValues(alpha: 0.7),
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '$wins Wins',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}
