import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:fl_chart/fl_chart.dart';
import '../kernel/kernel_manager.dart';
import '../discovery/discovery_service.dart';
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
  final DiscoveryService _discovery = DiscoveryService();
  final NetworkInfo _networkInfo = NetworkInfo();
  StreamSubscription? _subscription;
  
  bool _isRunning = false;
  String? _ipAddress;
  int _activePlayersCount = 0;
  int _activeRoomsCount = 0;
  final List<FlSpot> _trafficSpots = [const FlSpot(0, 0)];
  double _timer = 0;

  @override
  void initState() {
    super.initState();
    _isRunning = _kernel.status == 'RUNNING';
    _activeRoomsCount = _kernel.activeRoomsCount;
    _subscription = _kernel.statsStream.listen((event) {
      if (mounted) {
        setState(() {
          if (event.containsKey('status')) {
            _isRunning = event['status'] == 'running';
          }
          if (event.containsKey('activeConnections')) {
            _activePlayersCount = event['activeConnections'];
            _updateChart(_activePlayersCount.toDouble());
          }
          _activeRoomsCount = _kernel.activeRoomsCount;
        });
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
    _kernel.dispose();
    _discovery.stop();
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

      final locationStatus = await Permission.location.status;
      if (!locationStatus.isGranted) {
        await Permission.location.request();
      }
    }
  }

  void _toggleServer() async {
    if (_isRunning) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('SHUTDOWN ARCADE?'),
          content: const Text(
            'Are you sure you want to shut down the server? Active rooms and connections will be lost.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('CANCEL'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF4444),
                foregroundColor: Colors.white,
              ),
              child: const Text('SHUTDOWN'),
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
      try {
        await _discovery.stop();
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
      String? ip = await _networkInfo.getWifiIP();
      if (ip == null || ip.isEmpty) {
        try {
          final interfaces = await NetworkInterface.list();
          for (var interface in interfaces) {
            for (var addr in interface.addresses) {
              if (addr.type == InternetAddressType.IPv4 && !addr.isLoopback) {
                ip = addr.address;
                break;
              }
            }
            if (ip != null) break;
          }
        } catch (e) {
          debugPrint("Interface scanning failed: $e");
        }
      }
      ip ??= "127.0.0.1";
      try {
        await _discovery.start("Main Arcade", 8080);
      } catch (e) {
        debugPrint("Discovery failed: $e");
      }
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
              title: const Text('SHUTDOWN SERVER & EXIT?'),
              content: const Text(
                'The arcade server is currently running. Exiting the app will stop the server and disconnect all players.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: const Text('CANCEL'),
                ),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEF4444),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('SHUTDOWN & EXIT'),
                ),
              ],
            ),
          );
          if (confirmExit == true) {
            await _kernel.stop();
            await _discovery.stop();
            if (context.mounted) {
              SystemNavigator.pop();
            }
          }
        } else {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [ArcadeTheme.backgroundColor, Color(0xFF020617)],
            ),
          ),
          child: SafeArea(
            child: CustomScrollView(
              slivers: [
                _buildAppBar(),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      _buildStatsRow(),
                      const SizedBox(height: 20),
                      if (_isRunning) _buildNetworkCard(),
                      if (_isRunning) ...[
                        const SizedBox(height: 20),
                        _buildGamesSection(),
                      ],
                      const SizedBox(height: 20),
                      _buildActivityChart(),
                      const SizedBox(height: 100),
                    ]),
                  ),
                ),
              ],
            ),
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
        color: _isRunning ? Colors.green.withValues(alpha: 0.12) : Colors.red.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: _isRunning ? Colors.greenAccent.withValues(alpha: 0.5) : Colors.redAccent.withValues(alpha: 0.5),
          width: 1.0,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _isRunning ? Colors.greenAccent : Colors.redAccent,
              boxShadow: [
                BoxShadow(
                  color: _isRunning ? Colors.greenAccent : Colors.redAccent,
                  blurRadius: 4,
                ),
              ],
            ),
          ).animate(
            onPlay: (controller) {
              if (!Platform.environment.containsKey('FLUTTER_TEST')) {
                controller.repeat(reverse: true);
              }
            },
          ).scale(begin: const Offset(0.8, 0.8), end: const Offset(1.2, 1.2), duration: 1.seconds),
          const SizedBox(width: 6),
          Text(
            _isRunning ? 'LIVE' : 'OFFLINE',
            style: GoogleFonts.plusJakartaSans(
              color: _isRunning ? Colors.greenAccent : Colors.redAccent,
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
              style: GoogleFonts.blackOpsOne(
                fontSize: 18,
                letterSpacing: 1.2,
                color: ArcadeTheme.primaryColor,
                shadows: [
                  Shadow(
                    color: ArcadeTheme.primaryColor.withValues(alpha: 0.3),
                    blurRadius: 8,
                  )
                ],
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
            child: _buildStatCardContent('PLAYERS', _activePlayersCount.toString(), Icons.people_rounded, ArcadeTheme.primaryColor),
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
            child: _buildStatCardContent('ROOMS', _activeRoomsCount.toString(), Icons.grid_view_rounded, ArcadeTheme.secondaryColor),
          ),
        ),
      ],
    );
  }

  Widget _buildStatCardContent(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: ArcadeTheme.surfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.15), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: GoogleFonts.plusJakartaSans(
                  color: Colors.white30,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                ),
              ),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: color, size: 18),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 36,
              fontWeight: FontWeight.w800,
              letterSpacing: -1,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNetworkCard() {
    final String serverUrl = "http://${_ipAddress ?? '0.0.0.0'}:8080";
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: ArcadeTheme.surfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            'JOIN WITH CODE OR SCAN',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Colors.white54,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black26,
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                )
              ],
            ),
            child: QrImageView(
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
            ),
          ),
          const SizedBox(height: 20),
          InkWell(
            onTap: () {
              Clipboard.setData(ClipboardData(text: serverUrl));
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Row(
                    children: [
                      const Icon(Icons.check_circle_rounded, color: Colors.greenAccent, size: 18),
                      const SizedBox(width: 8),
                      const Text('Server URL copied to clipboard!'),
                    ],
                  ),
                  behavior: SnackBarBehavior.floating,
                  backgroundColor: ArcadeTheme.surfaceColor,
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
                  Text(
                    serverUrl,
                    style: GoogleFonts.firaCode(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: Colors.white,
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
    return Container(
      height: 220,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: ArcadeTheme.surfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'LIVE TRAFFIC ACTIVITY',
                style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.bold,
                  fontSize: 11,
                  color: Colors.white38,
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
              ).animate(
                onPlay: (controller) {
                  if (!Platform.environment.containsKey('FLUTTER_TEST')) {
                    controller.repeat(reverse: true);
                  }
                },
              ).scale(begin: const Offset(0.7, 0.7), end: const Offset(1.3, 1.3), duration: 800.ms),
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
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
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: ScalePressButton(
        onTap: _toggleServer,
        child: Container(
          height: 64,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: _isRunning 
                ? [const Color(0xFFEF4444), const Color(0xFFDC2626)]
                : [ArcadeTheme.primaryColor, ArcadeTheme.secondaryColor],
            ),
            boxShadow: [
              BoxShadow(
                color: (_isRunning ? const Color(0xFFEF4444) : ArcadeTheme.primaryColor).withValues(alpha: 0.35),
                blurRadius: 16,
                offset: const Offset(0, 6),
              )
            ],
          ),
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _isRunning ? Icons.power_settings_new_rounded : Icons.sports_esports_rounded,
                  color: Colors.white,
                  size: 26,
                ),
                const SizedBox(width: 12),
                Text(
                  _isRunning ? 'SHUTDOWN ARCADE' : 'LAUNCH ARCADE',
                  style: GoogleFonts.plusJakartaSans(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ).animate(target: _isRunning ? 0 : 1).shimmer(duration: 3.seconds);
  }

  Widget _buildGamesSection() {
    final games = _kernel.availableGames;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: ArcadeTheme.surfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'AVAILABLE PLUGINS',
            style: GoogleFonts.plusJakartaSans(
              fontWeight: FontWeight.bold,
              fontSize: 11,
              color: Colors.white38,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 16),
          if (games.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'No active game plugins found.',
                style: GoogleFonts.plusJakartaSans(color: Colors.white38, fontSize: 13),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: games.length,
              separatorBuilder: (context, index) => Divider(color: Colors.white.withValues(alpha: 0.05), height: 20),
              itemBuilder: (context, index) {
                final game = games[index];
                return Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: ArcadeTheme.primaryColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.sports_esports_rounded,
                        color: ArcadeTheme.primaryColor,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            game.name,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Version ${game.version} • by ${game.author}',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 11,
                              color: Colors.white38,
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
                        '${game.minPlayers}-${game.maxPlayers}P',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: ArcadeTheme.secondaryColor,
                        ),
                      ),
                    ),
                  ],
                );
              },
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
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _isPressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOutCubic,
        child: widget.child,
      ),
    );
  }
}
