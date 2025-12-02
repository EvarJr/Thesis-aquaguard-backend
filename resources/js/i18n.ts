// This file re-exports from the .tsx file to solve module resolution issues
// where the empty .ts file takes precedence over the .tsx file.
export * from './i18n.tsx';
