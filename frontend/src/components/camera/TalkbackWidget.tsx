import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { Button } from 'antd';

interface TalkbackWidgetProps {
  cameraId: string;
  channelId?: string;
}

export function TalkbackWidget({ cameraId, channelId = '1' }: TalkbackWidgetProps) {
  const [isActive, setIsActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Open two-way audio connection
  const handleOpen = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/cameras/${cameraId}/talkback/open?channel_id=${channelId}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to open audio');
      setIsActive(true);

      // Start receiving audio
      startAudioPlayback();
    } catch (error) {
      console.error('Error opening audio:', error);
      alert('Audioni ochib bo\'lmadi');
    } finally {
      setIsLoading(false);
    }
  };

  // Close two-way audio connection
  const handleClose = async () => {
    try {
      setIsLoading(true);
      stopAudioPlayback();
      if (isRecording) stopRecording();

      const response = await fetch(`/api/cameras/${cameraId}/talkback/close?channel_id=${channelId}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to close audio');
      setIsActive(false);
    } catch (error) {
      console.error('Error closing audio:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Start receiving audio from camera
  const startAudioPlayback = async () => {
    try {
      const response = await fetch(
        `/api/cameras/${cameraId}/talkback/receive-audio?channel_id=${channelId}`
      );
      if (!response.ok) throw new Error('Failed to get audio stream');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch(err => console.error('Audio playback error:', err));
      }
    } catch (error) {
      console.error('Error starting audio playback:', error);
    }
  };

  const stopAudioPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  };

  // Start recording user's voice
  const startRecording = async () => {
    try {
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
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Mikrafon ruxsati kerak');
    }
  };

  // Stop recording and send to camera
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Send audio data to camera speaker
  const sendAudioToCamera = async (audioBlob: Blob) => {
    try {
      const response = await fetch(
        `/api/cameras/${cameraId}/talkback/send-audio?channel_id=${channelId}`,
        {
          method: 'POST',
          body: audioBlob,
          headers: {
            'Content-Type': 'audio/webm',
          },
        }
      );
      if (!response.ok) throw new Error('Failed to send audio');
      console.log('Audio sent successfully');
    } catch (error) {
      console.error('Error sending audio:', error);
      alert('Audio yuborilmadi');
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-slate-900 rounded-lg border border-slate-700">
      <h3 className="text-sm font-semibold text-white">Talkback (Gaplashish)</h3>

      {/* Audio playback element (hidden) */}
      <audio ref={audioRef} style={{ display: 'none' }} />

      {/* Main controls */}
      <div className="flex gap-2">
        {!isActive ? (
          <Button
            type="primary"
            size="large"
            loading={isLoading}
            onClick={handleOpen}
            className="flex items-center justify-center gap-2"
          >
            <Phone size={16} />
            Audioni ochish
          </Button>
        ) : (
          <Button
            type="primary"
            danger
            size="large"
            loading={isLoading}
            onClick={handleClose}
            className="flex items-center justify-center gap-2"
          >
            <PhoneOff size={16} />
            Audioni yopish
          </Button>
        )}
      </div>

      {/* Microphone control (only when audio is active) */}
      {isActive && (
        <div className="flex gap-2">
          {!isRecording ? (
            <Button
              type="default"
              size="large"
              onClick={startRecording}
              className="flex items-center justify-center gap-2 flex-1 bg-blue-600 text-white hover:bg-blue-700"
            >
              <Mic size={16} />
              Gapirishni boshlash
            </Button>
          ) : (
            <Button
              type="default"
              size="large"
              onClick={stopRecording}
              className="flex items-center justify-center gap-2 flex-1 bg-red-600 text-white hover:bg-red-700 animate-pulse"
            >
              <MicOff size={16} />
              Gapirishni to'xtash
            </Button>
          )}
        </div>
      )}

      {/* Status */}
      <div className="text-xs text-slate-400">
        {!isActive && 'Audioni ochish uchun tugmani bosing'}
        {isActive && !isRecording && 'Shurang! Gapirishga tayyor'}
        {isRecording && 'Gapirmoqda...'}
      </div>
    </div>
  );
}
