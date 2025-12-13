import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors } from '../constants/colors';
import { config } from '../constants/config';
import chatService from '../services/chatService';
import socketService from '../services/socketService';
import imageService from '../services/imageService';
import { useProfileStore } from '../store/profileStore';
import { Message, RootStackParamList } from '../types';
import { format } from 'date-fns';
import { getImageUrl, getAvatarUrl } from '../utils/imageUtils';

type NavigationProp = StackNavigationProp<RootStackParamList, 'ChatDetail'>;

export default function ChatDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { chatId, userId } = route.params as { chatId: string; userId: string };
  const { profile, fetchProfile } = useProfileStore();

  useEffect(() => {
    if (!profile) {
      fetchProfile().catch(() => {});
    }
  }, [profile, fetchProfile]);

  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageHandlerRef = useRef<((newMessage: Message) => void) | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const setupSocket = async () => {
      try {
        const socket = await socketService.connect();
        if (isMounted && socket.connected) {
          socketService.joinChat(chatId);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
      }
    };
    
    setupSocket();

    const handleMessage = (newMessage: Message) => {
      if (newMessage.chatId !== chatId) {
        return;
      }
      
      queryClient.setQueryData(['chatMessages', chatId], (oldData: any) => {
        if (!oldData) {
          return {
            pages: [{
              messages: [newMessage],
              hasMore: false,
              page: 1,
            }],
            pageParams: [1],
          };
        }
        
        const allExistingMessages = oldData.pages.flatMap((page: any) => page.messages);
        
        const messageExistsById = allExistingMessages.some((msg: Message) => msg.id === newMessage.id);
        if (messageExistsById) {
          return oldData;
        }
        
        const isOwnMessage = profile && newMessage.senderId === profile.id;
        
        let messagesWithoutTemp = oldData.pages[0].messages;
        
        if (isOwnMessage) {
          messagesWithoutTemp = oldData.pages[0].messages.filter((msg: Message) => {
            if (msg.id.startsWith('temp-') && msg.senderId === newMessage.senderId) {
              const contentMatch = (msg.content || '') === (newMessage.content || '');
              const mediaMatch = (msg.mediaId || '') === (newMessage.mediaId || '');
              if (contentMatch && mediaMatch) {
                return false;
              }
            }
            return true;
          });
          
          const messageExistsByContent = messagesWithoutTemp.some((msg: Message) => {
            if (msg.senderId === newMessage.senderId && !msg.id.startsWith('temp-') && msg.id !== newMessage.id) {
              const contentMatch = (msg.content || '') === (newMessage.content || '');
              const mediaMatch = (msg.mediaId || '') === (newMessage.mediaId || '');
              const timeDiff = Math.abs(new Date(msg.createdAt).getTime() - new Date(newMessage.createdAt).getTime());
              if (contentMatch && mediaMatch && timeDiff < 15000) {
                return true;
              }
            }
            return false;
          });
          
          if (messageExistsByContent) {
            return oldData;
          }
        }
        
        const updatedMessages = [...messagesWithoutTemp, newMessage];
        
        updatedMessages.sort((a: Message, b: Message) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateA - dateB;
        });
        
        return {
          ...oldData,
          pages: [
            {
              messages: updatedMessages,
              hasMore: oldData.pages[0].hasMore,
              page: oldData.pages[0].page,
            },
            ...oldData.pages.slice(1),
          ],
        };
      });
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };
    
    if (messageHandlerRef.current) {
      socketService.offMessage(messageHandlerRef.current);
    }
    messageHandlerRef.current = handleMessage;

    const handleTypingStart = (data: any) => {
      if (data.chatId === chatId) {
        setIsTyping(true);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
        }, 3000);
      }
    };

    const handleTypingStop = (data: any) => {
      if (data.chatId === chatId) {
        setIsTyping(false);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      }
    };

    socketService.onMessage(handleMessage);
    socketService.onTypingStart(handleTypingStart);
    socketService.onTypingStop(handleTypingStop);

    return () => {
      isMounted = false;
      if (messageHandlerRef.current) {
        socketService.offMessage(messageHandlerRef.current);
        messageHandlerRef.current = null;
      }
      socketService.offTypingStart(handleTypingStart);
      socketService.offTypingStop(handleTypingStop);
    };
  }, [chatId]);

  const {
    data: messagesData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['chatMessages', chatId],
    queryFn: async ({ pageParam = 1 }) => {
      const data = await chatService.getChatMessages(chatId, pageParam, 20);
      return {
        messages: data.messages,
        hasMore: data.hasMore,
        page: data.page,
      };
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, mediaId }: { content?: string; mediaId?: string }) => {
      let socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        socket = await socketService.connect();
      }
      
      if (socket.connected) {
        socketService.joinChat(chatId);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!profile) {
        throw new Error('No se pudo identificar tu perfil. Por favor, intenta de nuevo.');
      }
      
      socketService.sendMessage(chatId, content || '', mediaId);
      return { success: true };
    },
    onMutate: async ({ content, mediaId }) => {
      if (!profile) return;
      
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        chatId,
        senderId: profile.id,
        content: content || undefined,
        mediaId: mediaId || undefined,
        read: false,
        createdAt: new Date().toISOString(),
        sender: profile,
        media: mediaId ? { id: mediaId, url: '', type: 'message' as const, mimeType: '', createdAt: new Date().toISOString() } : undefined,
      };
      
      queryClient.setQueryData(['chatMessages', chatId], (oldData: any) => {
        if (!oldData) {
          return {
            pages: [{
              messages: [tempMessage],
              hasMore: false,
              page: 1,
            }],
            pageParams: [1],
          };
        }
        
        const updatedMessages = [...oldData.pages[0].messages, tempMessage];
        updatedMessages.sort((a: Message, b: Message) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateA - dateB;
        });
        
        return {
          ...oldData,
          pages: [
            {
              messages: updatedMessages,
              hasMore: oldData.pages[0].hasMore,
              page: oldData.pages[0].page,
            },
            ...oldData.pages.slice(1),
          ],
        };
      });
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    onSuccess: () => {
      setMessage('');
      socketService.stopTyping(chatId);
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: ['chatMessages', chatId] });
      Alert.alert('Error', error.response?.data?.error || 'Error al enviar mensaje');
    },
  });

  const handleSendImage = async () => {
    try {
      setIsUploadingImage(true);
      const uri = await imageService.takePhoto();
      if (uri) {
        await sendImageToChat(uri);
      }
    } catch (error: any) {
      if (error.message !== 'User canceled image picker') {
        Alert.alert('Error', error.message || 'Error al tomar foto');
      }
    } finally {
      setIsUploadingImage(false);
    }
  };

  const sendImageToChat = async (imageUri: string) => {
    try {
      const healthCheck = await fetch(`${config.apiUrl}/health`, {
        method: 'GET',
      });
      if (!healthCheck.ok) {
        throw new Error('Backend no responde correctamente');
      }
    } catch (healthError: any) {
      Alert.alert(
        'Error de conexión',
        `No se puede conectar al backend (${config.apiUrl}). Verifica que el backend esté corriendo.`
      );
      throw healthError;
    }
    
    const uploadResult = await imageService.uploadImage(imageUri, 'message');
    await sendMessageMutation.mutateAsync({ mediaId: uploadResult.id });
  };

  const handleSend = () => {
    if (!message.trim()) return;
    
    sendMessageMutation.mutate({ content: message.trim() });
    socketService.stopTyping(chatId);
  };

  const handleTyping = (text: string) => {
    setMessage(text);
    
    if (text.length > 0) {
      socketService.startTyping(chatId);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        socketService.stopTyping(chatId);
      }, 1000);
    } else {
      socketService.stopTyping(chatId);
    }
  };

  const allMessages = React.useMemo(() => {
    if (!messagesData?.pages) return [];
    
    const messages = messagesData.pages.flatMap((page) => page.messages);
    
    const uniqueMessages = Array.from(
      new Map(messages.map((msg: Message) => [msg.id, msg])).values()
    );
    
    return uniqueMessages.sort((a: Message, b: Message) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateA - dateB;
    });
  }, [messagesData]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwn = profile && item.senderId === profile.id;
    
    const prevMessage = index > 0 ? allMessages[index - 1] : null;
    const showAvatar = !prevMessage || prevMessage.senderId !== item.senderId;
    const showTime = true;

    let imageUrl: string | null = null;
    if (item.media?.url) {
      imageUrl = getImageUrl(item.media.url);
    } else if (item.mediaId) {
      imageUrl = `${config.apiUrl}/uploads/messages/${item.mediaId}`;
    }


    return (
      <View
        style={[
          styles.messageContainer,
          isOwn ? styles.ownMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {!isOwn && showAvatar && (
          <Image
            source={{
              uri: getAvatarUrl(item.sender?.avatarUrl),
            }}
            style={styles.messageAvatar}
          />
        )}
        <View
          style={[
            styles.messageBubble,
            isOwn ? styles.ownMessageBubble : styles.otherMessageBubble,
          ]}
        >
          {!isOwn && (
            <Text style={styles.messageSenderName}>
              {item.sender?.firstName} {item.sender?.lastName}
            </Text>
          )}
          {imageUrl && (
            <Image
              source={{ uri: imageUrl }}
              style={styles.messageImage}
              resizeMode="cover"
              onError={() => {}}
            />
          )}
          {item.content && (
            <Text
              style={[
                styles.messageText,
                isOwn ? styles.ownMessageText : styles.otherMessageText,
                imageUrl ? { marginTop: 8 } : {},
              ]}
            >
              {item.content}
            </Text>
          )}
          {!imageUrl && (item.media || item.mediaId) && !item.content && (
            <Text
              style={[
                styles.messageText,
                isOwn ? styles.ownMessageText : styles.otherMessageText,
                { fontStyle: 'italic', opacity: 0.7 },
              ]}
            >
              Imagen
            </Text>
          )}
          {showTime && (
            <Text
              style={[
                styles.messageTime,
                isOwn ? styles.ownMessageTime : styles.otherMessageTime,
              ]}
            >
              {format(new Date(item.createdAt), 'HH:mm')}
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (isLoading && allMessages.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chat</Text>
        </View>
        {isTyping && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>Escribiendo...</Text>
          </View>
        )}
        <FlatList
          ref={flatListRef}
          data={allMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          inverted={false}
          onContentSizeChange={() => {
            if (allMessages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : null
          }
        />

        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.imageButton}
            onPress={handleSendImage}
            disabled={isUploadingImage || sendMessageMutation.isPending}
          >
            {isUploadingImage ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.imageButtonText}>📷</Text>
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={colors.grayDark}
            value={message}
            onChangeText={handleTyping}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!message.trim() || sendMessageMutation.isPending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!message.trim() || sendMessageMutation.isPending}
          >
            {sendMessageMutation.isPending ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.sendButtonText}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  backButtonText: {
    fontSize: 24,
    color: colors.primary,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.black,
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  typingText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.grayDark,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: colors.grayLight,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  ownMessageBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
  },
  messageSenderName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: colors.white,
  },
  otherMessageText: {
    color: colors.black,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  ownMessageTime: {
    color: colors.white,
    opacity: 0.8,
  },
  otherMessageTime: {
    color: colors.grayDark,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.grayLight,
    alignItems: 'flex-end',
  },
  imageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  imageButtonText: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.grayLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.black,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
});

