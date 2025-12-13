import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  Vibration,
} from 'react-native';
import { colors } from '../constants/colors';
import { Match } from '../types';
import { getAvatarUrl } from '../utils/imageUtils';

interface MatchScreenProps {
  visible: boolean;
  match: Match | null;
  onClose: () => void;
  onGoToChat: () => void;
}

export default function MatchScreen({
  visible,
  match,
  onClose,
  onGoToChat,
}: MatchScreenProps) {
  const scaleAnim = new Animated.Value(0);
  const opacityAnim = new Animated.Value(0);

  useEffect(() => {
    if (visible && match) {
      // Vibración al hacer match
      Vibration.vibrate([200, 100, 200]);

      // Animación de entrada
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible, match]);

  if (!match) return null;

  const otherUser = match.user1 || match.user2;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={styles.title}>¡Hiciste un match!</Text>
          <Text style={styles.subtitle}>
            Ahora pueden chatear
          </Text>

          <View style={styles.imagesContainer}>
            <Image
              source={{
                uri: getAvatarUrl(otherUser?.avatarUrl),
              }}
              style={styles.avatar}
            />
            <View style={styles.heart}>
              <Text style={styles.heartEmoji}>❤️</Text>
            </View>
          </View>

          <Text style={styles.name}>
            {otherUser?.firstName} {otherUser?.lastName}
          </Text>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity style={styles.chatButton} onPress={onGoToChat}>
              <Text style={styles.chatButtonText}>Enviar Mensaje</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.continueButton} onPress={onClose}>
              <Text style={styles.continueButtonText}>Seguir Navegando</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: colors.grayDark,
    marginBottom: 32,
    textAlign: 'center',
  },
  imagesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: colors.primary,
  },
  heart: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartEmoji: {
    fontSize: 60,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 32,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  chatButton: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  chatButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  continueButton: {
    backgroundColor: colors.white,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  continueButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

