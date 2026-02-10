export const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
  sampleRate: 24000, // Gemini Output Sample Rate
});

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export async function decodeAudioData(
  audioData: ArrayBuffer,
  sampleRate: number = 24000
): Promise<AudioBuffer> {
  // Gemini sends raw PCM 16-bit LE. We need to convert it to AudioBuffer manually
  // because decodeAudioData expects a file header (WAV/MP3) which raw PCM doesn't have.
  
  const dataView = new DataView(audioData);
  const numChannels = 1;
  const numSamples = audioData.byteLength / 2; // 16-bit = 2 bytes
  const buffer = audioContext.createBuffer(numChannels, numSamples, sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let i = 0; i < numSamples; i++) {
    // Convert Int16 (-32768 to 32767) to Float32 (-1.0 to 1.0)
    const int16 = dataView.getInt16(i * 2, true); // true for Little Endian
    channelData[i] = int16 / 32768.0;
  }

  return buffer;
}

export function createPCM16Blob(float32Data: Float32Array): Blob {
  const l = float32Data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values
    const s = Math.max(-1, Math.min(1, float32Data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return new Blob([int16], { type: 'audio/pcm' });
}

export async function playAudioBuffer(buffer: AudioBuffer) {
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start();
}