<script lang="ts">
  import { scale } from 'svelte/transition';
  /*@ts-ignore */
  import Sparkles from '../telescope-ui/icons/Sparkles.svelte';

  interface Props {
    x: number;
    y: number;
    onClick: () => void;
  }

  let { x, y, onClick }: Props = $props();
</script>

<button
  class="floating-button"
  style:left="{x}px"
  style:top="{y}px"
  onclick={onClick}
  transition:scale={{ duration: 150, start: 0.8 }}
  type="button"
  aria-label="AI Writer"
  title="AI Writer"
>
  <span class="icon">
    <Sparkles />
  </span>
</button>

<style>
  .floating-button {
    position: fixed;
    z-index: 2147483645;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: 2px solid white;
    box-shadow:
      0 4px 12px rgba(102, 126, 234, 0.4),
      0 2px 4px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    transition: all 0.2s ease;
    transform: translate(-50%, -50%);
  }

  .floating-button:hover {
    transform: translate(-50%, -50%) scale(1.1);
    box-shadow:
      0 6px 20px rgba(102, 126, 234, 0.5),
      0 3px 6px rgba(0, 0, 0, 0.15);
  }

  .floating-button:active {
    transform: translate(-50%, -50%) scale(0.95);
  }

  .icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
