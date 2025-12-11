import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import SplashScreen from '../screens/SplashScreen';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import { RootStackParamList } from '../types';

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { checkAuth, isLoading: authLoading, isAuthenticated } = useAuthStore();
  const { profile, fetchProfile, profileNotFound, isLoading: profileLoading } = useProfileStore();
  const [showSplash, setShowSplash] = useState(true);
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Verificar perfil cuando el usuario esté autenticado
  useEffect(() => {
    if (isAuthenticated && !authLoading && !profileChecked) {
      fetchProfile()
        .then(() => {
          setProfileChecked(true);
        })
        .catch((error) => {
          console.log('Error al cargar perfil al iniciar app:', error);
          setProfileChecked(true); // Marcar como verificado incluso si falla
        });
    }
  }, [isAuthenticated, authLoading, profileChecked, fetchProfile]);

  // Re-verificar perfil cuando cambia (por ejemplo, después de crearlo)
  useEffect(() => {
    if (isAuthenticated && profileChecked && !profile && !profileNotFound) {
      // Si el perfil cambió y ahora existe, actualizar
      fetchProfile().catch(() => {});
    }
  }, [isAuthenticated, profileChecked, profile, profileNotFound, fetchProfile]);

  // Detectar cuando se crea un perfil y redirigir a Main
  useEffect(() => {
    if (isAuthenticated && profileChecked && profile && !profileNotFound) {
      // Si hay perfil y estamos en Auth, redirigir a Main
      // Esto se ejecutará cuando se cree el perfil desde RegisterStep4
      const timer = setTimeout(() => {
        // Forzar re-render del navigator para cambiar la ruta inicial
        setShowSplash(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, profileChecked, profile, profileNotFound]);

  useEffect(() => {
    // Ocultar splash después de verificar autenticación y perfil
    if (!authLoading && (!isAuthenticated || profileChecked)) {
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [authLoading, isAuthenticated, profileChecked]);

  if (authLoading || showSplash || (isAuthenticated && !profileChecked)) {
    // Mostrar splash mientras se verifica la autenticación y perfil
    return <SplashScreen />;
  }

  // Determinar la ruta inicial basada en autenticación y perfil
  const getInitialRoute = () => {
    if (!isAuthenticated) {
      return 'Auth';
    }
    // Si está autenticado pero no tiene perfil, debe completar el registro
    if (profileNotFound || !profile) {
      return 'Auth'; // Mantener en Auth para mostrar RegisterStep1
    }
    return 'Main';
  };

  return (
    <NavigationContainer>
      <Stack.Navigator
        key={profile ? 'main' : 'auth'} // Forzar re-render cuando cambia el perfil
        initialRouteName={getInitialRoute()}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Auth" component={AuthNavigator} />
        <Stack.Screen name="Main" component={MainNavigator} />
        <Stack.Screen name="Splash" component={SplashScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

