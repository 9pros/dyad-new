import { useSettings } from "./useSettings";

export function useIsQwenAuthenticated(): boolean {
  const { settings } = useSettings();

  if (!settings?.qwenAccessToken || !settings?.qwenTokenExpiry) {
    return false;
  }

  return Date.now() < settings.qwenTokenExpiry;
}

export function useQwenProviderStatus(): {
  isSetup: boolean;
  isExpired: boolean;
  expiresInDays: number | null;
} {
  const { settings } = useSettings();

  if (!settings?.qwenAccessToken || !settings?.qwenTokenExpiry) {
    return { isSetup: false, isExpired: false, expiresInDays: null };
  }

  const now = Date.now();
  const isExpired = now >= settings.qwenTokenExpiry;
  const expiresInDays = isExpired
    ? null
    : Math.ceil((settings.qwenTokenExpiry - now) / (1000 * 60 * 60 * 24));

  return {
    isSetup: !isExpired,
    isExpired,
    expiresInDays,
  };
}
