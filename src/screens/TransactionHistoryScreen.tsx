import React, { useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTxHistoryStore, type LabeledTransaction } from '../store/txHistoryStore';
import { useWalletStore } from '../store/walletStore';
import { getSolscanTxUrl, getSolscanAddressUrl } from '../lib/solanaClient';

function formatTime(ts: number | null) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() / 1000) - ts);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function TxRow({ tx }: { tx: LabeledTransaction }) {
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(getSolscanTxUrl(tx.signature))}
      activeOpacity={0.7}
      className="flex-row items-center py-4 px-5 border-b border-gray-100 bg-white"
    >
      <View className={`w-9 h-9 rounded-full items-center justify-center ${tx.err ? 'bg-red-100' : 'bg-pet-blue-light/40'}`}>
        <MaterialCommunityIcons
          name={tx.err ? 'close-circle-outline' : 'check-circle-outline'}
          size={20}
          color={tx.err ? '#dc2626' : '#3792A6'}
        />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-[13px] font-bold text-gray-800" numberOfLines={1}>{tx.label}</Text>
        <Text className="text-[11px] text-gray-400 font-medium mt-0.5">
          {tx.signature.slice(0, 12)}...{tx.signature.slice(-8)}
        </Text>
        {tx.memo && (
          <Text className="text-[10px] text-pet-blue font-semibold mt-1" numberOfLines={1}>
            {'\u{1F4DD}'} {tx.memo}
          </Text>
        )}
      </View>
      <View className="items-end ml-2">
        <Text className="text-[11px] text-gray-400 font-semibold">{formatTime(tx.timestamp)}</Text>
        <View className="flex-row items-center mt-1">
          <Text className={`text-[10px] font-bold ${tx.err ? 'text-red-400' : 'text-green-500'}`}>
            {tx.err ? 'Failed' : 'Success'}
          </Text>
          <MaterialCommunityIcons name="open-in-new" size={11} color="#9ca3af" style={{ marginLeft: 4 }} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function TransactionHistoryScreen({ onBack }: { onBack: () => void }) {
  const { transactions, isLoading, fetchHistory } = useTxHistoryStore();
  const address = useWalletStore((s) => s.address);

  useEffect(() => {
    if (address) fetchHistory(address);
  }, [address, fetchHistory]);

  const handleRefresh = useCallback(() => {
    if (address) fetchHistory(address);
  }, [address, fetchHistory]);

  const successCount = transactions.filter((t) => !t.err).length;
  const failCount = transactions.filter((t) => t.err).length;

  return (
    <View className="flex-1 bg-pet-background">
      <LinearGradient
        colors={['#EFF7FF', '#E8F3FD', '#F5FAFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />

      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity onPress={onBack} activeOpacity={0.7} className="flex-row items-center">
            <MaterialCommunityIcons name="chevron-left" size={24} color="#2D6B90" />
            <Text className="text-pet-blue-dark font-bold text-[14px] ml-1">Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => address && Linking.openURL(getSolscanAddressUrl(address))}
            activeOpacity={0.7}
            className="flex-row items-center"
          >
            <Text className="text-[11px] font-bold text-pet-blue mr-1">Solscan</Text>
            <MaterialCommunityIcons name="open-in-new" size={12} color="#4FABC9" />
          </TouchableOpacity>
        </View>

        <Text className="text-[22px] font-black text-gray-800">{'\u{1F4DC}'} Transactions</Text>
        <Text className="text-[12px] text-gray-400 font-semibold mt-1">
          All on-chain activity for your wallet
        </Text>

        {/* Summary pills */}
        <View className="flex-row mt-3" style={{ gap: 8 }}>
          <View className="bg-white px-3 py-1.5 rounded-full border border-gray-100">
            <Text className="text-[11px] font-black text-gray-600">{transactions.length} Total</Text>
          </View>
          <View className="bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
            <Text className="text-[11px] font-black text-green-600">{successCount} Success</Text>
          </View>
          {failCount > 0 && (
            <View className="bg-red-50 px-3 py-1.5 rounded-full border border-red-200">
              <Text className="text-[11px] font-black text-red-500">{failCount} Failed</Text>
            </View>
          )}
        </View>
      </View>

      {/* Transaction list */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.signature}
        renderItem={({ item }) => <TxRow tx={item} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor="#3792A6" />
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="py-20 items-center">
              <ActivityIndicator size="large" color="#3792A6" />
              <Text className="text-[12px] text-gray-400 mt-3 font-semibold">Loading from Solana...</Text>
            </View>
          ) : (
            <View className="py-20 items-center">
              <Text className="text-[40px] mb-3">{'\u{1F4AD}'}</Text>
              <Text className="text-[14px] font-bold text-gray-400">No transactions yet</Text>
              <Text className="text-[12px] text-gray-300 font-semibold mt-1">
                Interact with your pet to create on-chain activity
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}
