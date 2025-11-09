import React, { useState, useCallback } from 'react';
import { Estimate, CustomCosts } from '../types';
import { generateEstimateFromText } from '../services/geminiService';
import Spinner from '../components/Spinner';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import PlanStatusBanner from '../components/PlanStatusBanner'; // Importando o banner

interface Profile {
    plan_type: string;
    plan: string;
    query_count: number;
    query_limit: number | null;
    is_active: boolean;
}

interface NewEstimateProps {
  onEstimateGenerated: (estimate: Estimate) => void;
  customCosts: CustomCosts;
  userProfile: Profile | null; // Novo prop
  onViewPlans: () => void; // Novo prop
}

type InputMode = 'text' | 'audio';

const NewEstimate: React.FC<NewEstimateProps> = ({ onEstimateGenerated, customCosts, userProfile, onViewPlans }) => {
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { status, audioUrl, error: audioError, startRecording, stopRecording, resetRecording } = useAudioRecorder();

  // Verifica se o limite de consultas foi atingido
  const isTrialExpired = userProfile && userProfile.plan_type === 'trial' && userProfile.query_limit !== null && userProfile.query_count >= userProfile.query_limit;

  const handleSubmit = useCallback(async () => {
    if (isTrialExpired) {
        setError('Seu limite de consultas do plano Teste foi atingido. Por favor, faça upgrade.');
        return;
    }
    
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
      // O geminiService já lança erros específicos de limite/expiração
      setError(e.message || 'Ocorreu um erro desconhecido.');
    } finally {
      setIsLoading(false);
    }
  }, [text, onEstimateGenerated, customCosts, isTrialExpired]);
  
  // A mock for audio processing as Gemini requires complex setup for direct audio input in this context.
  // In a real app, this would send the audio blob to a backend that uses Google Speech-to-Text or Gemini audio APIs.
  const handleAudioSubmit = () => {
      if (isTrialExpired) {
          setError('Seu limite de consultas do plano Teste foi atingido. Por favor, faça upgrade.');
          return;
      }
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
    <div className="max-w-4xl mx-auto">
      {userProfile && (
          <PlanStatusBanner profile={userProfile} onUpgradeClick={onViewPlans} />
      )}
      
      <div className="bg-white p-8 rounded-2xl shadow-2xl">
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

        {isTrialExpired && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md text-center" role="alert">
                <p className="font-bold mb-3">Limite de Consultas Atingido!</p>
                <p className="mb-4">Seu plano Teste permite apenas {userProfile?.query_limit} consultas. Faça upgrade para continuar gerando orçamentos.</p>
                <button
                    onClick={onViewPlans}
                    className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition duration-300 ease-in-out shadow-lg"
                >
                    Fazer Upgrade
                </button>
            </div>
        )}

        {inputMode === 'text' && (
          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-40 p-4 border border-slate-600 bg-slate-900 text-white placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-500 transition-shadow"
              placeholder="Ex: 'Casamento para 100 pessoas com churrasco (picanha e alcatra) e feijoada como opção.'"
              disabled={isTrialExpired}
            ></textarea>
             <button
              onClick={handleSubmit}
              disabled={isLoading || !text.trim() || isTrialExpired}
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
              <button 
                onClick={startRecording} 
                className={`rounded-full w-20 h-20 flex items-center justify-center mx-auto shadow-lg transition ${isTrialExpired ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}
                disabled={isTrialExpired}
              >
                <i className="fas fa-microphone text-3xl text-white"></i>
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
                  <button 
                    onClick={handleAudioSubmit} 
                    className={`font-bold py-2 px-4 rounded-lg transition ${isTrialExpired ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                    disabled={isTrialExpired}
                  >
                    Usar esta Gravação
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewEstimate;