import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'arcade_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:fl_chart/fl_chart.dart';
import '../kernel/kernel_manager.dart';
import '../shared/haptic_manager.dart';
import 'diagnostics_screen.dart';
import 'storage_cleanup_screen.dart';
import 'theme.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter/services.dart';
import 'players_list_screen.dart';
import 'rooms_list_screen.dart';

class AdminDashboard extends StatefulWidget {
  const AdminDashboard({super.key});

  @override
  State<AdminDashboard> createState() => _AdminDashboardState();
}

class _AdminDashboardState extends State<AdminDashboard> {
  final KernelManager _kernel = KernelManager();
  StreamSubscription? _subscription;
  
  bool _isRunning = false;
  String? _ipAddress;
  int _activePlayersCount = 0;
  int _activeRoomsCount = 0;
  final List<FlSpot> _trafficSpots = [const FlSpot(0, 0)];
  double _timer = 0;

  // Cache QR image to avoid expensive rebuilds
  Widget? _cachedQrWidget;
  String? _cachedQrUrl;

  Future<String> _getIpAddress() async {
    try {
      final interfaces = await NetworkInterface.list();
      
      // Heuristic 1: Filter out interfaces that are clearly cellular
      final localInterfaces = interfaces.where((inter) {
        final name = inter.name.toLowerCase();
        return !name.startsWith('rmnet') &&
               !name.startsWith('ccmni') &&
               !name.startsWith('pdp') &&
               !name.startsWith('ppp') &&
               !name.startsWith('lte') &&
               !name.startsWith('rmnet_data');
      }).toList();

      // Heuristic 2: Extract IPv4 addresses
      final candidates = <Map<String, dynamic>>[];
      for (var inter in localInterfaces) {
        for (var addr in inter.addresses) {
          if (addr.type == InternetAddressType.IPv4 && !addr.isLoopback) {
            candidates.add({
              'name': inter.name.toLowerCase(),
              'address': addr.address,
            });
          }
        }
      }

      if (candidates.isNotEmpty) {
        // Heuristic 3: Score matching interfaces and private subnets
        int getScore(String name, String address) {
          int score = 0;
          if (name.startsWith('wlan') || name.startsWith('ap') || name.startsWith('softap') || name.startsWith('eth')) {
            score += 100;
          }
          if (address.startsWith('192.168.')) {
            score += 50;
          } else if (address.startsWith('172.16.') || address.startsWith('172.17.') || address.startsWith('172.18.') || address.startsWith('172.19.') || address.startsWith('172.20.') || address.startsWith('172.21.') || address.startsWith('172.22.') || address.startsWith('172.23.') || address.startsWith('172.24.') || address.startsWith('172.25.') || address.startsWith('172.26.') || address.startsWith('172.27.') || address.startsWith('172.28.') || address.startsWith('172.29.') || address.startsWith('172.30.') || address.startsWith('172.31.')) {
            score += 30;
          } else if (address.startsWith('10.')) {
            score += 10;
          }
          return score;
        }

        candidates.sort((a, b) {
          final scoreA = getScore(a['name'] as String, a['address'] as String);
          final scoreB = getScore(b['name'] as String, b['address'] as String);
          return scoreB.compareTo(scoreA);
        });

        return candidates.first['address'] as String;
      }
    } catch (e) {
      debugPrint("Interface scanning failed: $e");
    }

    // Heuristic 4: Scan all interfaces as fallback
    try {
      final interfaces = await NetworkInterface.list();
      for (var interface in interfaces) {
        for (var addr in interface.addresses) {
          if (addr.type == InternetAddressType.IPv4 && !addr.isLoopback) {
            return addr.address;
          }
        }
      }
    } catch (_) {}

    return "127.0.0.1";
  }

  @override
  void initState() {
    super.initState();
    _isRunning = _kernel.status == 'RUNNING';
    _activeRoomsCount = _kernel.activeRoomsCount;
    if (_isRunning) {
      _getIpAddress().then((ip) {
        if (mounted) {
          setState(() {
            _ipAddress = ip;
          });
        }
      });
    }
    _subscription = _kernel.statsStream.listen((event) {
      if (mounted) {
        if (event.containsKey('status') ||
            event.containsKey('activeConnections') ||
            event.containsKey('activeRooms')) {
          setState(() {
            if (event.containsKey('status')) {
              _isRunning = event['status'] == 'running';
            }
            if (event.containsKey('activeConnections')) {
              _activePlayersCount = event['activeConnections'];
              _updateChart(_activePlayersCount.toDouble());
            }
            if (event.containsKey('activeRooms')) {
              _activeRoomsCount = event['activeRooms'];
            } else {
              _activeRoomsCount = _kernel.activeRoomsCount;
            }
          });
        }
      }
    });
  }

  void _updateChart(double value) {
    _timer += 1;
    _trafficSpots.add(FlSpot(_timer, value));
    if (_trafficSpots.length > 20) _trafficSpots.removeAt(0);
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  Future<void> _requestPermissions() async {
    if (Platform.isAndroid) {
      final notificationStatus = await Permission.notification.status;
      if (!notificationStatus.isGranted) {
        await Permission.notification.request();
      }

      final batteryStatus = await Permission.ignoreBatteryOptimizations.status;
      if (!batteryStatus.isGranted) {
        await Permission.ignoreBatteryOptimizations.request();
      }
    }
  }

  void _toggleServer() async {
    if (_isRunning) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('STOP SERVER?'),
          content: const Text(
            'Are you sure you want to stop the server? Active games and players will disconnect.',
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
              child: const Text('STOP'),
            ),
          ],
        ),
      );
      if (confirm != true) return;

      try {
        await _kernel.stop();
      } catch (e) {
        // Log error
      }
      setState(() {
        _isRunning = false;
        _ipAddress = null;
        _activeRoomsCount = 0;
      });
    } else {
      await _requestPermissions();
      await _kernel.start();
      final ip = await _getIpAddress();
      setState(() {
        _ipAddress = ip;
        _activeRoomsCount = _kernel.activeRoomsCount;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;

        if (_isRunning) {
          final confirmExit = await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('STOP SERVER & EXIT?'),
              content: const Text(
                'The server is running. Exiting will stop the server and disconnect all players.',
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
                  child: const Text('STOP & EXIT'),
                ),
              ],
            ),
          );
          if (confirmExit == true) {
            await _kernel.stop();
            if (context.mounted) {
              SystemNavigator.pop();
            }
          }
        } else {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        backgroundColor: ArcadeTheme.backgroundColor,
        body: SafeArea(
          child: CustomScrollView(
            slivers: [
              _buildAppBar(),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    _buildStatsRow(),
                    const SizedBox(height: 20),
                    if (_isRunning) ...[
                      _buildNetworkCard(),
                      const SizedBox(height: 20),
                      _buildGamesSection(),
                      const SizedBox(height: 20),
                      _buildActivityChart(),
                    ],
                    const SizedBox(height: 100),
                  ]),
                ),
              ),
            ],
          ),
        ),
        floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
        floatingActionButton: _buildMainActionButton(),
      ),
    );
  }

  Widget _buildStatusBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _isRunning ? ArcadeTheme.successColor.withValues(alpha: 0.12) : ArcadeTheme.errorColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: _isRunning ? ArcadeTheme.successColor.withValues(alpha: 0.3) : ArcadeTheme.errorColor.withValues(alpha: 0.3),
          width: 1.0,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _isRunning
              ? Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: ArcadeTheme.successColor,
                  ),
                ).animate(
                  onPlay: (controller) {
                    if (!Platform.environment.containsKey('FLUTTER_TEST')) {
                      controller.repeat(reverse: true);
                    }
                  },
                ).scale(
                  begin: const Offset(0.8, 0.8),
                  end: const Offset(1.2, 1.2),
                  duration: 1.seconds,
                )
              : Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: ArcadeTheme.errorColor,
                  ),
                ),
          const SizedBox(width: 6),
          Text(
            _isRunning ? 'LIVE' : 'OFFLINE',
            style: ArcadeFonts.plusJakartaSans(
              color: _isRunning ? ArcadeTheme.successColor : ArcadeTheme.errorColor,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAppBar() {
    return SliverAppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      floating: true,
      centerTitle: false,
      title: FittedBox(
        fit: BoxFit.scaleDown,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(
              'assets/logo.png',
              height: 22,
            ),
            const SizedBox(width: 8),
            Text(
              'LAN ARCADE',
              style: ArcadeFonts.blackOpsOne(
                fontSize: 18,
                letterSpacing: 1.2,
                color: ArcadeTheme.primaryColor,
              ),
            ),
            const SizedBox(width: 8),
            _buildStatusBadge(),
          ],
        ),
      ),
      actions: [
        ScalePressButton(
          onTap: () => Navigator.push(
            context,
            PageRouteBuilder(
              pageBuilder: (context, animation, secondaryAnimation) => StorageCleanupScreen(kernel: _kernel),
              transitionsBuilder: (context, animation, secondaryAnimation, child) {
                return SlideTransition(
                  position: Tween(begin: const Offset(1, 0), end: Offset.zero).animate(
                    CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
                  ),
                  child: child,
                );
              },
            ),
          ),
          child: Container(
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.cleaning_services_outlined, size: 20, color: Colors.white70),
          ),
        ),
        ScalePressButton(
          onTap: () => Navigator.push(
            context,
            PageRouteBuilder(
              pageBuilder: (context, animation, secondaryAnimation) => DiagnosticsScreen(kernel: _kernel),
              transitionsBuilder: (context, animation, secondaryAnimation, child) {
                return SlideTransition(
                  position: Tween(begin: const Offset(1, 0), end: Offset.zero).animate(
                    CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
                  ),
                  child: child,
                );
              },
            ),
          ),
          child: Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.analytics_outlined, size: 20, color: Colors.white70),
          ),
        ),
      ],
    );
  }

  Widget _buildStatsRow() {
    return Row(
      children: [
        Expanded(
          child: ScalePressButton(
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => PlayersListScreen(
                  database: _kernel.db,
                  ipAddress: _ipAddress ?? '127.0.0.1',
                ),
              ),
            ),
            child: _buildStatCardContent('PLAYERS', _activePlayersCount.toString(), Icons.people_rounded),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: ScalePressButton(
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => RoomsListScreen(
                  kernel: _kernel,
                  ipAddress: _ipAddress ?? '127.0.0.1',
                ),
              ),
            ),
            child: _buildStatCardContent('ROOMS', _activeRoomsCount.toString(), Icons.grid_view_rounded),
          ),
        ),
      ],
    );
  }

  Widget _buildStatCardContent(String label, String value, IconData icon) {
    return ArcadeCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: ArcadeFonts.plusJakartaSans(
                  color: ArcadeTheme.textSecondary,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                ),
              ),
              Icon(icon, color: ArcadeTheme.primaryColor, size: 18),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: ArcadeFonts.plusJakartaSans(
              fontSize: 36,
              fontWeight: FontWeight.w800,
              letterSpacing: -1,
              color: ArcadeTheme.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNetworkCard() {
    final String serverUrl = "http://${_ipAddress ?? '0.0.0.0'}:${KernelManager.serverPort}";
    
    if (_cachedQrWidget == null || _cachedQrUrl != serverUrl) {
      _cachedQrUrl = serverUrl;
      _cachedQrWidget = QrImageView(
        data: serverUrl,
        version: QrVersions.auto,
        size: 160,
        eyeStyle: const QrEyeStyle(
          eyeShape: QrEyeShape.square,
          color: Color(0xFF0F172A),
        ),
        dataModuleStyle: const QrDataModuleStyle(
          dataModuleShape: QrDataModuleShape.square,
          color: Color(0xFF0F172A),
        ),
      );
    }

    return ArcadeCard(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Text(
            'SCAN QR OR COPY LINK',
            style: ArcadeFonts.plusJakartaSans(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: ArcadeTheme.textSecondary,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
            child: _cachedQrWidget!,
          ),
          const SizedBox(height: 20),
          InkWell(
            onTap: () {
              Clipboard.setData(ClipboardData(text: serverUrl));
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
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.white10),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.link, size: 16, color: ArcadeTheme.primaryColor),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      serverUrl,
                      overflow: TextOverflow.ellipsis,
                      style: ArcadeFonts.firaCode(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: ArcadeTheme.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Icon(Icons.copy_rounded, size: 14, color: Colors.white54),
                ],
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn().slideY(begin: 0.1);
  }

  Widget _buildActivityChart() {
    return ArcadeCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'SERVER ACTIVITY',
                style: ArcadeFonts.plusJakartaSans(
                  fontWeight: FontWeight.bold,
                  fontSize: 11,
                  color: ArcadeTheme.textSecondary,
                  letterSpacing: 1.2,
                ),
              ),
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: ArcadeTheme.primaryColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 140,
            child: LineChart(
              LineChartData(
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  drawHorizontalLine: true,
                  horizontalInterval: 1,
                  getDrawingHorizontalLine: (value) => const FlLine(
                    color: Color(0x0DFFFFFF),
                    strokeWidth: 0.8,
                  ),
                ),
                titlesData: const FlTitlesData(show: false),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  LineChartBarData(
                    spots: _trafficSpots,
                    isCurved: true,
                    color: ArcadeTheme.primaryColor,
                    barWidth: 3.5,
                    isStrokeCapRound: true,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          ArcadeTheme.primaryColor.withValues(alpha: 0.2),
                          ArcadeTheme.primaryColor.withValues(alpha: 0.0),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMainActionButton() {
    Color bg = _isRunning ? ArcadeTheme.errorColor : ArcadeTheme.primaryColor;
    Color fg = _isRunning ? Colors.white : ArcadeTheme.backgroundColor;
    String label = _isRunning ? 'STOP SERVER' : 'START SERVER';
    IconData icon = _isRunning ? Icons.stop_rounded : Icons.play_arrow_rounded;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: ScalePressButton(
        onTap: _toggleServer,
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            color: bg,
          ),
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  icon,
                  color: fg,
                  size: 22,
                ),
                const SizedBox(width: 12),
                Text(
                  label,
                  style: ArcadeFonts.plusJakartaSans(
                    color: fg,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildGamesSection() {
    final games = _kernel.availableGames;
    return ArcadeCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'GAMES',
            style: ArcadeFonts.plusJakartaSans(
              fontWeight: FontWeight.bold,
              fontSize: 11,
              color: ArcadeTheme.textSecondary,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 16),
          if (games.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'No games installed.',
                style: ArcadeFonts.plusJakartaSans(color: ArcadeTheme.textSecondary, fontSize: 13),
              ),
            )
          else
            Column(
              children: [
                for (int i = 0; i < games.length; i++) ...[
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.sports_esports_rounded,
                          color: ArcadeTheme.textPrimary,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              games[i].name,
                              style: ArcadeFonts.plusJakartaSans(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: ArcadeTheme.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Version ${games[i].version} • by ${games[i].author}',
                              style: ArcadeFonts.plusJakartaSans(
                                fontSize: 11,
                                color: ArcadeTheme.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '${games[i].minPlayers}-${games[i].maxPlayers}P',
                          style: ArcadeFonts.plusJakartaSans(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: ArcadeTheme.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (i < games.length - 1)
                    Divider(color: Colors.white.withValues(alpha: 0.05), height: 20),
                ]
              ],
            ),
        ],
      ),
    );
  }
}

class ScalePressButton extends StatefulWidget {
  final Widget child;
  final VoidCallback onTap;
  const ScalePressButton({super.key, required this.child, required this.onTap});

  @override
  State<ScalePressButton> createState() => _ScalePressButtonState();
}

class _ScalePressButtonState extends State<ScalePressButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) => setState(() => _isPressed = false),
      onTapCancel: () => setState(() => _isPressed = false),
      onTap: () {
        HapticManager.trigger('button');
        widget.onTap();
      },
      child: AnimatedScale(
        scale: _isPressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOutCubic,
        child: widget.child,
      ),
    );
  }
}
