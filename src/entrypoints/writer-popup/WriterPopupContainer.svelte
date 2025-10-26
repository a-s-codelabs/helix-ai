<script lang="ts">
  import WriterPopup from './WriterPopup.svelte';
  import { writerPopupState } from '../../lib/writerPopupStore';

  interface Props {
    onClose: () => void;
    onDragStart: (event: MouseEvent) => void;
  }

  let { onClose, onDragStart }: Props = $props();

  // Subscribe to the store
  let state = $derived($writerPopupState);
</script>

{#if state.visible && state.targetElement}
  <WriterPopup targetElement={state.targetElement} {onClose} {onDragStart} />
{/if}
