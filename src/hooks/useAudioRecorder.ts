
import { useState, useRef, useCallback } from 'react';

type RecordingStatus = 'idle' | 'recording' | 'stopped';

export const useAudioRecorder = () => {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    if (status === 'recording') return;
    
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setStatus('stopped');
        // Clean up stream tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.onerror = (event) => {
        setError('Ocorreu um erro durante a gravação.');
        setStatus('idle');
      }

      recorder.start();
      setStatus('recording');

    } catch (err) {
      console.error("Error starting recording:", err);
      setError('Permissão para usar o microfone foi negada ou não há microfone disponível.');
      setStatus('idle');
    }
  }, [status]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, [status]);

  const resetRecording = useCallback(() => {
    setStatus('idle');
    setAudioUrl(null);
    setError(null);
    audioChunksRef.current = [];
    mediaRecorderRef.current = null;
  }, []);

  return { status, audioUrl, error, startRecording, stopRecording, resetRecording };
};
