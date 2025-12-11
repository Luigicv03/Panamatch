import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors } from '../constants/colors';
import { config } from '../constants/config';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import profileService from '../services/profileService';
import imageService from '../services/imageService';
import authService from '../services/authService';
import Button from '../components/Button';
import Card from '../components/Card';

import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { getAvatarUrl } from '../utils/imageUtils';

type NavigationProp = StackNavigationProp<RootStackParamList, 'Profile'>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout, login: updateAuth } = useAuthStore();
  const { profile, setProfile, fetchProfile, isLoading, profileNotFound } = useProfileStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    city: '',
    bio: '',
    email: '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [loadAttempted, setLoadAttempted] = useState(false);

  // Cargar perfil solo una vez al montar
  useEffect(() => {
    if (!loadAttempted && !profile && !isLoading) {
      setLoadAttempted(true);
      fetchProfile().catch((err: any) => {
        console.error('Error al cargar perfil:', err);
        // El error ya fue manejado en el store
      });
    }
  }, [loadAttempted, profile, isLoading, fetchProfile]);

  // Sincronizar form con perfil cuando cambia
  useEffect(() => {
    if (profile) {
      setForm({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        city: profile.city || '',
        bio: profile.bio || '',
        email: user?.email || '',
      });
    }
  }, [profile, user]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    if (!form.firstName.trim() || !form.lastName.trim() || !form.city.trim()) {
      Alert.alert('Campos requeridos', 'Nombre, apellido y ciudad son obligatorios.');
      return;
    }

    setIsSaving(true);
    try {
      // Convertir dateOfBirth al formato YYYY-MM-DD
      let dateOfBirthFormatted: string;
      if (profile.dateOfBirth) {
        const date = new Date(profile.dateOfBirth);
        if (isNaN(date.getTime())) {
          throw new Error('Fecha de nacimiento inválida');
        }
        // Formatear como YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dateOfBirthFormatted = `${year}-${month}-${day}`;
      } else {
        throw new Error('Fecha de nacimiento no disponible');
      }

      // Preparar intereses - solo enviar si existen y tienen IDs válidos
      const interestsIds = profile.interests
        ?.filter((i) => i && i.id)
        .map((i) => i.id) || [];

      console.log('📝 Enviando datos de actualización:', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: dateOfBirthFormatted,
        gender: profile.gender,
        city: form.city.trim(),
        bio: form.bio || undefined,
        interests: interestsIds,
      });

      // Mantener los campos obligatorios completos
      await profileService.updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: dateOfBirthFormatted,
        gender: profile.gender,
        city: form.city.trim(),
        bio: form.bio || undefined,
        interests: interestsIds.length > 0 ? interestsIds : undefined,
      });
      await fetchProfile();
      setIsEditing(false);
      Alert.alert('Éxito', 'Perfil actualizado correctamente');
    } catch (error: any) {
      console.error('Error al guardar perfil:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.details?.[0]?.message ||
                          error.message || 
                          'No se pudo guardar el perfil';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!user || !form.email.trim()) {
      Alert.alert('Error', 'El email no puede estar vacío');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      Alert.alert('Error', 'Por favor ingresa un email válido');
      return;
    }

    // Si el email no cambió, no hacer nada
    if (form.email.trim() === user.email) {
      Alert.alert('Info', 'El email no ha cambiado');
      return;
    }

    setIsSavingEmail(true);
    try {
      const result = await authService.updateEmail(form.email.trim());
      
      // Actualizar tokens y usuario en el store
      await updateAuth(
        result.accessToken,
        result.refreshToken,
        result.user
      );

      Alert.alert('Éxito', 'Email actualizado correctamente');
    } catch (error: any) {
      console.error('Error al actualizar email:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.details?.[0]?.message ||
                          error.message || 
                          'No se pudo actualizar el email';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              // Navegar al root navigator para cambiar a Auth stack
              const rootNavigation = navigation.getParent()?.getParent();
              if (rootNavigation) {
                // @ts-ignore
                rootNavigation.replace('Auth');
              } else {
                // Fallback
                // @ts-ignore
                navigation.getParent()?.replace('Auth');
              }
            } catch (error) {
              console.error('Error al cerrar sesión:', error);
              Alert.alert('Error', 'No se pudo cerrar sesión. Por favor intenta nuevamente.');
            }
          },
        },
      ]
    );
  };

  const handleChangePhoto = async () => {
    Alert.alert(
      'Cambiar Foto',
      '¿Cómo quieres cambiar tu foto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Galería',
          onPress: async () => {
            try {
              setIsUploading(true);
              const uri = await imageService.pickImageFromLibrary();
              if (uri) {
                try {
                  const result = await imageService.uploadImage(uri, 'profile');
                  // Actualizar optimísticamente el estado
                  setProfile({ ...profile!, avatarUrl: result.url });
                  // Recargar perfil para sincronizar
                  await fetchProfile();
                } catch (error: any) {
                  // Si es un error de red, el archivo puede haberse subido
                  if (error.isNetworkError || error.code === 'ECONNABORTED' || !error.response) {
                    // Esperar un momento y recargar el perfil
                    setTimeout(async () => {
                      try {
                        await fetchProfile();
                      } catch (fetchError) {
                        console.error('Error al recargar perfil:', fetchError);
                      }
                    }, 1500);
                  } else {
                    throw error;
                  }
                }
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || error.message || 'Error al cambiar foto');
            } finally {
              setIsUploading(false);
            }
          },
        },
        {
          text: 'Cámara',
          onPress: async () => {
            try {
              setIsUploading(true);
              const uri = await imageService.takePhoto();
              if (uri) {
                try {
                  const result = await imageService.uploadImage(uri, 'profile');
                  // Actualizar optimísticamente el estado
                  setProfile({ ...profile!, avatarUrl: result.url });
                  // Recargar perfil para sincronizar
                  await fetchProfile();
                } catch (error: any) {
                  // Si es un error de red, el archivo puede haberse subido
                  if (error.isNetworkError || error.code === 'ECONNABORTED' || !error.response) {
                    // Esperar un momento y recargar el perfil
                    setTimeout(async () => {
                      try {
                        await fetchProfile();
                      } catch (fetchError) {
                        console.error('Error al recargar perfil:', fetchError);
                      }
                    }, 1500);
                  } else {
                    throw error;
                  }
                }
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || error.message || 'Error al tomar foto');
            } finally {
              setIsUploading(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando perfil...</Text>
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          {isLoading ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Cargando perfil...</Text>
            </>
          ) : profileNotFound ? (
            <>
              <Text style={[styles.loadingText, { color: colors.dislike, marginBottom: 16, textAlign: 'center' }]}>
                No tienes un perfil aún.
              </Text>
              <Text style={[styles.loadingText, { marginBottom: 24, textAlign: 'center' }]}>
                Necesitas completar tu registro para usar la app.
              </Text>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={() => {
                  setLoadAttempted(false);
                  fetchProfile();
                }}
              >
                <Text style={styles.refreshButtonText}>Reintentar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Cargando perfil...</Text>
            </>
          )}
        </View>
      </View>
    );
  }

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
      </View>

      <Card style={styles.profileCard}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handleChangePhoto}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <>
              <Image
                source={{
                  uri: getAvatarUrl(profile.avatarUrl),
                }}
                style={styles.avatar}
                onError={(error) => {
                  console.error('❌ Error al cargar imagen de perfil:', {
                    profileId: profile.id,
                    avatarUrl: profile.avatarUrl,
                    error: error.nativeEvent?.error || error,
                  });
                }}
                onLoad={() => {
                  console.log('✅ Imagen de perfil cargada:', {
                    profileId: profile.id,
                    avatarUrl: profile.avatarUrl,
                  });
                }}
              />
              <View style={styles.avatarOverlay}>
                <Text style={styles.avatarOverlayText}>📷</Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.name}>
          {profile.firstName} {profile.lastName}
        </Text>
        <Text style={styles.ageCity}>
          {age} años · {profile.city}
        </Text>

        {isEditing ? (
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={form.firstName}
                onChangeText={(text) => setForm((f) => ({ ...f, firstName: text }))}
                placeholder="Tu nombre"
                placeholderTextColor={colors.grayDark}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Apellido</Text>
              <TextInput
                style={styles.input}
                value={form.lastName}
                onChangeText={(text) => setForm((f) => ({ ...f, lastName: text }))}
                placeholder="Tu apellido"
                placeholderTextColor={colors.grayDark}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Ciudad</Text>
              <TextInput
                style={styles.input}
                value={form.city}
                onChangeText={(text) => setForm((f) => ({ ...f, city: text }))}
                placeholder="Tu ciudad"
                placeholderTextColor={colors.grayDark}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={form.bio}
                onChangeText={(text) => setForm((f) => ({ ...f, bio: text }))}
                placeholder="Cuéntanos sobre ti"
                placeholderTextColor={colors.grayDark}
                multiline
                numberOfLines={4}
                maxLength={config.maxBioLength}
              />
              <Text style={styles.hint}>
                {config.maxBioLength - form.bio.length} caracteres restantes
              </Text>
            </View>

            <View style={styles.editActions}>
              <Button
                title={isSaving ? 'Guardando...' : 'Guardar'}
                onPress={handleSaveProfile}
                disabled={isSaving}
              />
              <Button
                title="Cancelar"
                variant="tertiary"
                onPress={() => {
                  setIsEditing(false);
                  // reset form
                  setForm({
                    firstName: profile.firstName || '',
                    lastName: profile.lastName || '',
                    city: profile.city || '',
                    bio: profile.bio || '',
                    email: user?.email || '',
                  });
                }}
              />
            </View>
          </View>
        ) : (
          <>
            {profile.bio && (
              <Text style={styles.bio}>{profile.bio}</Text>
            )}

            {profile.interests && profile.interests.length > 0 && (
              <View style={styles.interestsContainer}>
                <Text style={styles.interestsTitle}>Intereses</Text>
                <View style={styles.interestsGrid}>
                  {profile.interests.map((interest) => (
                    <View key={interest.id} style={styles.interestChip}>
                      <Text style={styles.interestText}>{interest.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {!isEditing && (
          <Button
            title="Editar Perfil"
            onPress={() => setIsEditing(true)}
            variant="secondary"
            style={styles.editButton}
          />
        )}
      </Card>

      <Card style={styles.accountCard}>
        <Text style={styles.accountTitle}>Cuenta</Text>
        
        {isEditing ? (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(text) => setForm((f) => ({ ...f, email: text }))}
              placeholder="tu@email.com"
              placeholderTextColor={colors.grayDark}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              title={isSavingEmail ? 'Guardando...' : 'Actualizar Email'}
              onPress={handleUpdateEmail}
              disabled={isSavingEmail || form.email.trim() === user?.email}
              variant="secondary"
              style={styles.updateEmailButton}
            />
          </View>
        ) : (
          <>
            <Text style={styles.accountEmail}>{user?.email}</Text>
            <Text style={styles.accountHint}>
              Edita tu perfil para cambiar el email
            </Text>
          </>
        )}
        
        <Button
          title="Cerrar Sesión"
          onPress={handleLogout}
          variant="tertiary"
          style={styles.logoutButton}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
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
  header: {
    padding: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.black,
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: colors.primary,
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  avatarOverlayText: {
    fontSize: 18,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 4,
  },
  ageCity: {
    fontSize: 16,
    color: colors.grayDark,
    marginBottom: 16,
  },
  bio: {
    fontSize: 16,
    color: colors.black,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  interestsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  interestsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 12,
    textAlign: 'center',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  interestChip: {
    backgroundColor: colors.grayLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  interestText: {
    fontSize: 14,
    color: colors.black,
    fontWeight: '500',
  },
  editButton: {
    marginTop: 8,
  },
  accountCard: {
    marginBottom: 16,
  },
  accountTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 8,
  },
  accountEmail: {
    fontSize: 16,
    color: colors.grayDark,
    marginBottom: 8,
  },
  accountHint: {
    fontSize: 12,
    color: colors.grayDark,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  updateEmailButton: {
    marginTop: 8,
  },
  logoutButton: {
    marginTop: 8,
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
  form: {
    width: '100%',
    paddingHorizontal: 16,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 8,
  },
  input: {
    height: 56,
    backgroundColor: colors.grayLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.black,
    borderWidth: 1,
    borderColor: colors.gray,
  },
  inputMultiline: {
    height: 100,
    paddingTop: 16,
    paddingBottom: 16,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: colors.grayDark,
    marginTop: 4,
  },
  editActions: {
    marginTop: 8,
    gap: 12,
  },
});
