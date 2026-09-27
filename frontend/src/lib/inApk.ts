/**
 * Is this page running inside the Android APK rather than a browser?
 *
 * The wrapper sets `onMessage`, and react-native-webview answers that by
 * putting `ReactNativeWebView` on the window before the page's scripts run.
 * pushBridge.ts relies on the same fact.
 *
 * WHY IT MATTERS: Google Play requires its own billing for anything bought to
 * unlock an app, and the seller's ₹50 buys slots and six months of shop time.
 * So inside the APK nothing names the price or offers a way to pay - she pays
 * the college desk or a coordinator, and staff record it. The website keeps
 * its payment screen. Strings do this by themselves: a dictionary key with a
 * `.apk` twin reads the twin here (see I18nProvider).
 */
export function inApk(
  w: { ReactNativeWebView?: unknown } | undefined = typeof window === 'undefined' ? undefined : window as never,
): boolean {
  return !!w?.ReactNativeWebView
}
