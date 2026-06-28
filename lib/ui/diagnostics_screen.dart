import 'dart:async';
import 'package:flutter/material.dart';
import 'arcade_fonts.dart';
import '../kernel/kernel_manager.dart';
import 'theme.dart';

class DiagnosticsScreen extends StatefulWidget {
  final KernelManager kernel;
  const DiagnosticsScreen({super.key, required this.kernel});

  @override
  State<DiagnosticsScreen> createState() => _DiagnosticsScreenState();
}

class _DiagnosticsScreenState extends State<DiagnosticsScreen> {
  static final TextStyle _logTextStyle = ArcadeFonts.firaCode(
    fontSize: 12,
    height: 1.4,
  );

  final List<String> _logs = [];
  final List<String> _pendingLogs = [];
  String _status = 'OFFLINE';
  StreamSubscription? _subscription;
  Timer? _logFlushTimer;

  Timer? _metricsTimer;
  Map<String, dynamic> _diagInfo = {};
  Map<String, dynamic> _lockStatus = {
    'serviceRunning': false,
    'wakeLock': false,
    'wifiLock': false,
    'multicastLock': false,
  };

  @override
  void initState() {
    super.initState();
    _status = widget.kernel.status;
    _logs.addAll(widget.kernel.logHistory);
    _subscription = widget.kernel.statsStream.listen((event) {
      if (mounted) {
        if (event.containsKey('status')) {
          setState(() {
            _status = event['status'].toString().toUpperCase();
          });
        }
        if (event.containsKey('log')) {
          _pendingLogs.add(event['log']);
          _startFlushTimer();
        }
      }
    });

    _loadMetrics();
    _metricsTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      _loadMetrics();
    });
  }

  void _loadMetrics() async {
    final info = widget.kernel.getDiagnosticsInfo();
    final locks = await widget.kernel.getNativeServiceStatus();
    if (mounted) {
      setState(() {
        _diagInfo = info;
        _lockStatus = locks;
      });
    }
  }

  void _startFlushTimer() {
    if (_logFlushTimer != null) return;
    _logFlushTimer = Timer.periodic(const Duration(milliseconds: 200), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_pendingLogs.isNotEmpty) {
        setState(() {
          for (final log in _pendingLogs) {
            _logs.insert(0, log);
          }
          _pendingLogs.clear();
          if (_logs.length > 50) {
            _logs.removeRange(50, _logs.length);
          }
        });
      } else {
        _logFlushTimer?.cancel();
        _logFlushTimer = null;
      }
    });
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _logFlushTimer?.cancel();
    _metricsTimer?.cancel();
    super.dispose();
  }

  Widget _buildMetricsDashboard() {
    final uptime = _diagInfo['uptime'] as Duration? ?? Duration.zero;
    final hours = uptime.inHours.toString().padLeft(2, '0');
    final minutes = (uptime.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (uptime.inSeconds % 60).toString().padLeft(2, '0');

    final openSockets = _diagInfo['openSockets'] ?? 0;
    final identifiedPlayers = _diagInfo['identifiedPlayers'] ?? 0;
    final activeRooms = _diagInfo['activeRooms'] ?? 0;
    final mDNSState = _diagInfo['mDNSState'] ?? 'Inactive';

    final wakeLock = _lockStatus['wakeLock'] ?? false;
    final wifiLock = _lockStatus['wifiLock'] ?? false;
    final multicastLock = _lockStatus['multicastLock'] ?? false;

    final bool isLive = _status == 'RUNNING';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: ArcadeCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isLive ? ArcadeTheme.successColor : ArcadeTheme.errorColor,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _status,
                      style: ArcadeFonts.plusJakartaSans(
                        fontWeight: FontWeight.w800,
                        color: isLive ? ArcadeTheme.successColor : ArcadeTheme.errorColor,
                        fontSize: 13,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
                Text(
                  'Uptime: $hours:$minutes:$seconds',
                  style: ArcadeFonts.firaCode(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: ArcadeTheme.textSecondary,
                  ),
                ),
              ],
            ),
            const Divider(color: Colors.white10, height: 24),
            Row(
              children: [
                Expanded(
                  child: _buildMetricTile(
                    'SOCKETS',
                    '$openSockets',
                    Icons.connect_without_contact_rounded,
                  ),
                ),
                Expanded(
                  child: _buildMetricTile(
                    'PLAYERS',
                    '$identifiedPlayers',
                    Icons.people_alt_rounded,
                  ),
                ),
                Expanded(
                  child: _buildMetricTile(
                    'ROOMS',
                    '$activeRooms',
                    Icons.videogame_asset_rounded,
                  ),
                ),
              ],
            ),
            const Divider(color: Colors.white10, height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'mDNS Discovery:',
                  style: ArcadeFonts.plusJakartaSans(fontSize: 12, color: ArcadeTheme.textSecondary),
                ),
                Text(
                  mDNSState,
                  style: ArcadeFonts.plusJakartaSans(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: mDNSState == 'Registered' ? ArcadeTheme.successColor : ArcadeTheme.errorColor,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'NATIVE WAKELOCKS',
              style: ArcadeFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: ArcadeTheme.textSecondary,
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _buildLockBadge('WakeLock', wakeLock),
                const SizedBox(width: 8),
                _buildLockBadge('WifiLock', wifiLock),
                const SizedBox(width: 8),
                _buildLockBadge('MulticastLock', multicastLock),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricTile(String label, String value, IconData icon) {
    return Column(
      children: [
        Icon(icon, color: ArcadeTheme.textSecondary, size: 20),
        const SizedBox(height: 4),
        Text(
          value,
          style: ArcadeFonts.firaCode(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        Text(
          label,
          style: ArcadeFonts.plusJakartaSans(
            fontSize: 9,
            fontWeight: FontWeight.bold,
            color: ArcadeTheme.textSecondary,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }

  Widget _buildLockBadge(String label, bool active) {
    final color = active ? ArcadeTheme.successColor : ArcadeTheme.errorColor;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Center(
          child: Text(
            label.toUpperCase(),
            style: ArcadeFonts.plusJakartaSans(
              fontSize: 9,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLogLine(String log) {
    Color textColor = ArcadeTheme.textSecondary;
    if (log.contains('ERROR') || log.contains('FAILED')) {
      textColor = ArcadeTheme.errorColor;
    } else if (log.contains('STARTED') || log.contains('LIVE') || log.contains('ASSETS_READY')) {
      textColor = ArcadeTheme.successColor;
    } else if (log.contains('STARTING') || log.contains('WS_CONNECTION') || log.contains('SERVER_START_REQUESTED')) {
      textColor = ArcadeTheme.primaryColor;
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Text(
        log,
        style: _logTextStyle.copyWith(color: textColor),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ArcadeTheme.backgroundColor,
      appBar: AppBar(
        title: Text(
          'SERVER LOGS',
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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildMetricsDashboard(),
            Padding(
              padding: const EdgeInsets.only(left: 20, top: 16, bottom: 8),
              child: Text(
                'SERVER EVENTS',
                style: ArcadeFonts.plusJakartaSans(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: ArcadeTheme.textSecondary,
                  letterSpacing: 1.2,
                ),
              ),
            ),
            Expanded(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white10),
                ),
                child: _logs.isEmpty
                    ? Center(
                        child: Text(
                          'No logs recorded yet.',
                          style: ArcadeFonts.plusJakartaSans(color: ArcadeTheme.textSecondary, fontSize: 13),
                        ),
                      )
                    : ListView.builder(
                        itemCount: _logs.length,
                        itemBuilder: (context, index) => _buildLogLine(_logs[index]),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
