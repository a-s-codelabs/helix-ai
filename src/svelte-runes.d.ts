declare function $state<T>(value: T): T;
declare function $bindable<T>(value?: T): T;
declare function $derived<T>(callback: () => T): T;
declare function $effect(callback: () => void | (() => void)): void;
declare function $props<T = Record<string, unknown>>(): T;

declare namespace svelteHTML {
  type HTMLAttributes<T = HTMLElement> = Record<string, any>;
}
