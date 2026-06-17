import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'admin_dashboard.dart';
import 'theme.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const AdminDashboard()),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ArcadeTheme.backgroundColor,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [ArcadeTheme.backgroundColor, Color(0xFF020617)],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Image.asset(
                'assets/logo.png',
                width: 200,
                height: 200,
              )
                  .animate()
                  .fadeIn(duration: 1.seconds)
                  .scale(begin: const Offset(0.8, 0.8), end: const Offset(1.0, 1.0), duration: 1.seconds, curve: Curves.easeOutBack)
                  .shimmer(delay: 1.seconds, duration: 1.5.seconds),
              const SizedBox(height: 24),
              Text(
                'LAN ARCADE',
                style: GoogleFonts.blackOpsOne(
                  fontSize: 32,
                  letterSpacing: 4,
                  color: ArcadeTheme.primaryColor,
                ),
              )
                  .animate()
                  .fadeIn(delay: 500.ms, duration: 1.seconds)
                  .slideY(begin: 0.2, end: 0.0, delay: 500.ms, duration: 1.seconds),
              const SizedBox(height: 8),
              Text(
                'YOUR PORTABLE ARCADE SYSTEM',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.4),
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2,
                ),
              )
                  .animate()
                  .fadeIn(delay: 1.seconds, duration: 1.seconds),
            ],
          ),
        ),
      ),
    );
  }
}
