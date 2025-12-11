import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { colors } from '../constants/colors';
import { useProfileStore } from '../store/profileStore';
import { Interest } from '../types';

import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../types';

type NavigationProp = StackNavigationProp<AuthStackParamList, 'RegisterStep3'>;
type RouteProp = RouteProp<AuthStackParamList, 'RegisterStep3'>;

export default function RegisterStep3Screen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp>();
  const { interests, fetchInterests } = useProfileStore();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  useEffect(() => {
    fetchInterests();
  }, []);

  const toggleInterest = (interestId: string) => {
    if (selectedInterests.includes(interestId)) {
      setSelectedInterests(selectedInterests.filter((id) => id !== interestId));
    } else {
      setSelectedInterests([...selectedInterests, interestId]);
    }
  };

  const handleNext = () => {
    if (selectedInterests.length === 0) {
      Alert.alert('Error', 'Por favor selecciona al menos un interés');
      return;
    }

    navigation.navigate('RegisterStep4', {
      ...route.params,
      interests: selectedInterests,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Intereses</Text>
        <Text style={styles.subtitle}>Selecciona tus intereses</Text>
      </View>

      {selectedInterests.length > 0 && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedTitle}>Seleccionados:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.selectedChips}>
              {interests
                .filter((i) => selectedInterests.includes(i.id))
                .map((interest) => (
                  <View key={interest.id} style={styles.selectedChip}>
                    <Text style={styles.selectedChipText}>{interest.name}</Text>
                  </View>
                ))}
            </View>
          </ScrollView>
        </View>
      )}

      <ScrollView style={styles.interestsContainer} contentContainerStyle={styles.interestsContent}>
        {interests.map((interest) => (
          <TouchableOpacity
            key={interest.id}
            style={[
              styles.interestChip,
              selectedInterests.includes(interest.id) && styles.interestChipSelected,
            ]}
            onPress={() => toggleInterest(interest.id)}
          >
            <Text
              style={[
                styles.interestChipText,
                selectedInterests.includes(interest.id) && styles.interestChipTextSelected,
              ]}
            >
              {interest.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.button, selectedInterests.length === 0 && styles.buttonDisabled]}
        onPress={handleNext}
        disabled={selectedInterests.length === 0}
      >
        <Text style={styles.buttonText}>Siguiente</Text>
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
    marginBottom: 24,
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
  selectedContainer: {
    marginBottom: 24,
  },
  selectedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 8,
  },
  selectedChips: {
    flexDirection: 'row',
    gap: 8,
  },
  selectedChip: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  selectedChipText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  interestsContainer: {
    flex: 1,
    marginBottom: 24,
  },
  interestsContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  interestChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.grayLight,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  interestChipSelected: {
    backgroundColor: colors.white,
    borderColor: colors.primary,
  },
  interestChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.grayDark,
  },
  interestChipTextSelected: {
    color: colors.primary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
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

