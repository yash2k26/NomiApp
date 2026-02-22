import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useWalletStore } from '@/store/walletStore';

const COLORS = {
  bg: '#171717',
  card: '#262626',
  primary: '#8B5CF6',
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
  success: '#10B981',
  error: '#EF4444',
};

export function WalletConnectScreen() {
  const { connectWallet, isConnecting, error, clearError } = useWalletStore();

  const handleConnect = async () => {
    clearError();
    await connectWallet();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoEmoji}>🐾</Text>
        </View>
        <Text style={styles.title}>Nomi</Text>
        <Text style={styles.subtitle}>Your Companion on Solana</Text>
      </View>

      <View style={styles.card}>
        {__DEV__ && (
          <View style={styles.devBadge}>
            <Text style={styles.devBadgeText}>DEV MODE</Text>
          </View>
        )}

        <Text style={styles.cardTitle}>Connect Wallet</Text>
        <Text style={styles.cardDesc}>Connect your Solana wallet to get started</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleConnect}
          disabled={isConnecting}
          activeOpacity={0.8}
          style={[styles.button, isConnecting && styles.buttonDisabled]}
        >
          {isConnecting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Connect Wallet</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.features}>
        <View style={styles.feature}>
          <Text style={styles.featureIcon}>🎮</Text>
          <Text style={styles.featureText}>Care & Play</Text>
        </View>
        <View style={styles.feature}>
          <Text style={styles.featureIcon}>👕</Text>
          <Text style={styles.featureText}>NFT Skins</Text>
        </View>
        <View style={styles.feature}>
          <Text style={styles.featureIcon}>🔐</Text>
          <Text style={styles.featureText}>True Ownership</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 96,
    height: 96,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoEmoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 48,
  },
  devBadge: {
    backgroundColor: COLORS.success + '30',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 16,
  },
  devBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.success,
    letterSpacing: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: COLORS.error + '20',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  feature: {
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
});
