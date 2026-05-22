/**
 * @file react-native-mock.ts
 * @description Mock implementation of react-native for testing environment.
 */

export const Platform = {
  OS: 'web',
};

export const Alert = {
  alert: (title: string, message?: string, buttons?: any[]) => {
    console.log('[Mock Alert]', title, message);
  },
};

export class View {}
export class Text {}
export class TouchableOpacity {}
export class ScrollView {}
export class TextInput {}
export class ActivityIndicator {}

export const StyleSheet = {
  create: (styles: any) => styles,
};
