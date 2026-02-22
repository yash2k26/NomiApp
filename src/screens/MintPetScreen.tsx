import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useWalletStore } from '@/store/walletStore';
import { usePetStore } from '@/store/petStore';

const COLORS = {
  bg: '#171717',
  card: '#262626',
  primary: '#8B5CF6',
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
  success: '#10B981',
  warning: '#F59E0B',
};

const MINT_COST = 0.01;

export function MintPetScreen() {
  const { walletAddress, balance } = useWalletStore();
  const { isMinting, mintPetNFT } = usePetStore();
  const canMint = balance >= MINT_COST && !isMinting;

  const handleMint = async () => {
    if (!walletAddress || !canMint) return;
    await mintPetNFT(walletAddress);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.preview}>
          <Text style={styles.previewEmoji}>🐾</Text>
        </View>
        <Text style={styles.title}>Meet Nomi</Text>
        <Text style={styles.subtitle}>Your companion awaits</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>Nomi</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Type</Text>
          <Text style={styles.value}>Companion</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Network</Text>
          <Text style={[styles.value, { color: COLORS.success }]}>Solana</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Mint Cost</Text>
          <Text style={[styles.value, styles.price]}>{MINT_COST} SOL</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Your Balance</Text>
          <Text style={[styles.value, balance < MINT_COST ? { color: COLORS.warning } : null]}>
            {balance.toFixed(2)} SOL
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={handleMint}
        disabled={!canMint}
        activeOpacity={0.8}
        style={[styles.button, !canMint && styles.buttonDisabled]}
      >
        {isMinting ? (
          <View style={styles.mintingRow}>
            <ActivityIndicator color="#FFF" size="small" />
            <Text style={styles.buttonText}>Minting...</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>Mint Nomi NFT</Text>
        )}
      </TouchableOpacity>
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
    marginBottom: 32,
  },
  preview: {
    width: 128,
    height: 128,
    backgroundColor: COLORS.primary + '30',
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  previewEmoji: {
    fontSize: 56,
  },
  title: {
    fontSize: 32,
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
    padding: 20,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  label: {
    fontSize: 15,
    color: COLORS.textMuted,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  divider: {
    height: 1,
    backgroundColor: '#404040',
    marginVertical: 12,
  },
  button: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  mintingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
});
