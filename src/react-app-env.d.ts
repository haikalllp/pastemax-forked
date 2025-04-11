/// <reference types="react" />
/// <reference types="react-dom" />

// Add missing TypeScript definitions
declare namespace React {
  interface MouseEvent<T = Element> extends globalThis.MouseEvent {
    readonly currentTarget: T;
  }
  interface ChangeEvent<T = Element> extends Event {
    readonly target: T;
  }
}
