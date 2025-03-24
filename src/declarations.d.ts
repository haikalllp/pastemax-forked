// Type declarations for external modules
declare module "react" {
  export = React;
  export as namespace React;
  
  namespace React {
    interface RefObject<T> {
      readonly current: T | null;
    }
    
    function useRef<T>(initialValue: T | null): RefObject<T>;
    function createRef<T>(): RefObject<T>;
    function useEffect(effect: () => void | (() => void), deps?: any[]): void;
    function memo<T>(component: T): T;
    
    interface MouseEvent<T = Element> extends SyntheticEvent<T> {
      stopPropagation(): void;
      target: EventTarget & T;
    }
    
    interface ChangeEvent<T = Element> extends SyntheticEvent<T> {
      target: EventTarget & T;
    }
    
    interface SyntheticEvent<T = Element> {
      stopPropagation(): void;
      target: EventTarget & T;
    }
    
    interface EventTarget {
      checked?: boolean;
    }
    
    type MouseEventHandler<T = Element> = (event: MouseEvent<T>) => void;
    type ChangeEventHandler<T = Element> = (event: ChangeEvent<T>) => void;
  }
}

declare module "react-dom/client";
declare module "react/jsx-runtime";
declare module "electron";
declare module "tiktoken";
declare module "ignore";
declare module "gpt-3-encoder";

// Allow importing CSS files
declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}

// Allow importing various file types
declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}
