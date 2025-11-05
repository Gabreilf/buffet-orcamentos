import { useState, useCallback, useRef } from 'react';

interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UndoRedoActions<T> {
  set: (newPresent: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const MAX_HISTORY_SIZE = 50;

export const useUndoRedo = <T>(initialState: T): [T, UndoRedoActions<T>] => {
  const [state, setState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  // Usamos useRef para armazenar o estado atual de forma mutável,
  // garantindo que as funções de callback (set, undo, redo) sempre tenham acesso ao estado mais recente
  // sem depender do array de dependências do useCallback.
  const stateRef = useRef(state);
  stateRef.current = state;

  const set = useCallback((newPresent: T) => {
    const currentState = stateRef.current;
    
    // Se o novo estado for idêntico ao atual, não faz nada
    if (newPresent === currentState.present) return;

    setState(prevState => {
      const { past, present } = prevState;
      
      // Adiciona o estado atual ao histórico (past)
      const newPast = [...past, present];
      
      // Limita o tamanho do histórico
      if (newPast.length > MAX_HISTORY_SIZE) {
        newPast.shift(); // Remove o estado mais antigo
      }

      return {
        past: newPast,
        present: newPresent,
        future: [], // Limpa o histórico de refazer
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState(prevState => {
      const { past, present, future } = prevState;
      if (past.length === 0) return prevState;

      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [present, ...future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState(prevState => {
      const { past, present, future } = prevState;
      if (future.length === 0) return prevState;

      const next = future[0];
      const newFuture = future.slice(1);

      return {
        past: [...past, present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  return [
    state.present,
    {
      set,
      undo,
      redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
    },
  ];
};