<script lang="ts">
  import FloatingButton from './FloatingButton.svelte';
  import WriterPopupContainer from './WriterPopupContainer.svelte';
  import { writerPopupStore } from '../../lib/writerPopupStore';

  let isDragging = $state(false);
  let dragOffset = $state({ x: 0, y: 0 });
  let popupContainer = $state<HTMLElement | undefined>(undefined);

  let visible = $state(false);
  let popupOpen = $state(false);
  let targetElement = $state<HTMLTextAreaElement | HTMLInputElement | null>(
    null
  );
  let x = $state(0);
  let y = $state(0);

  $effect(() => {
    const unsubscribe = writerPopupStore.subscribe((state) => {
      visible = state.visible;
      popupOpen = state.popupOpen;
      targetElement = state.targetElement;
      x = state.x;
      y = state.y;
    });
    return unsubscribe;
  });

  function handleOpenPopup() {
    writerPopupStore.setPopupOpen(true);
  }

  function handleClose() {
    writerPopupStore.hide();
  }

  function handleDragStart(event: MouseEvent) {
    if (popupContainer) {
      isDragging = true;
      const rect = popupContainer.getBoundingClientRect();
      dragOffset.x = event.clientX - rect.left;
      dragOffset.y = event.clientY - rect.top;
      event.preventDefault();
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (isDragging && popupContainer) {
      const newLeft = Math.max(
        0,
        Math.min(
          window.innerWidth - popupContainer.offsetWidth,
          event.clientX - dragOffset.x
        )
      );
      const newTop = Math.max(
        0,
        Math.min(
          window.innerHeight - popupContainer.offsetHeight,
          event.clientY - dragOffset.y
        )
      );

      popupContainer.style.left = newLeft + 'px';
      popupContainer.style.top = newTop + 'px';
    }
  }

  function handleMouseUp() {
    if (isDragging) {
      isDragging = false;
    }
  }

  $effect(() => {
    if (popupOpen) {
      if (popupContainer && x && y) {
        popupContainer.style.left = Math.max(10, x - 180) + 'px';
        popupContainer.style.top = Math.max(10, y - 60) + 'px';
      }

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  });
</script>

{#if visible && targetElement}
  {#if !popupOpen}
    <FloatingButton {x} {y} onClick={handleOpenPopup} />
  {:else}
    <div class="popup-wrapper" bind:this={popupContainer}>
      <WriterPopupContainer
        onClose={handleClose}
        onDragStart={handleDragStart}
      />
    </div>
  {/if}
{/if}

<style>
  .popup-wrapper {
    position: fixed;
    z-index: 2147483646;
  }
</style>
