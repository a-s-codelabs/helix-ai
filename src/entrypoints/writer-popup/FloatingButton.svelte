<script lang="ts">
  import { scale } from 'svelte/transition';
  /*@ts-ignore */
  import Helix from '../telescope-ui/icons/Helix.svelte';

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
    <!-- Replaced Sparkles with Helix icon per design -->
    <Helix />
  </span>
</button>

<style>
  .floating-button {
    position: fixed;
    z-index: 99999999;
    width: 24px;
    height: 24px;
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
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5),
      0 3px 6px rgba(0, 0, 0, 0.15);
  }

  .floating-button:active {
    transform: translate(-50%, -50%) scale(0.95);
  }

  .icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
