<script module>
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Telescope from "./Telescope.svelte";
  import { fn } from "storybook/test";

  const { Story } = defineMeta({
    title: "Telescope/Summary",
    component: Telescope,
    tags: ["autodocs"],
    argTypes: {
      state: {
        control: { type: "select" },
        options: ["ask", "search"],
        description: "Current state of the telescope component",
      },
      inputValue: {
        control: "text",
        description: "Current input value",
      },
      placeholder: {
        control: "text",
        description: "Placeholder text for the input",
      },
      searchIndex: {
        control: { type: "number", min: 1, max: 50 },
        description: "Current search result index",
      },
      totalResults: {
        control: { type: "number", min: 1, max: 100 },
        description: "Total number of search results",
      },
      suggestedQuestions: {
        control: "object",
        description: "Array of suggested questions",
      },
      disabled: {
        control: "boolean",
        description: "Whether the component is disabled",
      },
      messages: {
        control: "object",
        description: "Array of messages",
      },
    },
    args: {
      onInput: fn(),
      onAsk: fn(),
      onVoiceInput: fn(),
      onAttachment: fn(),
      onClear: fn(),
      onStateChange: fn(),
      onSuggestedQuestion: fn(),
      onSearchNavigation: fn(),
    },
  });
</script>

<Story
  name="Empty State"
  args={{
    state: "search",
    placeholder: "Find or ask...",
    totalResults: 5,
    inputValue: "",
    messages: [
      {
        role: "user",
        content: "<p>Hello, how are you?</p>",
        timeStamp: "2025-01-01T00:00:00.000Z",
      },
      {
        role: "assistant",
        content: `
<h1>What We Do Know / Can Infer</h1>
<p>Even though there’s no exact breakdown, based on what they present, you can guess how they likely structure their pricing:</p>

<ul>
    <li>Custom Quotes — They probably price on a project-by-project basis. Since they have varied services (dashboards, automation, custom apps), each project will differ in scope.</li>
    <li>Flexible Engagement Models — They mention things like “teams on demand / dedicated developers”, so they may offer hourly / retainer / dedicated resource pricing in addition to fixed-price projects.</li>
    <li>Value-based Pricing — Because they emphasize outcomes and portfolios, they might charge higher for features like real-time dashboards, automation workflows, integrations, etc.</li>
    <li>Free Estimates or Proposals — They have “Request Proposal / Quote” forms, which suggests they do proposals after discussing requirements.</li>
</ul>
`,
        timeStamp: "2025-01-01T00:00:00.000Z",
      },
    ],
    suggestedQuestions: [
      "What is the weather in Tokyo?",
      "What is the weather in London?",
      "What is the weather in Paris?",
    ],
  }}
/>

<Story
  name="With Input Value"
  args={{
    state: "search",
    placeholder: "Find or ask...",
    totalResults: 3,
    inputValue: "TypeScript tips",
    searchIndex: 2,
    messages: [
      {
        role: "user",
        content: "<p>Can you give me TypeScript tips?</p>",
        timeStamp: "2025-01-01T00:02:00.000Z",
      },
      {
        role: "assistant",
        content: `
<h2>TypeScript Best Practices</h2>
<ul>
  <li>Always use explicit types for function parameters and return values.</li>
  <li>Prefer <code>interface</code> over <code>type</code> for object shapes.</li>
  <li>Enable <code>strict</code> mode in your <code>tsconfig.json</code>.</li>
  <li>Use <code>as const</code> for literal types where possible.</li>
</ul>
`,
        timeStamp: "2025-01-01T00:03:00.000Z",
      },
    ],
    suggestedQuestions: [
      "What are union types?",
      "How do I use enums?",
      "What is type inference?",
    ],
  }}
/>

<Story
  name="Disabled State"
  args={{
    state: "ask",
    placeholder: "Ask anything...",
    totalResults: 1,
    inputValue: "",
    disabled: true,
    messages: [
      {
        role: "assistant",
        content:
          "<p>The system is currently in read-only mode. You cannot send messages right now.</p>",
        timeStamp: "2025-01-01T00:10:00.000Z",
      },
    ],
    suggestedQuestions: ["Why is messaging locked?", "Can I request access?"],
  }}
/>

<Story
  name="Multiple Messages"
  args={{
    state: "ask",
    placeholder: "Ask your question here...",
    totalResults: 2,
    inputValue: "Summarize mission status.",
    messages: [
      {
        role: "user",
        content: "<p>Summarize mission status.</p>",
        timeStamp: "2025-01-01T00:20:00.000Z",
      },
      {
        role: "assistant",
        content:
          "<p>The current mission status is nominal. All systems are green.</p>",
        timeStamp: "2025-01-01T00:21:00.000Z",
      },
      {
        role: "user",
        content: "<p>What about subsystem X?</p>",
        timeStamp: "2025-01-01T00:22:00.000Z",
      },
      {
        role: "assistant",
        content:
          "<p>Subsystem X is fully operational with no reported issues.</p>",
        timeStamp: "2025-01-01T00:23:00.000Z",
      },
    ],
    suggestedQuestions: ["Show subsystem health.", "What are known issues?"],
  }}
/>
