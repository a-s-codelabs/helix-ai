<script lang="ts">
  import SelectionPopup from './SelectionPopup.svelte';
  import { selectionPopupState } from '../../lib/selectionPopupStore';
  import type { SelectionAction } from './types';

  interface Props {
    onAction: (action: SelectionAction, text: string) => void;
    onClose: () => void;
  }

  let { onAction, onClose }: Props = $props();

  // Subscribe to the store
  let state = $derived($selectionPopupState);

  function handleAction(action: SelectionAction) {
    onAction(action, state.selectedText);
  }
</script>

{#if state.visible}
  <SelectionPopup x={state.x} y={state.y} isAtTop={state.isAtTop} onAction={handleAction} {onClose} />
{/if}
