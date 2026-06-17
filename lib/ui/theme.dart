import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class ArcadeTheme {
  static const primaryColor = Color(0xFF6366F1);
  static const secondaryColor = Color(0xFFEC4899);
  static const backgroundColor = Color(0xFF0F172A);
  static const surfaceColor = Color(0xFF1E293B);
  static const accentColor = Color(0xFF10B981);

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      primaryColor: primaryColor,
      scaffoldBackgroundColor: backgroundColor,
      cardTheme: CardThemeData(
        color: surfaceColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        elevation: 0,
      ),
      textTheme: GoogleFonts.plusJakartaSansTextTheme(
        ThemeData.dark().textTheme.apply(bodyColor: Colors.white, displayColor: Colors.white),
      ),
      colorScheme: const ColorScheme.dark(
        primary: primaryColor,
        secondary: secondaryColor,
        surface: surfaceColor,
      ),
      useMaterial3: true,
    );
  }
}
