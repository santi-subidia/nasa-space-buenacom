// Evita que logs informativos C++ de MediaPipe / TensorFlow Lite emitidos por stderr
// (`INFO: Created TensorFlow Lite XNNPACK delegate for CPU.`) disparen el overlay de error de Next.js.

const PATRON_INFORMATIVO =
  /^(?:INFO:|WARNING:\s*All log messages before absl|I0000\b|W0000\b|gl_context)/i;

export function esLogInformativoMediaPipe(arg) {
  if (typeof arg !== 'string') return false;
  const texto = arg.trim();
  return (
    PATRON_INFORMATIVO.test(texto) ||
    texto.includes('Created TensorFlow Lite XNNPACK delegate')
  );
}

export function silenciarLogsMediaPipe() {
  if (typeof window === 'undefined' || typeof window.console?.error !== 'function') return;
  if (window.console.error.__mediapipeFiltrado) return;

  const original = window.console.error;
  const filtrado = (...args) => {
    if (esLogInformativoMediaPipe(args[0])) {
      window.console.debug?.(...args);
      return;
    }
    original.apply(window.console, args);
  };
  filtrado.__mediapipeFiltrado = true;
  window.console.error = filtrado;
}

if (typeof window !== 'undefined') {
  silenciarLogsMediaPipe();
}
