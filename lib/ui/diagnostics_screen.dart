import 'package:flutter/material.dart';
import '../kernel/kernel_manager.dart';

class DiagnosticsScreen extends StatefulWidget {
  final KernelManager kernel;
  const DiagnosticsScreen({super.key, required this.kernel});

  @override
  State<DiagnosticsScreen> createState() => _DiagnosticsScreenState();
}

class _DiagnosticsScreenState extends State<DiagnosticsScreen> {
  final List<String> _logs = [];
  String _status = 'OFFLINE';

  @override
  void initState() {
    super.initState();
    widget.kernel.statsStream.listen((event) {
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
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Server Diagnostics')),
      body: Column(
        children: [
          ListTile(
            title: const Text('Current Status'),
            trailing: Text(_status, style: const TextStyle(fontWeight: FontWeight.bold)),
          ),
          const Divider(),
          const Padding(
            padding: EdgeInsets.all(8.0),
            child: Text('System Logs', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
          Expanded(
            child: Container(
              margin: const EdgeInsets.all(8),
              padding: const EdgeInsets.all(8),
              color: Colors.black,
              child: ListView.builder(
                itemCount: _logs.length,
                itemBuilder: (context, index) => Text(
                  _logs[index],
                  style: const TextStyle(color: Colors.greenAccent, fontFamily: 'monospace', fontSize: 12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
