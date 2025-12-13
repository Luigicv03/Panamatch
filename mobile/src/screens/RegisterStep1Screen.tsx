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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../constants/colors';

import { useNavigation, useRoute, RouteProp as RNRouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../types';

type NavigationProp = StackNavigationProp<AuthStackParamList, 'RegisterStep1'>;
type RoutePropType = RNRouteProp<AuthStackParamList, 'RegisterStep1'>;

export default function RegisterStep1Screen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set' && selectedDate) {
        validateAndSetDate(selectedDate);
      }
    } else {
      if (selectedDate) {
        setDateOfBirth(selectedDate);
      }
    }
  };

  const validateAndSetDate = (selectedDate: Date) => {
    const today = new Date();
    const age = today.getFullYear() - selectedDate.getFullYear();
    const monthDiff = today.getMonth() - selectedDate.getMonth();
    const dayDiff = today.getDate() - selectedDate.getDate();

    if (age < 18 || (age === 18 && (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)))) {
      Alert.alert('Error', 'Debes ser mayor de 18 años para usar esta app');
      return;
    }

    setDateOfBirth(selectedDate);
  };

  const handleConfirmDate = () => {
    if (dateOfBirth) {
      validateAndSetDate(dateOfBirth);
    }
    setShowDatePicker(false);
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleNext = () => {
    if (!firstName || !lastName || !dateOfBirth || !gender || !city) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    const normalizedDate = formatDate(dateOfBirth);

    navigation.navigate('RegisterStep2', {
      firstName,
      lastName,
      dateOfBirth: normalizedDate,
      gender,
      city,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Datos Básicos</Text>
          <Text style={styles.subtitle}>Cuéntanos sobre ti</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              placeholder="Tu nombre"
              placeholderTextColor={colors.grayDark}
              value={firstName}
              onChangeText={setFirstName}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Apellido</Text>
            <TextInput
              style={styles.input}
              placeholder="Tu apellido"
              placeholderTextColor={colors.grayDark}
              value={lastName}
              onChangeText={setLastName}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Fecha de Nacimiento</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.dateText, !dateOfBirth && styles.datePlaceholder]}>
                {dateOfBirth ? formatDate(dateOfBirth) : 'Selecciona tu fecha de nacimiento'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={dateOfBirth || new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
              />
            )}
            {Platform.OS === 'ios' && showDatePicker && (
              <View style={styles.iosPickerButtons}>
                <TouchableOpacity
                  style={styles.iosPickerButton}
                  onPress={() => {
                    setShowDatePicker(false);
                    setDateOfBirth(null);
                  }}
                >
                  <Text style={styles.iosPickerButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iosPickerButton}
                  onPress={handleConfirmDate}
                >
                  <Text style={[styles.iosPickerButtonText, styles.iosPickerButtonTextPrimary]}>
                    Confirmar
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Género</Text>
            <View style={styles.genderContainer}>
              {['Hombre', 'Mujer', 'Otro'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.genderOption,
                    gender === option && styles.genderOptionSelected,
                  ]}
                  onPress={() => setGender(option)}
                >
                  <Text
                    style={[
                      styles.genderOptionText,
                      gender === option && styles.genderOptionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Ciudad</Text>
            <TextInput
              style={styles.input}
              placeholder="Tu ciudad"
              placeholderTextColor={colors.grayDark}
              value={city}
              onChangeText={setCity}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleNext}>
            <Text style={styles.buttonText}>Siguiente</Text>
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
  hint: {
    fontSize: 12,
    color: colors.grayDark,
    marginTop: 4,
  },
  dateText: {
    fontSize: 16,
    color: colors.black,
  },
  datePlaceholder: {
    color: colors.grayDark,
  },
  iosPickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  iosPickerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.grayLight,
    alignItems: 'center',
  },
  iosPickerButtonText: {
    fontSize: 16,
    color: colors.grayDark,
    fontWeight: '600',
  },
  iosPickerButtonTextPrimary: {
    color: colors.primary,
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  genderOption: {
    flex: 1,
    height: 48,
    backgroundColor: colors.grayLight,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  genderOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.grayDark,
  },
  genderOptionTextSelected: {
    color: colors.primary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

