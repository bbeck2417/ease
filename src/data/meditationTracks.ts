export type MeditationTrack = {
  id: string;
  title: string;
  subtitle: string;
  localAsset?: number;
};

// Add your CC0 files under assets/audio and set `localAsset` with require(...)
// Example:
// localAsset: require("../../assets/audio/gentle-rain.mp3"),
export const MEDITATION_TRACKS: MeditationTrack[] = [
  {
    id: "rain",
    title: "Gentle Rain",
    subtitle: "Waiting for local CC0 file",
  },
  {
    id: "river",
    title: "River Flow",
    subtitle: "Waiting for local CC0 file",
    localAsset: require("../../assets/audio/calm-zen-river-flowing.mp3"),
  },
  {
    id: "forest",
    title: "Forest Birds",
    subtitle: "Waiting for local CC0 file",
  },
  {
    id: "bowl",
    title: "Singing Bowl",
    subtitle: "Waiting for local CC0 file",
  },
];
