import React, { useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import RegisterStep1Screen from '../screens/RegisterStep1Screen';
import RegisterStep2Screen from '../screens/RegisterStep2Screen';
import RegisterStep3Screen from '../screens/RegisterStep3Screen';
import RegisterStep4Screen from '../screens/RegisterStep4Screen';
import { AuthStackParamList } from '../types';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';

const Stack = createStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  const { isAuthenticated } = useAuthStore();
  const { profileNotFound } = useProfileStore();
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();

  useEffect(() => {
    if (isAuthenticated && profileNotFound) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'RegisterStep1' }],
      });
    }
  }, [isAuthenticated, profileNotFound, navigation]);

  return (
    <Stack.Navigator
      initialRouteName={isAuthenticated && profileNotFound ? 'RegisterStep1' : 'Welcome'}
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="RegisterStep1" component={RegisterStep1Screen} />
      <Stack.Screen name="RegisterStep2" component={RegisterStep2Screen} />
      <Stack.Screen name="RegisterStep3" component={RegisterStep3Screen} />
      <Stack.Screen name="RegisterStep4" component={RegisterStep4Screen} />
    </Stack.Navigator>
  );
}

