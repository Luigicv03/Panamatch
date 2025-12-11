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

  // Asegurar que el perfil esté cargado
  useEffect(() => {
    if (!profile) {
      console.log('Profile no disponible, intentando cargar...');
      fetchProfile().catch((error) => {
        console.error('Error al cargar perfil en ChatDetailScreen:', error);
      });
    }
  }, [profile, fetchProfile]);

  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Conectar socket y unirse al chat
  useEffect(() => {
    // Asegurar que el socket está conectado con el token actual
    socketService.connect().then(() => {
      socketService.joinChat(chatId);
    }).catch((error) => {
      console.error('Error al conectar socket:', error);
    });

    // Escuchar mensajes nuevos
    const handleMessage = (newMessage: Message) => {
      console.log('📩 Nuevo mensaje recibido por Socket:', {
        messageId: newMessage.id,
        senderId: newMessage.senderId,
        hasMedia: !!newMessage.media,
        mediaId: newMessage.mediaId,
        mediaUrl: newMessage.media?.url,
        content: newMessage.content,
        fullMessage: newMessage,
      });
      
      queryClient.setQueryData(['chatMessages', chatId], (oldData: any) => {
        if (!oldData) return oldData;
        
        // Verificar si el mensaje ya existe para evitar duplicados
        const allExistingMessages = oldData.pages.flatMap((page: any) => page.messages);
        const messageExists = allExistingMessages.some((msg: Message) => msg.id === newMessage.id);
        if (messageExists) {
          console.log('⚠️ Mensaje ya existe, ignorando duplicado:', newMessage.id);
          return oldData; // No agregar si ya existe
        }
        
        // Agregar el nuevo mensaje al inicio de la primera página (mensajes más recientes)
        // Los mensajes deben estar ordenados cronológicamente (más antiguos primero)
        const updatedMessages = [...oldData.pages[0].messages, newMessage];
        
        // Ordenar por fecha (más antiguos primero)
        updatedMessages.sort((a: Message, b: Message) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateA - dateB;
        });
        
        console.log('✅ Mensaje agregado a la lista. Total mensajes:', updatedMessages.length);
        
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
      
      // Scroll al final
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };

    // Escuchar indicador de escritura
    const handleTypingStart = () => {
      setIsTyping(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
      }, 3000);
    };

    const handleTypingStop = () => {
      setIsTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };

    socketService.onMessage(handleMessage);
    socketService.onTypingStart(handleTypingStart);
    socketService.onTypingStop(handleTypingStop);

    return () => {
      socketService.offMessage(handleMessage);
      socketService.leaveChat(chatId);
    };
  }, [chatId]);

  // Obtener mensajes
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

  // Mutación para enviar mensaje
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, mediaId }: { content?: string; mediaId?: string }) => {
      // Verificar que el socket esté conectado
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        console.warn('Socket no conectado, intentando reconectar...');
        await socketService.connect();
      }
      
      // Verificar que tenemos el perfil del usuario actual
      if (!profile) {
        throw new Error('No se pudo identificar tu perfil. Por favor, intenta de nuevo.');
      }
      
      // Log para debugging
      console.log('Enviando mensaje:', {
        chatId,
        senderId: profile.id,
        senderName: `${profile.firstName} ${profile.lastName}`,
        hasContent: !!content,
        hasMedia: !!mediaId,
      });
      
      // Enviar SOLO por WebSocket (el backend manejará la persistencia)
      socketService.sendMessage(chatId, content || '', mediaId);
      // No usar REST para evitar duplicados
      // El mensaje será recibido por Socket.IO cuando el backend lo procese
      return { success: true };
    },
    onSuccess: () => {
      setMessage('');
      socketService.stopTyping(chatId);
      // Invalidar lista de chats
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error || 'Error al enviar mensaje');
    },
  });

  // Función para enviar imagen
  const handleSendImage = async () => {
    try {
      setIsUploadingImage(true);
      
      // Permitir elegir entre galería o cámara
      Alert.alert(
        'Enviar Imagen',
        '¿Cómo quieres enviar la imagen?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Galería',
            onPress: async () => {
              try {
                const uri = await imageService.pickImageFromLibrary();
                if (uri) {
                  await sendImageToChat(uri);
                }
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Error al seleccionar imagen');
              } finally {
                setIsUploadingImage(false);
              }
            },
          },
          {
            text: 'Cámara',
            onPress: async () => {
              try {
                const uri = await imageService.takePhoto();
                if (uri) {
                  await sendImageToChat(uri);
                }
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Error al tomar foto');
              } finally {
                setIsUploadingImage(false);
              }
            },
          },
        ],
        { cancelable: true }
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al enviar imagen');
      setIsUploadingImage(false);
    }
  };

  // Función auxiliar para enviar imagen al chat
  const sendImageToChat = async (imageUri: string) => {
    try {
      console.log('Iniciando subida de imagen para chat...', { chatId, imageUri: imageUri.substring(0, 50) + '...' });
      
      // Verificar conectividad del backend antes de intentar subir
      try {
        const healthCheck = await fetch(`${config.apiUrl}/health`, {
          method: 'GET',
        });
        if (!healthCheck.ok) {
          throw new Error('Backend no responde correctamente');
        }
        console.log('Backend está accesible');
      } catch (healthError: any) {
        console.error('Backend no accesible:', healthError);
        Alert.alert(
          'Error de conexión',
          `No se puede conectar al backend (${config.apiUrl}). ` +
          `Verifica que el backend esté corriendo en el puerto 3000 y accesible desde tu red.`
        );
        setIsUploadingImage(false);
        return;
      }
      
      // Subir imagen
      const uploadResult = await imageService.uploadImage(imageUri, 'message');
      console.log('Imagen subida exitosamente:', uploadResult);
      
      // Enviar mensaje con mediaId
      sendMessageMutation.mutate({ mediaId: uploadResult.id });
      
      // El setIsUploadingImage se manejará en el finally del handleSendImage
    } catch (error: any) {
      console.error('Error al subir imagen en chat:', error);
      
      // Determinar el tipo de error y mostrar mensaje apropiado
      let errorMessage = 'Error al subir imagen';
      
      if (error.isNetworkError || error.code === 'ERR_NETWORK' || error.message?.includes('Network')) {
        errorMessage = `Error de conexión. Backend: ${config.apiUrl}. ` +
          `Verifica que el backend esté corriendo en el puerto 3000 y accesible desde tu red.`;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      Alert.alert('Error al subir imagen', errorMessage);
      setIsUploadingImage(false);
      throw error;
    }
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

  // Formatear todos los mensajes y ordenarlos por fecha (más antiguos primero)
  const allMessages = React.useMemo(() => {
    if (!messagesData?.pages) return [];
    
    const messages = messagesData.pages.flatMap((page) => page.messages);
    
    // Eliminar duplicados por ID
    const uniqueMessages = Array.from(
      new Map(messages.map((msg: Message) => [msg.id, msg])).values()
    );
    
    // Log para debugging - verificar mensajes con media
    const messagesWithMedia = uniqueMessages.filter((msg: Message) => msg.media || msg.mediaId);
    if (messagesWithMedia.length > 0) {
      console.log('📋 Mensajes con media encontrados:', messagesWithMedia.map((msg: Message) => ({
        id: msg.id,
        hasMedia: !!msg.media,
        mediaId: msg.mediaId,
        mediaUrl: msg.media?.url,
        mediaObject: msg.media,
      })));
    }
    
    // Ordenar por fecha de creación (más antiguos primero)
    return uniqueMessages.sort((a: Message, b: Message) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateA - dateB;
    });
  }, [messagesData]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    // CRÍTICO: Verificar que el profile existe y comparar correctamente
    if (!profile) {
      console.warn('Profile no disponible para renderizar mensaje');
    }
    
    // Comparar senderId con profile.id (el perfil del usuario actual)
    const isOwn = profile && item.senderId === profile.id;
    
    // Log detallado para debugging - especialmente para mensajes con media
    if (item.media || item.mediaId) {
      console.log('🖼️ Renderizando mensaje CON IMAGEN:', {
        messageId: item.id,
        senderId: item.senderId,
        profileId: profile?.id,
        isOwn,
        hasMedia: !!item.media,
        mediaId: item.mediaId,
        mediaObject: item.media,
        mediaUrl: item.media?.url,
        content: item.content,
        fullItem: JSON.stringify(item, null, 2),
      });
    }
    
    const prevMessage = index > 0 ? allMessages[index - 1] : null;
    const showAvatar = !prevMessage || prevMessage.senderId !== item.senderId;
    const showTime = !prevMessage || 
      new Date(item.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() > 60000;

    // Determinar la URL de la imagen
    let imageUrl: string | null = null;
    if (item.media?.url) {
      imageUrl = getImageUrl(item.media.url);
    } else if (item.mediaId) {
      // Fallback: construir URL desde mediaId
      imageUrl = `${config.apiUrl}/uploads/messages/${item.mediaId}`;
    }

    console.log('📸 URL de imagen determinada:', {
      messageId: item.id,
      imageUrl,
      hasMediaObject: !!item.media,
      mediaUrl: item.media?.url,
      mediaId: item.mediaId,
    });

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
          {/* Renderizar imagen si existe */}
          {imageUrl && (
            <Image
              source={{ uri: imageUrl }}
              style={styles.messageImage}
              resizeMode="cover"
              onError={(error) => {
                console.error('❌ Error al cargar imagen del mensaje:', {
                  messageId: item.id,
                  mediaId: item.mediaId,
                  imageUrl,
                  error: error.nativeEvent?.error || error.nativeEvent,
                  errorType: typeof error.nativeEvent,
                  mediaObject: item.media,
                  apiUrl: config.apiUrl,
                });
              }}
              onLoad={() => {
                console.log('✅ Imagen del mensaje cargada correctamente:', {
                  messageId: item.id,
                  imageUrl,
                });
              }}
            />
          )}
          {/* Renderizar contenido de texto si existe */}
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
          {/* Mostrar placeholder si hay mediaId pero no se pudo cargar la imagen */}
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chat</Text>
        </View>

        {/* Indicador de escritura */}
        {isTyping && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>Escribiendo...</Text>
          </View>
        )}

        {/* Lista de mensajes */}
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

        {/* Barra de entrada */}
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

