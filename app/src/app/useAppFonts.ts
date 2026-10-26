import {
  GolosText_400Regular,
  GolosText_500Medium,
  GolosText_600SemiBold,
  GolosText_700Bold,
  useFonts,
} from '@expo-google-fonts/golos-text';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';

/** True once the fonts are ready or failed to load; on failure the app goes on with system fonts. */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    GolosText_400Regular,
    GolosText_500Medium,
    GolosText_600SemiBold,
    GolosText_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  return loaded || error !== null;
}
