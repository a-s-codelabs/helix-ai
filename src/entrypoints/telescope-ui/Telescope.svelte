<script lang="ts">
  import TelescopeChatBox from "./TelescopeChatbox.svelte";
  import TelescopeInput from "./TelescopeInput.svelte";
  import type { InputProps } from "./type";
  import {
    convertAndStorePageMarkdown,
    getCachedPageMarkdown,
    clearCachedMarkdown,
  } from "@/lib/chatStore/markdown-cache-helper";

  let {
    inputState = $bindable(),
    inputValue = $bindable(),
    placeholder,
    isExpanded,
    suggestedQuestions,
    disabled,
    inputImageAttached = $bindable(),
    quotedContent = $bindable(),
    isInSidePanel = false,
    tabId = null,
    currentUrl = null,
    onInput,
    onStateChange,
    onAsk,
    onVoiceInput,
    onAttachment,
    onClear,
    onSuggestedQuestion,
    onSearchNavigation,
    onClose,
    messages,
    handleSuggestedQuestion,
    isStreaming = false,
    streamingMessageId = null,
    onStop,
    onDragStart,
  }: InputProps = $props();
</script>

<TelescopeChatBox
  {messages}
  {isInSidePanel}
  {suggestedQuestions}
  {onSuggestedQuestion}
  {onClose}
  {isStreaming}
  {streamingMessageId}
  {inputValue}
  {inputImageAttached}
  currentState={inputState}
  {onDragStart}
>
  {#snippet input()}
    <TelescopeInput
      {isInSidePanel}
      {inputState}
      {inputValue}
      {placeholder}
      {isExpanded}
      {suggestedQuestions}
      {disabled}
      hasChatBox={(messages ?? []).length > 0}
      bind:inputImageAttached
      {isStreaming}
      bind:quotedContent
      {onInput}
      {onStateChange}
      {onAsk}
      {onVoiceInput}
      {onAttachment}
      {onClear}
      {onSuggestedQuestion}
      {onSearchNavigation}
      {onClose}
      {onStop}
    />
  {/snippet}
</TelescopeChatBox>

<style>
</style>
