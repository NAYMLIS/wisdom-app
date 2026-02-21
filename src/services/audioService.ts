import { Audio } from 'expo-av';

export type AmbientKey = 'brown' | 'rain' | 'ocean' | 'forest' | 'bowl';

export const loadSoundAsync = async (asset: number) => {
  const sound = new Audio.Sound();
  await sound.loadAsync(asset);
  return sound;
};

export const playOneShot = async (sound: Audio.Sound, volume = 1) => {
  await sound.setPositionAsync(0);
  await sound.setVolumeAsync(volume);
  await sound.playAsync();
};

export const startLoop = async (sound: Audio.Sound, volume: number) => {
  const status = await sound.getStatusAsync();
  await sound.setIsLoopingAsync(true);
  await sound.setVolumeAsync(volume);
  if (!status.isLoaded || !status.isPlaying) {
    await sound.playAsync();
  }
};

export const setVolume = async (sound: Audio.Sound, volume: number) => {
  await sound.setVolumeAsync(volume);
};

export const pauseSound = async (sound: Audio.Sound) => {
  try {
    await sound.pauseAsync();
  } catch {}
};

export const resumeSound = async (sound: Audio.Sound) => {
  try {
    const status = await sound.getStatusAsync();
    if (status.isLoaded && !status.isPlaying) {
      await sound.playAsync();
    }
  } catch {}
};

export const stopSound = async (sound: Audio.Sound) => {
  try {
    await sound.stopAsync();
  } catch {}
};
