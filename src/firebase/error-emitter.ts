import { FirestorePermissionError } from './errors';

type Listener = (error: FirestorePermissionError) => void;

class ErrorEmitter {
  private listeners: Listener[] = [];

  on(event: 'permission-error', listener: Listener) {
    this.listeners.push(listener);
  }

  off(event: 'permission-error', listener: Listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  emit(event: 'permission-error', error: FirestorePermissionError) {
    this.listeners.forEach(l => l(error));
  }
}

export const errorEmitter = new ErrorEmitter();
