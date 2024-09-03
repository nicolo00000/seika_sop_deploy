'use client';
import React, { useState, useRef } from 'react';
import { ChevronDown, Mic } from 'lucide-react';

interface UploadResult {
  machine: string;
  audioFile: string;
  transcript: string;
  sop: string;
}

const translations = {
  it: {
    title: "Convertitore Audio in SOP per Macchine Specifiche",
    instruction: "Seleziona una macchina e clicca il pulsante per iniziare la registrazione. Parla chiaramente per descrivere la procedura che vuoi convertire in SOP.",
    machine1: "Macchina 1",
    machine2: "Macchina 2",
    machine3: "Macchina 3",
    startRecording: "Inizia Registrazione",
    stopRecording: "Ferma Registrazione",
    processing: "Elaborazione...",
    uploadAndProcess: "Carica ed Elabora",
    result: "Risultato Elaborazione",
    machine: "Macchina",
    transcription: "Trascrizione",
    sop: "SOP",
    microphoneError: "Errore nell'accesso al microfono",
    uploadError: "Errore nel caricamento audio",
    uploadFailed: "Caricamento fallito",
  },
  en: {
    title: "Audio to SOP Converter for Specific Machines",
    instruction: "Select a machine and click the button to start recording. Speak clearly to describe the procedure you want to convert into an SOP.",
    machine1: "Machine 1",
    machine2: "Machine 2",
    machine3: "Machine 3",
    startRecording: "Start Recording",
    stopRecording: "Stop Recording",
    processing: "Processing...",
    uploadAndProcess: "Upload and Process",
    result: "Processing Result",
    machine: "Machine",
    transcription: "Transcription",
    sop: "SOP",
    microphoneError: "Error accessing microphone",
    uploadError: "Error uploading audio",
    uploadFailed: "Upload failed",
  }
};

const AudioToSopConverter = () => {
  const [language, setLanguage] = useState<'it' | 'en'>('it');
  const [selectedMachine, setSelectedMachine] = useState('Machine_1');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [latestResult, setLatestResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const t = translations[language];

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'it' ? 'en' : 'it');
  };

  const handleStartRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        const chunks: Blob[] = [];
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          setAudioBlob(blob);
        };

        mediaRecorder.start();
        setIsRecording(true);
        setError(null);
      } catch (error) {
        console.error(t.microphoneError, error);
        setError(t.microphoneError);
      }
    }
  };

  const handleUpload = async () => {
    if (!audioBlob) return;

    setIsLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('machine', selectedMachine);
    formData.append('language', language);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result: UploadResult = await response.json();
        console.log('Upload result:', result);
        setLatestResult(result);
      } else {
        const errorData = await response.json();
        console.error(t.uploadFailed, response.status, response.statusText);
        console.error('Error details:', errorData);
        setError(`${t.uploadFailed}: ${errorData.error}. ${errorData.details || ''}`);
      }
    } catch (error) {
      console.error(t.uploadError, error);
      setError(t.uploadError);
    } finally {
      setIsLoading(false);
      setAudioBlob(null);
    }
  };

  return (
    <div className="bg-white border border-[#536f4d] p-6 rounded-lg shadow-md text-[#536f4d]">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <button onClick={toggleLanguage} className="px-3 py-1 bg-[#536f4d] text-white rounded font-semibold">
          {language === 'it' ? 'EN' : 'IT'}
        </button>
      </div>
      <p className="mb-6">{t.instruction}</p>
      <div className="space-y-4">
        <div className="relative">
          <select
            className="w-full p-2 border border-[#536f4d] rounded appearance-none bg-white text-[#536f4d] focus:outline-none focus:ring-1 focus:ring-[#536f4d]"
            value={selectedMachine}
            onChange={(e) => setSelectedMachine(e.target.value)}
          >
            <option value="Machine_1">{t.machine1}</option>
            <option value="Machine_2">{t.machine2}</option>
            <option value="Machine_3">{t.machine3}</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#536f4d]" size={20} />
        </div>
        <button
          className={`w-full py-2 px-4 rounded font-semibold text-white flex items-center justify-center space-x-2 transition duration-300 ${
            isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-[#536f4d] hover:bg-[#45503f]'
          }`}
          onClick={handleStartRecording}
        >
          <Mic size={20} />
          <span>{isRecording ? t.stopRecording : t.startRecording}</span>
        </button>
        {audioBlob && (
          <button
            className="w-full py-2 px-4 rounded font-semibold text-white bg-blue-500 hover:bg-blue-600 transition duration-300"
            onClick={handleUpload}
            disabled={isLoading}
          >
            {isLoading ? t.processing : t.uploadAndProcess}
          </button>
        )}
      </div>
      
      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {latestResult && (
        <div className="mt-8 p-4 border border-[#536f4d] rounded">
          <h2 className="text-xl font-semibold mb-2">{t.result}</h2>
          <h3 className="font-semibold">{t.machine}: {latestResult.machine}</h3>
          {latestResult.transcript && (
            <div className="mt-2">
              <h4 className="font-semibold">{t.transcription}:</h4>
              <p className="whitespace-pre-wrap">{latestResult.transcript}</p>
            </div>
          )}
          {latestResult.sop && (
            <div className="mt-2">
              <h4 className="font-semibold">{t.sop}:</h4>
              <p className="whitespace-pre-wrap">{latestResult.sop}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AudioToSopConverter;