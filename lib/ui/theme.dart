import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class ArcadeTheme {
  // Brand color scheme definitions (Dark Graphite + Premium Blue + White)
  static const primaryColor = Color(0xFF38BDF8); // Premium Blue Accent
  static const secondaryColor = Color(0xFF7DD3FC); // Blue Hover/Highlight
  static const pressedColor = Color(0xFF0284C7); // Blue Pressed
  
  static const backgroundColor = Color(0xFF0B0D10); // Dark Graphite
  static const surfaceColor = Color(0xFF14181D); // Elevated Surface
  static const cardColor = Color(0xFF1C2128); // Card background
  
  static const textPrimary = Color(0xFFF5F5F5); // Primary Off-White
  static const textSecondary = Color(0xFFA8B0BA); // Secondary Gray
  
  // Semantic status colors (retained for active state indication)
  static const successColor = Color(0xFF10B981); // Green
  static const warningColor = Color(0xFFF59E0B); // Orange
  static const errorColor = Color(0xFFEF4444); // Red

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      primaryColor: primaryColor,
      scaffoldBackgroundColor: backgroundColor,
      cardTheme: CardThemeData(
        color: cardColor,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Colors.white10, width: 1),
        ),
        elevation: 0,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: surfaceColor,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Colors.white10, width: 1),
        ),
        titleTextStyle: GoogleFonts.plusJakartaSans(
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: textPrimary,
        ),
        contentTextStyle: GoogleFonts.plusJakartaSans(
          fontSize: 14,
          color: textSecondary,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.black.withValues(alpha: 0.2),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.white10),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.white10),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primaryColor, width: 1.5),
        ),
        labelStyle: GoogleFonts.plusJakartaSans(color: textSecondary),
        hintStyle: GoogleFonts.plusJakartaSans(color: Colors.white24),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: backgroundColor,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.bold,
            fontSize: 14,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: textSecondary,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.bold,
            fontSize: 14,
          ),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: Colors.white10,
        thickness: 1,
        space: 24,
      ),
      textTheme: GoogleFonts.plusJakartaSansTextTheme(
        ThemeData.dark().textTheme.apply(bodyColor: textPrimary, displayColor: textPrimary),
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

// Reusable card system matching standard design boundaries
class ArcadeCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final Border? border;

  const ArcadeCard({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.border,
  });

  @override
  Widget build(BuildContext context) {
    Widget cardContent = Padding(
      padding: padding ?? const EdgeInsets.all(16),
      child: child,
    );

    return Container(
      decoration: BoxDecoration(
        color: ArcadeTheme.cardColor,
        borderRadius: BorderRadius.circular(12),
        border: border ?? Border.all(color: Colors.white.withValues(alpha: 0.05), width: 1),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: onTap != null
            ? Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: onTap,
                  child: cardContent,
                ),
              )
            : cardContent,
      ),
    );
  }
}

// Reusable button system matching design constraints
class ArcadeButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isPrimary;
  final bool isSecondary;
  final bool isDanger;
  final bool isGhost;
  final bool isFullWidth;

  const ArcadeButton.primary({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.isFullWidth = false,
  })  : isPrimary = true,
        isSecondary = false,
        isDanger = false,
        isGhost = false;

  const ArcadeButton.secondary({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.isFullWidth = false,
  })  : isPrimary = false,
        isSecondary = true,
        isDanger = false,
        isGhost = false;

  const ArcadeButton.danger({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.isFullWidth = false,
  })  : isPrimary = false,
        isSecondary = false,
        isDanger = true,
        isGhost = false;

  const ArcadeButton.ghost({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.isFullWidth = false,
  })  : isPrimary = false,
        isSecondary = false,
        isDanger = false,
        isGhost = true;

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    BorderSide borderSide = BorderSide.none;

    if (isPrimary) {
      bg = ArcadeTheme.primaryColor;
      fg = ArcadeTheme.backgroundColor;
    } else if (isSecondary) {
      bg = ArcadeTheme.cardColor;
      fg = ArcadeTheme.textPrimary;
      borderSide = const BorderSide(color: Colors.white10, width: 1);
    } else if (isDanger) {
      bg = ArcadeTheme.errorColor;
      fg = Colors.white;
    } else {
      // Ghost
      bg = Colors.transparent;
      fg = ArcadeTheme.textSecondary;
    }

    final buttonStyle = ElevatedButton.styleFrom(
      backgroundColor: bg,
      foregroundColor: fg,
      elevation: 0,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: borderSide,
      ),
      textStyle: GoogleFonts.plusJakartaSans(
        fontWeight: FontWeight.bold,
        fontSize: 14,
      ),
    );

    Widget btn;
    if (icon != null) {
      btn = ElevatedButton.icon(
        onPressed: onPressed,
        style: buttonStyle,
        icon: Icon(icon, size: 18),
        label: Text(label),
      );
    } else {
      btn = ElevatedButton(
        onPressed: onPressed,
        style: buttonStyle,
        child: Text(label),
      );
    }

    if (isFullWidth) {
      return SizedBox(
        width: double.infinity,
        child: btn,
      );
    }
    return btn;
  }
}
