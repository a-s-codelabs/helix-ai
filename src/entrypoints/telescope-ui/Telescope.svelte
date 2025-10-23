<script lang="ts">
  import TelescopeChatBox from "./TelescopeChatbox.svelte";
  import TelescopeInput from "./TelescopeInput.svelte";
  import type { InputProps } from "./type";

  let {
    inputState = $bindable(),
    inputValue = $bindable(),
    placeholder,
    searchIndex,
    totalResults,
    isExpanded,
    suggestedQuestions,
    disabled,
    inputImageAttached = $bindable(),
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
  }: InputProps = $props();

  $effect(() => {
    if ((messages ?? []).length > 0) {
      inputState = "chat";
      return;
    }
    if (
      (inputValue ?? "").includes("\n") ||
      (inputImageAttached ?? []).length > 0 ||
      totalResults === 0
    ) {
      inputState = "ask";
    } else {
      inputState = "search";
    }

    console.log("inputState", inputState);
    console.log("messages", $state.snapshot(messages));
    console.log("inputImageAttached", inputImageAttached);
    console.log("totalResults", totalResults);
    console.log("inputValue", inputValue);
  });

  // function onInput({ value }: { value: string }) {
  //   console.log("onInput", value);
  //   // inputValue = value;
  //   // onInput?.({ value });
  // }
</script>

<TelescopeChatBox
  {messages}
  {suggestedQuestions}
  {onSuggestedQuestion}
  {onClose}
  {isStreaming}
  {streamingMessageId}
>
  {#snippet input()}
    <TelescopeInput
      {inputState}
      {inputValue}
      {placeholder}
      {searchIndex}
      {totalResults}
      {isExpanded}
      {suggestedQuestions}
      {disabled}
      {inputImageAttached}
      {isStreaming}
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
