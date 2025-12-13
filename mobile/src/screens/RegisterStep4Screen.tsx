import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../constants/colors';
import { config } from '../constants/config';
import profileService from '../services/profileService';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';

import { useNavigation, useRoute, RouteProp as RNRouteProp, CommonActions } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList, RootStackParamList } from '../types';

type NavigationProp = StackNavigationProp<AuthStackParamList, 'RegisterStep4'>;
type RoutePropType = RNRouteProp<AuthStackParamList, 'RegisterStep4'>;

export default function RegisterStep4Screen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const [bio, setBio] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuthStore();
  const { setProfile, fetchProfile } = useProfileStore();

  const handleComplete = async () => {
    if (bio.length > config.maxBioLength) {
      Alert.alert('Error', `La bio no puede exceder ${config.maxBioLength} caracteres`);
      return;
    }

    setIsLoading(true);
    try {
      const params = route.params;
      
      if (!params.firstName || !params.lastName || !params.dateOfBirth || !params.gender || !params.city) {
        Alert.alert('Error', 'Faltan datos requeridos. Por favor, completa el registro desde el inicio.');
        setIsLoading(false);
        return;
      }

      let normalizedDateOfBirth = params.dateOfBirth;
      
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(normalizedDateOfBirth)) {
        const date = new Date(normalizedDateOfBirth);
        if (!isNaN(date.getTime())) {
          normalizedDateOfBirth = date.toISOString().split('T')[0];
        } else {
          throw new Error('Fecha de nacimiento inválida');
        }
      }

      const profile = await profileService.createProfile({
        firstName: params.firstName,
        lastName: params.lastName,
        dateOfBirth: normalizedDateOfBirth,
        gender: params.gender,
        city: params.city,
        bio: bio || undefined,
        interests: params.interests,
      });

      if (params.avatarUri) {
        try {
          await profileService.uploadAvatar(params.avatarUri);
          await fetchProfile();
        } catch (avatarError: any) {
          if (avatarError.isNetworkError || avatarError.code === 'ECONNABORTED' || !avatarError.response) {
            setTimeout(async () => {
              try {
                await fetchProfile();
              } catch (fetchError) {
              }
            }, 1500);
          }
        }
      }

      setProfile(profile);
      await fetchProfile();
      setIsLoading(false);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      try {
        const rootNavigation = navigation.getParent()?.getParent();
        if (rootNavigation) {
          (rootNavigation as any).dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Main' as keyof RootStackParamList }],
            })
          );
        } else {
          const parentNav = navigation.getParent();
          if (parentNav) {
            (parentNav as any).dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Main' as keyof RootStackParamList }],
              })
            );
          }
        }
      } catch (navError) {
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || error.message || 'Error al crear el perfil');
      setIsLoading(false);
    }
  };

  const charactersLeft = config.maxBioLength - bio.length;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Mini Bio</Text>
          <Text style={styles.subtitle}>Cuéntanos un poco sobre ti</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textArea}
              placeholder="Escribe algo sobre ti..."
              placeholderTextColor={colors.grayDark}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={6}
              maxLength={config.maxBioLength}
            />
            <Text style={styles.counter}>
              {charactersLeft} caracteres restantes
            </Text>
          </View>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleComplete}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Crear Perfil</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.grayDark,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 24,
  },
  textArea: {
    minHeight: 120,
    backgroundColor: colors.grayLight,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.black,
    borderWidth: 1,
    borderColor: colors.gray,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: 12,
    color: colors.grayDark,
    marginTop: 8,
    textAlign: 'right',
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.grayLight,
    borderRadius: 2,
    marginBottom: 24,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

