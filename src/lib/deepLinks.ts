import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

/*
 * Deep-link handling. Custom scheme: `oraclepet://`. Examples:
 *   oraclepet://?ref=<walletAddress>
 *   oraclepet://pet/<address>      (future: open someone else's pet profile)
 *
 * Universal links (https://nomi.app/...) require deploying:
 *   - https://nomi.app/.well-known/apple-app-site-association
 *   - https://nomi.app/.well-known/assetlinks.json
 * + adding intentFilters / associatedDomains to app.json. Stubbed below; flip
 * the constants once the domain is live.
 */

const PENDING_REFERRAL_KEY = 'oracle-pet-pending-ref';

export interface ParsedLink {
  type: 'referral' | 'pet_profile' | 'unknown';
  ref?: string;
  petAddress?: string;
}

export function parseDeepLink(url: string | null): ParsedLink {
  if (!url) return { type: 'unknown' };
  try {
    const parsed = Linking.parse(url);
    const ref = parsed.queryParams?.ref;
    if (typeof ref === 'string' && ref.length > 0) {
      return { type: 'referral', ref };
    }
    const path = parsed.path ?? '';
    const petMatch = path.match(/^pet\/([A-Za-z0-9]+)$/);
    if (petMatch) return { type: 'pet_profile', petAddress: petMatch[1] };
  } catch {}
  return { type: 'unknown' };
}

export async function setPendingReferral(ref: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_REFERRAL_KEY, ref);
  } catch {}
}

export async function getPendingReferral(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_REFERRAL_KEY);
  } catch {
    return null;
  }
}

export async function clearPendingReferral(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
  } catch {}
}

/**
 * Build a referral share URL for the given wallet. When universal links go
 * live, switch to https form so previews/unfurls work in iMessage / Discord.
 */
export function buildReferralUrl(walletAddress: string): string {
  return `oraclepet://?ref=${encodeURIComponent(walletAddress)}`;
}
