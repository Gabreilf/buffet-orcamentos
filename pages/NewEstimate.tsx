import React, { useState, useCallback } from 'react';
import { Estimate, CustomCosts } from '../types';
import { generateEstimateFromText } from '../services/geminiService';
import Spinner from '../components/Spinner';
import { useAudioRecorder } from '../hooks/useAudioRecorder';

interface NewEstimateProps {
  onEstimateGenerated: (estimate: Estimate) => void;
  customCosts: CustomCosts;
}

type InputMode = 'text' | 'audio';

const NewEstimate: React.FC<NewEstimateProps> = ({ onEstimateGenerated, customCosts }) => {
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { status, audioUrl, error: audioError, startRecording, stopRecording, resetRecording } = useAudioRecorder();

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) {
      setError('Por favor, descreva o evento.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const estimate = await generateEstimateFromText(text, customCosts);
      onEstimateGenerated(estimate);
    } catch (e: any) {
      setError(e.message || 'Ocorreu um erro desconhecido.');
    } finally {
      setIsLoading(false);
    }
  }, [text, onEstimateGenerated, customCosts]);
  
  // A mock for audio processing as Gemini requires complex setup for direct audio input in this context.
  // In a real app, this would send the audio blob to a backend that uses Google Speech-to-Text or Gemini audio APIs.
  const handleAudioSubmit = () => {
      setText("Transcrição de áudio: Festa de casamento para 150 pessoas no sábado. Gostaria de um cardápio de churrasco com picanha, fraldinha, linguiça toscana, e também uma mesa de saladas completa. Para beber, cerveja Original e Coca-Cola.");
      setInputMode('text');
      resetRecording();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spinner message="Analisando seu pedido e calculando os custos..." />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-2xl">
      <h2 className="text-3xl font-bold text-center text-slate-800 mb-2">Criar Novo Orçamento</h2>
      <p className="text-center text-slate-500 mb-8">Descreva o evento e nossa IA fará o resto.</p>

      <div className="flex justify-center mb-6 border border-slate-200 rounded-lg p-1 bg-slate-100 w-min mx-auto">
        <button
          onClick={() => setInputMode('text')}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${inputMode === 'text' ? 'bg-white text-indigo-600 shadow' : 'text-slate-600'}`}
        >
          <i className="fas fa-keyboard mr-2"></i>Digitar
        </button>
        <button
          onClick={() => { setInputMode('audio'); resetRecording(); }}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${inputMode === 'audio' ? 'bg-white text-indigo-600 shadow' : 'text-slate-600'}`}
        >
          <i className="fas fa-microphone mr-2"></i>Gravar Áudio
        </button>
      </div>

      {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md" role="alert">{error}</div>}

      {inputMode === 'text' && (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-40 p-4 border border-slate-600 bg-slate-900 text-white placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-500 transition-shadow"
            placeholder="Ex: 'Casamento para 100 pessoas com churrasco (picanha e alcatra) e feijoada como opção.'"
          ></textarea>
           <button
            onClick={handleSubmit}
            disabled={isLoading || !text.trim()}
            className="mt-4 w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 transition duration-300 ease-in-out shadow-lg text-lg"
          >
            Converter Pedido em Orçamento
          </button>
        </div>
      )}

      {inputMode === 'audio' && (
        <div className="text-center p-6 border-2 border-dashed border-slate-300 rounded-lg">
          {audioError && <p className="text-red-500 mb-4">{audioError}</p>}
          {status === 'idle' && (
            <button onClick={startRecording} className="bg-red-500 text-white rounded-full w-20 h-20 flex items-center justify-center mx-auto shadow-lg hover:bg-red-600 transition">
              <i className="fas fa-microphone text-3xl"></i>
            </button>
          )}
          {status === 'recording' && (
            <div>
              <button onClick={stopRecording} className="bg-slate-700 text-white rounded-full w-20 h-20 flex items-center justify-center mx-auto shadow-lg animate-pulse">
                <i className="fas fa-stop text-3xl"></i>
              </button>
              <p className="mt-4 text-slate-500">Gravando... clique para parar.</p>
            </div>
          )}
          {status === 'stopped' && audioUrl && (
            <div>
              <p className="font-semibold mb-2">Gravação concluída!</p>
              <audio src={audioUrl} controls className="w-full mb-4"></audio>
              <div className="flex gap-4 justify-center">
                <button onClick={resetRecording} className="bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 transition">
                  Gravar Novamente
                </button>
                <button onClick={handleAudioSubmit} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition">
                  Usar esta Gravação
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NewEstimate;
