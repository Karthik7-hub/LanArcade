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
  final List<FlSpot> _trafficSpots = [const FlSpot(0, 0)];
  double _timer = 0;

  @override
  void initState() {
    super.initState();
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
      // 1. Notification Permission (Needed for Foreground Service notification on Android 13+)
      final notificationStatus = await Permission.notification.status;
      if (!notificationStatus.isGranted) {
        await Permission.notification.request();
      }

      // 2. Ignore Battery Optimizations (Allows background execution without service killings)
      final batteryStatus = await Permission.ignoreBatteryOptimizations.status;
      if (!batteryStatus.isGranted) {
        await Permission.ignoreBatteryOptimizations.request();
      }

      // 3. Location Permission (Needed by network_info_plus on Android to read local network details/IP/SSID)
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
          backgroundColor: ArcadeTheme.surfaceColor,
          title: Text(
            'SHUTDOWN ARCADE?',
            style: GoogleFonts.blackOpsOne(
              color: Colors.redAccent,
              fontSize: 20,
              letterSpacing: 1,
            ),
          ),
          content: Text(
            'Are you sure you want to shut down the server? Active rooms and connections will be lost.',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.8)),
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
            side: const BorderSide(color: Colors.white10),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(
                'CANCEL',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontWeight: FontWeight.bold),
              ),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF4444),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text('SHUTDOWN', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      );
      if (confirm != true) return;

      _kernel.stop();
      await _discovery.stop();
      setState(() {
        _isRunning = false;
        _ipAddress = null;
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
      });
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
          child: CustomScrollView(
            slivers: [
              _buildAppBar(),
              SliverPadding(
                padding: const EdgeInsets.all(20),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    _buildStatsRow(),
                    const SizedBox(height: 24),
                    if (_isRunning) _buildNetworkCard(),
                    if (_isRunning) ...[
                      const SizedBox(height: 24),
                      _buildGamesSection(),
                    ],
                    const SizedBox(height: 24),
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
    );
  }

  Widget _buildStatusBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: _isRunning ? Colors.green.withValues(alpha: 0.15) : Colors.red.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: _isRunning ? Colors.greenAccent : Colors.redAccent,
          width: 1.2,
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
            ),
          ).animate(
            onPlay: (controller) {
              if (!Platform.environment.containsKey('FLUTTER_TEST')) {
                controller.repeat(reverse: true);
              }
            },
          ).scale(begin: const Offset(0.8, 0.8), end: const Offset(1.2, 1.2), duration: 1.seconds),
          const SizedBox(width: 4),
          Text(
            _isRunning ? 'LIVE' : 'OFFLINE',
            style: GoogleFonts.blackOpsOne(
              color: _isRunning ? Colors.greenAccent : Colors.redAccent,
              fontSize: 8,
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
      floating: true,
      title: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.asset(
            'assets/logo.png',
            height: 24,
          ),
          const SizedBox(width: 8),
          Text(
            'LAN ARCADE',
            style: GoogleFonts.blackOpsOne(
              fontSize: 18,
              letterSpacing: 1.5,
              color: ArcadeTheme.primaryColor,
            ),
          ),
          const SizedBox(width: 8),
          _buildStatusBadge(),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.cleaning_services_outlined),
          onPressed: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => StorageCleanupScreen(kernel: _kernel)),
          ),
        ),
        IconButton(
          icon: const Icon(Icons.analytics_outlined),
          onPressed: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => DiagnosticsScreen(kernel: _kernel)),
          ),
        ),
      ],
    );
  }

  Widget _buildStatsRow() {
    return Row(
      children: [
        _buildStatCard('PLAYERS', _activePlayersCount.toString(), Icons.people_rounded, ArcadeTheme.primaryColor),
        const SizedBox(width: 16),
        _buildStatCard('ROOMS', '0', Icons.grid_view_rounded, ArcadeTheme.secondaryColor),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: ArcadeTheme.surfaceColor,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 12),
            Text(value, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold)),
            Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  Widget _buildNetworkCard() {
    final String serverUrl = "http://${_ipAddress ?? '0.0.0.0'}:8080";
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [ArcadeTheme.primaryColor.withValues(alpha: 0.1), ArcadeTheme.secondaryColor.withValues(alpha: 0.1)],
        ),
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
            ),
            child: QrImageView(
              data: serverUrl,
              version: QrVersions.auto,
              size: 180,
            ),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.26),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.link, size: 18, color: ArcadeTheme.primaryColor),
                const SizedBox(width: 8),
                Text(serverUrl, style: GoogleFonts.firaCode(fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn().slideY(begin: 0.1);
  }

  Widget _buildActivityChart() {
    return Container(
      height: 200,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: ArcadeTheme.surfaceColor,
        borderRadius: BorderRadius.circular(32),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('TRAFFIC', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.white38)),
          const SizedBox(height: 16),
          Expanded(
            child: LineChart(
              LineChartData(
                gridData: const FlGridData(show: false),
                titlesData: const FlTitlesData(show: false),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  LineChartBarData(
                    spots: _trafficSpots,
                    isCurved: true,
                    color: ArcadeTheme.primaryColor,
                    barWidth: 4,
                    isStrokeCapRound: true,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      color: ArcadeTheme.primaryColor.withValues(alpha: 0.1),
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
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GestureDetector(
        onTap: _toggleServer,
        child: Container(
          height: 70,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(35),
            gradient: LinearGradient(
              colors: _isRunning 
                ? [const Color(0xFFEF4444), const Color(0xFFB91C1C)]
                : [ArcadeTheme.primaryColor, ArcadeTheme.secondaryColor],
            ),
            boxShadow: [
              BoxShadow(
                color: (_isRunning ? Colors.red : ArcadeTheme.primaryColor).withValues(alpha: 0.3),
                blurRadius: 20,
                offset: const Offset(0, 10),
              )
            ],
          ),
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(_isRunning ? Icons.stop_rounded : Icons.play_arrow_rounded, color: Colors.white, size: 32),
                const SizedBox(width: 12),
                Text(
                  _isRunning ? 'SHUTDOWN ARCADE' : 'LAUNCH ARCADE',
                  style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900, letterSpacing: 1),
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
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: ArcadeTheme.surfaceColor,
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'AVAILABLE PLUGINS',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 12,
              color: Colors.white38,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 16),
          if (games.isEmpty)
            Text(
              'No active game plugins found.',
              style: TextStyle(color: Colors.white.withValues(alpha: 0.5)),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: games.length,
              separatorBuilder: (context, index) => Divider(color: Colors.white.withValues(alpha: 0.05), height: 24),
              itemBuilder: (context, index) {
                final game = games[index];
                return Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: ArcadeTheme.primaryColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(
                        Icons.sports_esports_rounded,
                        color: ArcadeTheme.primaryColor,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            game.name,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Version ${game.version} • by ${game.author}',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.white.withValues(alpha: 0.4),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '${game.minPlayers}-${game.maxPlayers}P',
                        style: const TextStyle(
                          fontSize: 11,
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
