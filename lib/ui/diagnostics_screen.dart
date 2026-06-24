import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../kernel/kernel_manager.dart';
import 'theme.dart';

class DiagnosticsScreen extends StatefulWidget {
  final KernelManager kernel;
  const DiagnosticsScreen({super.key, required this.kernel});

  @override
  State<DiagnosticsScreen> createState() => _DiagnosticsScreenState();
}

class _DiagnosticsScreenState extends State<DiagnosticsScreen> {
  static final TextStyle _logTextStyle = GoogleFonts.firaCode(
    fontSize: 12,
    height: 1.4,
  );

  final List<String> _logs = [];
  final List<String> _pendingLogs = [];
  String _status = 'OFFLINE';
  StreamSubscription? _subscription;
  Timer? _logFlushTimer;

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
    super.dispose();
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

  Widget _buildStatusHeader() {
    final bool isLive = _status == 'RUNNING';
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: ArcadeCard(
        padding: const EdgeInsets.all(16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'SERVER STATUS',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: ArcadeTheme.textSecondary,
                letterSpacing: 1.2,
              ),
            ),
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
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.w800,
                    color: isLive ? ArcadeTheme.successColor : ArcadeTheme.errorColor,
                    fontSize: 13,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ],
        ),
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
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildStatusHeader(),
            Padding(
              padding: const EdgeInsets.only(left: 20, top: 16, bottom: 8),
              child: Text(
                'SERVER EVENTS',
                style: GoogleFonts.plusJakartaSans(
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
                          style: GoogleFonts.plusJakartaSans(color: ArcadeTheme.textSecondary, fontSize: 13),
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
