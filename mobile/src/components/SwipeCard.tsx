import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import { Profile } from '../types';
import { colors } from '../constants/colors';
import { getAvatarUrl } from '../utils/imageUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const SWIPE_THRESHOLD = 120;

interface SwipeCardProps {
  profile: Profile;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp?: () => void;
}

export default function SwipeCard({
  profile,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
}: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const calculateAge = (dateOfBirth: string): number => {
    const birth = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(profile.dateOfBirth);

  const animatedStyle = useAnimatedStyle(() => {
    const rotation = (translateX.value / CARD_WIDTH) * 10;
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotateZ: `${rotation}deg` },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  const leftOverlayStyle = useAnimatedStyle(() => {
    const opacityValue = translateX.value < -50 ? Math.abs(translateX.value) / SWIPE_THRESHOLD : 0;
    return {
      opacity: opacityValue,
    };
  });

  const rightOverlayStyle = useAnimatedStyle(() => {
    const opacityValue = translateX.value > 50 ? translateX.value / SWIPE_THRESHOLD : 0;
    return {
      opacity: opacityValue,
    };
  });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.3;
      scale.value = 1 - Math.abs(event.translationX) / 1000;

      // Opacidad de overlay
      if (event.translationX < -50) {
        opacity.value = 0.95;
      } else if (event.translationX > 50) {
        opacity.value = 0.95;
      } else {
        opacity.value = 1;
      }
    })
    .onEnd((event) => {
      if (event.translationX < -SWIPE_THRESHOLD) {
        // Swipe izquierda (dislike)
        translateX.value = withSpring(-SCREEN_WIDTH * 2);
        opacity.value = withSpring(0);
        runOnJS(onSwipeLeft)();
      } else if (event.translationX > SWIPE_THRESHOLD) {
        // Swipe derecha (like)
        translateX.value = withSpring(SCREEN_WIDTH * 2);
        opacity.value = withSpring(0);
        runOnJS(onSwipeRight)();
      } else if (event.translationY < -SWIPE_THRESHOLD && onSwipeUp) {
        // Swipe arriba
        translateY.value = withSpring(-SCREEN_WIDTH * 2);
        opacity.value = withSpring(0);
        runOnJS(onSwipeUp)();
      } else {
        // Volver a posición inicial
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
        opacity.value = withSpring(1);
      }
    });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {/* Overlay de dislike (izquierda) */}
        <Animated.View style={[styles.overlay, styles.dislikeOverlay, leftOverlayStyle]}>
          <Text style={styles.overlayText}>RECHAZAR</Text>
        </Animated.View>

        {/* Overlay de like (derecha) */}
        <Animated.View style={[styles.overlay, styles.likeOverlay, rightOverlayStyle]}>
          <Text style={styles.overlayText}>ACEPTAR</Text>
        </Animated.View>

        {/* Imagen de perfil */}
        <Image
          source={{ uri: getAvatarUrl(profile.avatarUrl) }}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Información del perfil */}
        <View style={styles.infoContainer}>
          <View style={styles.nameContainer}>
            <Text style={styles.name}>
              {profile.firstName} {profile.lastName}
            </Text>
            <Text style={styles.age}>{age}</Text>
          </View>
          <Text style={styles.city}>{profile.city}</Text>
          {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          {profile.interests && profile.interests.length > 0 && (
            <View style={styles.interestsContainer}>
              {profile.interests.slice(0, 3).map((interest) => (
                <View key={interest.id} style={styles.interestChip}>
                  <Text style={styles.interestText}>{interest.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: '80%',
    borderRadius: 24,
    backgroundColor: colors.white,
    position: 'absolute',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 4,
  },
  dislikeOverlay: {
    backgroundColor: 'rgba(230, 57, 70, 0.8)',
    borderColor: colors.dislike,
  },
  likeOverlay: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    borderColor: colors.like,
  },
  overlayText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.white,
  },
  image: {
    width: '100%',
    height: '75%',
  },
  infoContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
    marginRight: 8,
  },
  age: {
    fontSize: 24,
    color: colors.white,
    fontWeight: '600',
  },
  city: {
    fontSize: 16,
    color: colors.white,
    marginBottom: 8,
    opacity: 0.9,
  },
  bio: {
    fontSize: 14,
    color: colors.white,
    marginBottom: 12,
    opacity: 0.9,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestText: {
    fontSize: 12,
    color: colors.white,
    fontWeight: '600',
  },
});

