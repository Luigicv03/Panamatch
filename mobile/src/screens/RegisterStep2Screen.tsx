import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../constants/colors';
import imageService from '../services/imageService';
import profileService from '../services/profileService';

import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../types';

type NavigationProp = StackNavigationProp<AuthStackParamList, 'RegisterStep2'>;
type RouteProp = RouteProp<AuthStackParamList, 'RegisterStep2'>;

export default function RegisterStep2Screen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp>();
  const [avatarUri, setAvatarUri] = useState<string | null>(route.params?.avatarUri || null);
  const [isUploading, setIsUploading] = useState(false);

  const pickImage = async () => {
    try {
      const uri = await imageService.pickImageFromLibrary();
      if (uri) {
        setAvatarUri(uri);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al seleccionar imagen');
    }
  };

  const takePhoto = async () => {
    try {
      const uri = await imageService.takePhoto();
      if (uri) {
        setAvatarUri(uri);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al tomar foto');
    }
  };

  const handleNext = () => {
    if (!avatarUri) {
      Alert.alert('Error', 'Por favor selecciona una foto de perfil');
      return;
    }

    navigation.navigate('RegisterStep3', {
      ...route.params,
      avatarUri,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Foto de Perfil</Text>
        <Text style={styles.subtitle}>Agrega una foto para tu perfil</Text>
      </View>

      <View style={styles.imageContainer}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>📷</Text>
          </View>
        )}
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
          <Text style={styles.actionButtonText}>Elegir de Galería</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
          <Text style={styles.actionButtonText}>Tomar Foto</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, !avatarUri && styles.buttonDisabled]}
        onPress={handleNext}
        disabled={!avatarUri}
      >
        <Text style={styles.buttonText}>Continuar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    padding: 24,
  },
  header: {
    marginBottom: 40,
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
  imageContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatar: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: colors.primary,
  },
  avatarPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.gray,
    borderStyle: 'dashed',
  },
  avatarPlaceholderText: {
    fontSize: 64,
  },
  actionsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  actionButton: {
    backgroundColor: colors.grayLight,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

