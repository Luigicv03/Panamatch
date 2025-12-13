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

  useEffect(() => {
    if (isAuthenticated && !authLoading && !profileChecked) {
      fetchProfile()
        .then(() => {
          setProfileChecked(true);
        })
        .catch(() => {
          setProfileChecked(true);
        });
    }
  }, [isAuthenticated, authLoading, profileChecked, fetchProfile]);

  useEffect(() => {
    if (isAuthenticated && profileChecked && !profile && !profileNotFound) {
      fetchProfile().catch(() => {});
    }
  }, [isAuthenticated, profileChecked, profile, profileNotFound, fetchProfile]);

  useEffect(() => {
    if (isAuthenticated && profileChecked && profile && !profileNotFound) {
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, profileChecked, profile, profileNotFound]);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || profileChecked)) {
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [authLoading, isAuthenticated, profileChecked]);

  if (authLoading || showSplash || (isAuthenticated && !profileChecked)) {
    return <SplashScreen />;
  }

  const getInitialRoute = () => {
    if (!isAuthenticated) {
      return 'Auth';
    }
    if (profileNotFound || !profile) {
      return 'Auth';
    }
    return 'Main';
  };

  return (
    <NavigationContainer>
      <Stack.Navigator
        key={profile ? 'main' : 'auth'}
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

