<script lang="ts">
  import SelectionPopup from "./SelectionPopup.svelte";
  import { selectionPopupState } from "../../lib/selectionPopupStore";

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  // Subscribe to the store
  let state = $derived($selectionPopupState);
</script>

{#if state.visible}
  <SelectionPopup x={state.x} y={state.y} isAtTop={state.isAtTop} {onClose} />
{/if}
