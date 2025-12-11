import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  Animated as RNAnimated,
  PanResponder,
} from 'react-native';
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
  const [pan] = useState(new RNAnimated.ValueXY());
  const [opacity] = useState(new RNAnimated.Value(1));

  // Resetear posición y opacidad cuando cambia el perfil
  React.useEffect(() => {
    pan.setValue({ x: 0, y: 0 });
    opacity.setValue(1);
  }, [profile.id, pan, opacity]);

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

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (evt, gestureState) => {
      pan.setValue({ x: gestureState.dx, y: gestureState.dy * 0.3 });
      
      // Opacidad basada en movimiento
      const absX = Math.abs(gestureState.dx);
      const opacityValue = 1 - absX / 500;
      opacity.setValue(Math.max(0.5, opacityValue));
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (Math.abs(gestureState.dx) > SWIPE_THRESHOLD) {
        // Swipe detectado
        if (gestureState.dx > 0) {
          // Swipe derecha (like)
          RNAnimated.parallel([
            RNAnimated.timing(pan, {
              toValue: { x: SCREEN_WIDTH * 2, y: gestureState.dy },
              duration: 300,
              useNativeDriver: false,
            }),
            RNAnimated.timing(opacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: false,
            }),
          ]).start(() => {
            onSwipeRight();
          });
        } else {
          // Swipe izquierda (dislike)
          RNAnimated.parallel([
            RNAnimated.timing(pan, {
              toValue: { x: -SCREEN_WIDTH * 2, y: gestureState.dy },
              duration: 300,
              useNativeDriver: false,
            }),
            RNAnimated.timing(opacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: false,
            }),
          ]).start(() => {
            onSwipeLeft();
          });
        }
      } else {
        // Volver a posición inicial
        RNAnimated.parallel([
          RNAnimated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }),
          RNAnimated.spring(opacity, {
            toValue: 1,
            useNativeDriver: false,
          }),
        ]).start();
      }
    },
  });

  const rotation = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const animatedStyle = {
    transform: [
      { translateX: pan.x },
      { translateY: pan.y },
      { rotate: rotation },
    ],
    opacity,
  };

  const leftOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -50, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  const rightOpacity = pan.x.interpolate({
    inputRange: [0, 50, SWIPE_THRESHOLD],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  return (
    <RNAnimated.View
      style={[styles.card, animatedStyle]}
      {...panResponder.panHandlers}
    >
      {/* Overlay de dislike (izquierda) */}
      <RNAnimated.View
        style={[
          styles.overlay,
          styles.dislikeOverlay,
          { opacity: leftOpacity },
        ]}
      >
        <Text style={styles.overlayText}>RECHAZAR</Text>
      </RNAnimated.View>

      {/* Overlay de like (derecha) */}
      <RNAnimated.View
        style={[
          styles.overlay,
          styles.likeOverlay,
          { opacity: rightOpacity },
        ]}
      >
        <Text style={styles.overlayText}>ACEPTAR</Text>
      </RNAnimated.View>

      {/* Imagen de perfil */}
      <Image
        source={{
          uri: getAvatarUrl(profile.avatarUrl),
        }}
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
    </RNAnimated.View>
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

