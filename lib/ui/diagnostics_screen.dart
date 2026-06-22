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
  final List<String> _logs = [];
  String _status = 'OFFLINE';
  StreamSubscription? _subscription;

  @override
  void initState() {
    super.initState();
    _status = widget.kernel.status;
    _logs.addAll(widget.kernel.logHistory);
    _subscription = widget.kernel.statsStream.listen((event) {
      if (mounted) {
        setState(() {
          if (event.containsKey('status')) {
            _status = event['status'].toString().toUpperCase();
          }
          if (event.containsKey('log')) {
            _logs.insert(0, event['log']);
            if (_logs.length > 50) _logs.removeLast();
          }
        });
      }
    });
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  Widget _buildLogLine(String log) {
    Color textColor = Colors.white70;
    if (log.contains('ERROR') || log.contains('FAILED')) {
      textColor = Colors.redAccent;
    } else if (log.contains('STARTED') || log.contains('LIVE') || log.contains('ASSETS_READY')) {
      textColor = Colors.greenAccent;
    } else if (log.contains('STARTING') || log.contains('WS_CONNECTION') || log.contains('SERVER_START_REQUESTED')) {
      textColor = ArcadeTheme.primaryColor;
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Text(
        log,
        style: GoogleFonts.firaCode(
          color: textColor,
          fontSize: 12,
          height: 1.4,
        ),
      ),
    );
  }

  Widget _buildStatusHeader() {
    final bool isLive = _status == 'RUNNING';
    return Container(
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: ArcadeTheme.surfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'SERVER STATUS',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Colors.white54,
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
                  color: isLive ? Colors.greenAccent : Colors.redAccent,
                  boxShadow: [
                    BoxShadow(
                      color: isLive ? Colors.greenAccent : Colors.redAccent,
                      blurRadius: 4,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                _status,
                style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.w800,
                  color: isLive ? Colors.greenAccent : Colors.redAccent,
                  fontSize: 13,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'DIAGNOSTICS',
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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildStatusHeader(),
            Padding(
              padding: const EdgeInsets.only(left: 20, top: 16, bottom: 8),
              child: Text(
                'SYSTEM EVENTS LOG',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: Colors.white38,
                  letterSpacing: 1.2,
                ),
              ),
            ),
            Expanded(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                ),
                child: _logs.isEmpty
                    ? Center(
                        child: Text(
                          'No logs recorded yet.',
                          style: GoogleFonts.plusJakartaSans(color: Colors.white38, fontSize: 13),
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
