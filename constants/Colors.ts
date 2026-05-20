/**
 * @file Colors.ts
 * @description StreetBiz branded colour palette for light and dark themes.
 * @module constants/Colors
 */

const brand = {
  green: '#1D9E75',
  greenLight: '#E1F5EE',
  purple: '#534AB7',
  purpleLight: '#EEEDFE',
  orange: '#D85A30',
  amber: '#BA7517',
};

const tintColorLight = brand.green;
const tintColorDark = '#A3E8CF';

export default {
  brand,
  light: {
    text: '#1A1A1A',
    textSecondary: '#666666',
    background: '#FAFAFA',
    card: '#FFFFFF',
    tint: tintColorLight,
    tabIconDefault: '#AAAAAA',
    tabIconSelected: tintColorLight,
    border: '#E5E5E5',
  },
  dark: {
    text: '#F5F5F5',
    textSecondary: '#A0A0A0',
    background: '#0F0F0F',
    card: '#1C1C1E',
    tint: tintColorDark,
    tabIconDefault: '#666666',
    tabIconSelected: tintColorDark,
    border: '#2C2C2E',
  },
};
