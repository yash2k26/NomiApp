/**
 * Global font patch — makes EVERY <Text> / <TextInput> render in Fredoka,
 * with the right chunky weight variant picked from fontWeight.
 *
 * Single-family setup:
 *   - Fredoka has 5 weights (300/400/500/600/700) but we **floor at 500**.
 *     Light (300) and Regular (400) Fredoka feel thin and lose the brand voice,
 *     so anything below Medium gets bumped up to 500.
 *   - Fredoka has no ExtraBold (800) or Black (900). Those classes cap at
 *     Bold (700) — the heaviest variant available.
 *   - Effective weights in use: Fredoka_500Medium / 600SemiBold / 700Bold.
 *
 * The big landmines this handles:
 * 1. NativeWind 4 resolves classes like `font-bold` → fontWeight: '700' on
 *    style. Custom fonts on RN don't auto-resolve weights — each weight is its
 *    own font family. So we map fontWeight → variant.
 * 2. NativeWind / Tailwind defaults can set fontFamily to 'sans-serif' or
 *    similar. Anything that isn't `Fredoka_*` is treated as no-real-font and
 *    overridden.
 * 3. Two-layer guarantee: `Text.defaultProps` provides the baseline so even if
 *    the render-time hook is bypassed for some text, it still gets Fredoka.
 *    The render hook then upgrades to the right weight variant.
 *
 * Call applyDefaultFonts() at the very top of App.tsx, immediately after
 * polyfills and before any RN component imports.
 */

import React from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';

const FREDOKA_BY_WEIGHT: Record<string, string> = {
  // Floored — Fredoka Light/Regular feel thin, bump to Medium so brand stays consistent
  '100': 'Fredoka_500Medium',
  '200': 'Fredoka_500Medium',
  '300': 'Fredoka_500Medium',
  '400': 'Fredoka_500Medium',
  '500': 'Fredoka_500Medium',
  '600': 'Fredoka_600SemiBold',
  '700': 'Fredoka_700Bold',
  // Capped — Fredoka has no ExtraBold/Black variant
  '800': 'Fredoka_700Bold',
  '900': 'Fredoka_700Bold',
  normal: 'Fredoka_500Medium',
  bold: 'Fredoka_700Bold',
};

// Only Fredoka_* family names count as "explicit, respect-as-is" overrides.
// Anything else (system fallbacks, NativeWind 'sans-serif' etc.) is replaced.
function isOurFont(family: string | undefined | null): boolean {
  if (!family) return false;
  return String(family).startsWith('Fredoka_');
}

function pickFamily(style: any): string {
  const flat = StyleSheet.flatten(style) || {};
  if (isOurFont(flat.fontFamily as string | undefined)) {
    return flat.fontFamily as string;
  }
  const weight = flat.fontWeight != null ? String(flat.fontWeight) : '500';
  return FREDOKA_BY_WEIGHT[weight] ?? 'Fredoka_500Medium';
}

function injectStyle(style: any) {
  const family = pickFamily(style);
  // Strip fontWeight: iOS's font matcher would try to apply weight on top of
  // an already-weighted family ('Fredoka_700Bold' + fontWeight: 700 → looks
  // for a bolder Bold that doesn't exist, falls back to system). The font
  // family carries the weight, so we override fontWeight to 'normal'.
  const override = { fontFamily: family, fontWeight: 'normal' as const };
  if (!style) return override;
  return Array.isArray(style) ? [...style, override] : [style, override];
}

function patchRenderer(Component: any, label: string) {
  if (!Component) return;
  if (typeof Component.render !== 'function') {
    console.warn(`[fontPatch] ${label} has no .render — patch skipped`);
    return;
  }
  const oldRender = Component.render;
  Component.render = function patchedRender(...args: any[]) {
    const elem = oldRender.apply(this, args);
    if (!elem || !elem.props) return elem;
    return React.cloneElement(elem, {
      style: injectStyle(elem.props.style),
    });
  };
}

// Baseline fallback via defaultProps. Even if the render-time patch is bypassed
// for some Text (NativeWind 4 in some configs wraps Text differently), every
// Text without an explicit fontFamily gets Fredoka Medium as the default style.
function setBaselineDefault(Component: any) {
  if (!Component) return;
  const existing = (Component as any).defaultProps?.style;
  (Component as any).defaultProps = {
    ...((Component as any).defaultProps || {}),
    style: existing
      ? [{ fontFamily: 'Fredoka_500Medium' }, existing]
      : { fontFamily: 'Fredoka_500Medium' },
  };
}

let applied = false;
export function applyDefaultFonts() {
  if (applied) return;
  applied = true;
  setBaselineDefault(Text);
  setBaselineDefault(TextInput);
  patchRenderer(Text, 'Text');
  patchRenderer(TextInput, 'TextInput');
}
