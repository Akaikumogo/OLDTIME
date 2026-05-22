import { useState, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from 'antd';
import { BACKEND_ORIGIN } from '@/services/api';

interface TalkbackWidgetProps {
  cameraId: string;
  channelId?: string;
  token?: string;
}

export function TalkbackWidget({ cameraId, channelId = '1', token }: TalkbackWidgetProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Listen to camera audio (from RTSP stream)
  const toggleListen = async () => {
    try {
      setError(null);
      setIsLoading(true);

      if (!isListening) {
        // Start listening
        const audioSrc = `${BACKEND_ORIGIN}/api/cameras/${cameraId}/audio${token ? `?token=${token}` : ''}`;
        if (audioRef.current) {
          audioRef.current.src = audioSrc;
          audioRef.current.play().catch(err => {
            setError('Audio play failed');
            console.error('Audio play error:', err);
          });
        }
        setIsListening(true);
      } else {
        // Stop listening
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }
        setIsListening(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      console.error('Listen error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Start recording user's voice
  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await sendAudioToCamera(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      setError('Mikrafon ruxsati kerak');
      console.error('Mic error:', err);
    }
  };

  // Stop recording and send to camera
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Send audio data to camera speaker (ISAPI talkback)
  const sendAudioToCamera = async (audioBlob: Blob) => {
    try {
      setError(null);
      const url = `${BACKEND_ORIGIN}/api/cameras/${cameraId}/talkback/send-audio?channel_id=${channelId}${
        token ? `&token=${token}` : ''
      }`;

      const response = await fetch(url, {
        method: 'POST',
        body: audioBlob,
        headers: {
          'Content-Type': 'audio/webm',
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      console.log('✓ Audio sent to camera');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
      console.error('Send audio error:', err);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700">
      <audio ref={audioRef} style={{ display: 'none' }} crossOrigin="anonymous" />

      <h4 className="text-xs font-semibold text-white">Talkback (Gaplashish)</h4>

      {/* Listen */}
      <Button
        size="small"
        onClick={toggleListen}
        loading={isLoading}
        type={isListening ? 'primary' : 'default'}
        className="w-full flex items-center justify-center gap-2"
      >
        {isListening ? <VolumeX size={14} /> : <Volume2 size={14} />}
        {isListening ? 'Tinish' : 'Eshitish'}
      </Button>

      {/* Record/Send */}
      {!isRecording ? (
        <Button
          size="small"
          onClick={startRecording}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
        >
          <Mic size={14} />
          Gapirishni boshlash
        </Button>
      ) : (
        <Button
          size="small"
          onClick={stopRecording}
          className="w-full flex items-center justify-center gap-2 bg-red-600 text-white hover:bg-red-700 animate-pulse"
        >
          <MicOff size={14} />
          Yuborish
        </Button>
      )}

      {/* Status */}
      {error && <div className="text-xs text-red-400">❌ {error}</div>}
      {isListening && <div className="text-xs text-green-400">🔊 Tinishmoqda...</div>}
      {isRecording && <div className="text-xs text-orange-400">🎤 Gapirmoqda...</div>}
    </div>
  );
}
