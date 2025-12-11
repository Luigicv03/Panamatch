import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SwipeCard from '../components/SwipeCardSimple';
import MatchScreen from './MatchScreen';
import swipeService from '../services/swipeService';
import { Profile, Match } from '../types';
import { colors } from '../constants/colors';
import { useProfileStore } from '../store/profileStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';

type NavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const queryClient = useQueryClient();
  const { profile, fetchProfile, isLoading: isLoadingProfile, profileNotFound } = useProfileStore();
  const [profileLoadAttempted, setProfileLoadAttempted] = useState(false);

  // Cargar perfil si no existe (solo una vez)
  useEffect(() => {
    if (!profile && !profileLoadAttempted && !isLoadingProfile) {
      setProfileLoadAttempted(true);
      fetchProfile().catch((err: any) => {
        console.error('Error al cargar perfil:', err);
        // El error ya fue manejado en el store
      });
    }
  }, [profile, profileLoadAttempted, isLoadingProfile, fetchProfile]);

  // Obtener candidatos
  const { data, isLoading, refetch, error: candidatesError } = useQuery({
    queryKey: ['swipeCandidates'],
    queryFn: async () => {
      try {
        const candidates = await swipeService.getCandidates();
        return candidates || [];
      } catch (err: any) {
        console.error('Error al obtener candidatos:', err);
        throw err;
      }
    },
    enabled: !!profile,
    retry: 1,
  });

  useEffect(() => {
    if (data) {
      setCandidates(data);
      setCurrentIndex(0);
    }
  }, [data]);

  // Asegurar que el índice siempre esté dentro del rango de candidatos
  useEffect(() => {
    if (candidates.length === 0) {
      setCurrentIndex(0);
      return;
    }
    if (currentIndex >= candidates.length) {
      setCurrentIndex(0);
    }
  }, [candidates, currentIndex]);

  // Mutación para dar like
  const likeMutation = useMutation({
    mutationFn: (profileId: string) => swipeService.likeCandidate(profileId),
    onSuccess: (response) => {
      if (response.match) {
        setCurrentMatch(response.match);
        setShowMatchModal(true);
      }
      // Remover candidato actual
      const newCandidates = candidates.filter((p) => p.id !== candidates[currentIndex]?.id);
      setCandidates(newCandidates);
      setCurrentIndex(0); // Resetear índice
      if (newCandidates.length === 0) {
        // Cargar más candidatos si no hay más
        refetch();
      }
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error || 'Error al dar like');
    },
  });

  // Mutación para dar dislike
  const dislikeMutation = useMutation({
    mutationFn: (profileId: string) => swipeService.dislikeCandidate(profileId),
    onSuccess: () => {
      // Remover candidato actual
      const newCandidates = candidates.filter((p) => p.id !== candidates[currentIndex]?.id);
      setCandidates(newCandidates);
      setCurrentIndex(0); // Resetear índice
      if (newCandidates.length === 0) {
        // Cargar más candidatos si no hay más
        refetch();
      }
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error || 'Error al rechazar');
    },
  });

  const handleSwipeLeft = () => {
    if (candidates[currentIndex]) {
      dislikeMutation.mutate(candidates[currentIndex].id);
    }
  };

  const handleSwipeRight = () => {
    if (candidates[currentIndex]) {
      likeMutation.mutate(candidates[currentIndex].id);
    }
  };

  // Nuevo: pasar/omitir sin rechazar (ciclo infinito hasta que se rechace)
  const handleSwipeUp = () => {
    if (candidates.length === 0) return;
    // avanzar al siguiente candidato en modo circular
    setCurrentIndex((prev) => (prev + 1) % candidates.length);
  };

  const handleButtonLike = () => {
    if (candidates[currentIndex]) {
      handleSwipeRight();
    }
  };

  const handleButtonDislike = () => {
    if (candidates[currentIndex]) {
      handleSwipeLeft();
    }
  };

  const handleMatchClose = () => {
    setShowMatchModal(false);
    setCurrentMatch(null);
  };

  const handleGoToChat = () => {
    setShowMatchModal(false);
    if (currentMatch?.chat) {
      if (currentMatch.chat) {
        navigation.navigate('ChatDetail', {
          chatId: currentMatch.chat.id,
          userId: currentMatch.user1?.id === profile?.id
            ? currentMatch.user2?.id || ''
            : currentMatch.user1?.id || '',
        });
      }
    }
  };

  // Redirigir a Profile si el perfil no existe
  useEffect(() => {
    if (profileNotFound && !profile) {
      navigation.navigate('Profile');
    }
  }, [profileNotFound, profile, navigation]);

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          {isLoadingProfile ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Cargando perfil...</Text>
            </>
          ) : profileNotFound ? (
            <>
              <Text style={[styles.loadingText, { color: colors.dislike, marginBottom: 16, textAlign: 'center' }]}>
                No tienes un perfil aún.
              </Text>
              <Text style={[styles.loadingText, { marginBottom: 16, textAlign: 'center' }]}>
                Ve a la pestaña "Perfil" para completar tu registro.
              </Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Cargando perfil...</Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando candidatos...</Text>
          {candidatesError && (
            <Text style={[styles.loadingText, { color: colors.dislike, marginTop: 8 }]}>
              Error: {candidatesError instanceof Error ? candidatesError.message : 'Error desconocido'}
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (candidates.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay más candidatos</Text>
          <Text style={styles.emptySubtext}>
            Vuelve más tarde para ver nuevos perfiles
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={() => refetch()}>
            <Text style={styles.refreshButtonText}>Actualizar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentCandidate = candidates[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.headerTitle}>PanaMatch</Text>
      </View>

      <View style={styles.cardsContainer}>
        {currentCandidate && (
          <SwipeCard
            key={currentCandidate.id}
            profile={currentCandidate}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
            onSwipeUp={handleSwipeUp}
          />
        )}
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.dislikeButton]}
          onPress={handleButtonDislike}
          disabled={likeMutation.isPending || dislikeMutation.isPending}
        >
          <Text style={styles.actionButtonText}>❌</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.infoButton]}
          onPress={handleSwipeUp}
        >
          <Text style={styles.actionButtonText}>ℹ️</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={handleButtonLike}
          disabled={likeMutation.isPending || dislikeMutation.isPending}
        >
          <Text style={styles.actionButtonText}>❤️</Text>
        </TouchableOpacity>
      </View>

      <MatchScreen
        visible={showMatchModal}
        match={currentMatch}
        onClose={handleMatchClose}
        onGoToChat={handleGoToChat}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.grayDark,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: colors.grayDark,
    textAlign: 'center',
    marginBottom: 24,
  },
  refreshButton: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  refreshButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
    backgroundColor: colors.white,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
  },
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 24,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.grayLight,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  dislikeButton: {
    backgroundColor: colors.grayLight,
  },
  infoButton: {
    backgroundColor: colors.blue,
  },
  likeButton: {
    backgroundColor: colors.primary,
  },
  actionButtonText: {
    fontSize: 28,
  },
});
