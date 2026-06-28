import 'package:flutter/material.dart';

class ArcadeFonts {
  static TextStyle plusJakartaSans({
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
    double? letterSpacing,
    double? height,
    List<Shadow>? shadows,
    TextDecoration? decoration,
    TextStyle? textStyle,
  }) {
    final base = textStyle ?? const TextStyle();
    return base.copyWith(
      fontFamily: 'PlusJakartaSans',
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
      shadows: shadows,
      decoration: decoration,
    );
  }

  static TextStyle firaCode({
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
    double? letterSpacing,
    double? height,
    List<Shadow>? shadows,
    TextDecoration? decoration,
    TextStyle? textStyle,
  }) {
    final base = textStyle ?? const TextStyle();
    return base.copyWith(
      fontFamily: 'FiraCode',
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
      shadows: shadows,
      decoration: decoration,
    );
  }

  static TextStyle blackOpsOne({
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
    double? letterSpacing,
    double? height,
    List<Shadow>? shadows,
    TextDecoration? decoration,
    TextStyle? textStyle,
  }) {
    final base = textStyle ?? const TextStyle();
    return base.copyWith(
      fontFamily: 'BlackOpsOne',
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
      shadows: shadows,
      decoration: decoration,
    );
  }

  static TextTheme plusJakartaSansTextTheme([TextTheme? base]) {
    final theme = base ?? const TextTheme();
    return theme.copyWith(
      displayLarge: (theme.displayLarge ?? const TextStyle()).copyWith(fontFamily: 'PlusJakartaSans'),
      displayMedium: (theme.displayMedium ?? const TextStyle()).copyWith(fontFamily: 'PlusJakartaSans'),
      displaySmall: (theme.displaySmall ?? const TextStyle()).copyWith(fontFamily: 'PlusJakartaSans'),
      headlineLarge: (theme.headlineLarge ?? const TextStyle()).copyWith(fontFamily: 'PlusJakartaSans'),
      headlineMedium: (theme.headlineMedium ?? const TextStyle()).copyWith(fontFamily: 'PlusJakartaSans'),
      headlineSmall: (theme.headlineSmall ?? const TextStyle()).copyWith(fontFamily: 'PlusJakartaSans'),
      titleLarge: (theme.titleLarge ?? const TextStyle()).copyWith(fontFamily: 'PlusJakartaSans'),
      titleMedium: (theme.titleMedium ?? const TextStyle()).copyWith(fontFamily: 'PlusJakartaSans'),
      titleSmall: (theme.titleSmall ?? const TextStyle()).copyWith(fontFamily: 'PlusJakartaSans'),
      bodyLarge: (theme.bodyLarge ?? const TextStyle()).copyWith(fontFamily: 'PlusJakartaSans'),
      bodyMedium: (theme.bodyMedium ?? const TextStyle()).copyWith(fontFamily: 'PlusJakartaSans'),
      bodySmall: (theme.bodySmall ?? const TextStyle()).copyWith(fontFamily: 'PlusJakartaSans'),
      labelLarge: (theme.labelLarge ?? const TextStyle()).copyWith(fontFamily: 'PlusJakartaSans'),
      labelMedium: (theme.labelMedium ?? const TextStyle()).copyWith(fontFamily: 'PlusJakartaSans'),
      labelSmall: (theme.labelSmall ?? const TextStyle()).copyWith(fontFamily: 'PlusJakartaSans'),
    );
  }
}
