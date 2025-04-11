// Type declarations for external modules
declare module 'react';
declare module 'react-dom/client';
declare module 'react/jsx-runtime';
declare module 'electron';
declare module 'tiktoken';
declare module 'ignore';
declare module 'gpt-3-encoder';

// Allow importing CSS files
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

// Allow importing various file types
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}
