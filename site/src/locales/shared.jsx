export const REPO = 'https://github.com/Fruit-Guardians/pinwhy';
export const DOCS = `${REPO}/blob/main/README.md`;
export const VERSION = import.meta.env?.VITE_PINWHY_VERSION || '0.5.0';
export const C = ({ children }) => <code>{children}</code>;
