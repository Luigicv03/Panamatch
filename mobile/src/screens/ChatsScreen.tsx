import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../types';
import { colors } from '../constants/colors';

type NavigationProp = StackNavigationProp<RootStackParamList, 'ChatDetail'>;
import chatService from '../services/chatService';
import socketService from '../services/socketService';
import { format } from 'date-fns';
import { getAvatarUrl } from '../utils/imageUtils';

interface ChatItem {
  id: string;
  otherUser: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    createdAt: string;
    read: boolean;
  } | null;
  lastMessageAt?: string;
  createdAt: string;
  unreadCount: number;
}

export default function ChatsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    socketService.connect();

    socketService.onChatUpdated(() => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    });

    return () => {
    };
  }, []);

  const { data: chats, isLoading, refetch } = useQuery({
    queryKey: ['chats'],
    queryFn: () => chatService.getChats(),
    refetchInterval: 30000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatTime = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 24) {
        return format(date, 'HH:mm');
      } else if (diffInHours < 168) {
        return format(date, 'EEE');
      } else {
        return format(date, 'dd/MM/yyyy');
      }
    } catch {
      return '';
    }
  };

  const renderChatItem = ({ item }: { item: ChatItem }) => {
    const handlePress = () => {
      navigation.navigate('ChatDetail', {
        chatId: item.id,
        userId: item.otherUser.id,
      });
    };

    return (
      <TouchableOpacity style={styles.chatItem} onPress={handlePress}>
        <Image
          source={{
            uri: getAvatarUrl(item.otherUser.avatarUrl),
          }}
          style={styles.avatar}
        />
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName}>
              {item.otherUser.firstName} {item.otherUser.lastName}
            </Text>
            {item.lastMessageAt && (
              <Text style={styles.chatTime}>
                {formatTime(item.lastMessageAt)}
              </Text>
            )}
          </View>
          {item.lastMessage ? (
            <View style={styles.chatMessageContainer}>
              <Text style={styles.chatMessage} numberOfLines={1}>
                {item.lastMessage.senderId === item.otherUser.id
                  ? `${item.lastMessage.senderName}: `
                  : 'Tú: '}
                {item.lastMessage.content || 'Imagen'}
              </Text>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.emptyMessage}>No hay mensajes aún</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!chats || chats.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <Text style={styles.headerTitle}>Chats</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No tienes chats aún</Text>
          <Text style={styles.emptySubtext}>
            ¡Empieza a hacer match para chatear!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.headerTitle}>Chats</Text>
      </View>
      <FlatList
        data={chats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
    backgroundColor: colors.white,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.black,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: colors.grayDark,
    textAlign: 'center',
  },
  listContent: {
    paddingVertical: 8,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
    backgroundColor: colors.white,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    backgroundColor: colors.grayLight,
  },
  chatContent: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.black,
  },
  chatTime: {
    fontSize: 12,
    color: colors.grayDark,
  },
  chatMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatMessage: {
    fontSize: 14,
    color: colors.grayDark,
    flex: 1,
    marginRight: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: colors.grayDark,
    fontStyle: 'italic',
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.white,
  },
});
