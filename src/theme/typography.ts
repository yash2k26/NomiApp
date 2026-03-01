import { Platform } from 'react-native';

export const petTypography = {
  display: Platform.select({
    ios: 'AvenirNext-Bold',
    android: 'sans-serif-medium',
    default: 'System',
  }),
  heading: Platform.select({
    ios: 'AvenirNext-DemiBold',
    android: 'sans-serif-medium',
    default: 'System',
  }),
  body: Platform.select({
    ios: 'AvenirNext-Regular',
    android: 'sans-serif',
    default: 'System',
  }),
  strong: Platform.select({
    ios: 'AvenirNext-Heavy',
    android: 'sans-serif-medium',
    default: 'System',
  }),
} as const;
