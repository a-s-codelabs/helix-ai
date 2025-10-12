<script module>
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Telescope from "./Telescope.svelte";
  import { fn } from "storybook/test";

  const { Story } = defineMeta({
    title: "Telescope/NoSummary",
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
  }}
/>

<Story
  name="Filled State"
  args={{
    state: "ask",
    placeholder: "Find or ask...",
    inputValue: "summarize the website and tell me",
  }}
/>

<Story
  name="Search State"
  args={{
    state: "search",
    placeholder: "Find or ask...",
    inputValue: "What",
    searchIndex: 1,
    totalResults: 19,
  }}
/>

<Story
  name="Image "
  args={{
    state: "ask",
    placeholder: "Find or ask...",
    inputValue: "",
    inputImageAttached: ["", "", ""],
    searchIndex: 1,
    totalResults: 19,
  }}
/>

<Story
  name="Summary State"
  args={{
    state: "summary",
    placeholder: "Find or ask...",
    inputValue: "summarize the website and tell me",
    // summaryTitle: "summarize the website and tell me",
    // summaryContent: `
    //   <p>Here's a breakdown of Ascodelabs (ascodelabs.com) based on what I found + observations & suggestions:</p>

    //   <h4>Ascodelabs (AS CodeLabs)</h4>
    //   <p>A modern software development agency specializing in:</p>
    //   <ul>
    //     <li>Custom web & mobile apps (React, Next.js, Tailwind)</li>
    //     <li>Dashboards & analytics solutions (real-time insights)</li>
    //     <li>Automation workflows (e.g., n8n integration)</li>
    //     <li>Dedicated developer teams / outsourcing</li>
    //   </ul>

    //   <h4>Portfolio & Work</h4>
    //   <p>They showcase projects like OKTRIA Dashboard and ThreeYem Stamp, highlighting their use of modern tech stacks.</p>

    //   <h4>Blog & Content</h4>
    //   <p>Regular insights on development practices and industry trends.</p>
    // `,
    // suggestedQuestions: [
    //   "Who are their main clients / industries they serve?",
    //   "How do they price / package their services?",
    //   "What technologies do they specialize in?",
    //   "Can you show me examples of their work?",
    // ],
  }}
/>

<Story
  name="Disabled State"
  args={{
    state: "search",
    placeholder: "Find or ask...",
    inputValue: "",
    disabled: true,
  }}
/>

<Story
  name="Long Text State (Auto-Expanding)"
  args={{
    state: "ask",
    placeholder: "Find or ask...",
    inputValue:
      "jfiphqdo [kvqodv[oiqbnv[oiqbvo[iqbeiov[bqoiefvboiqbefvoiqbovibq woibfvoqbovboiqbvoibqoibvoqbio[vboiqbvoibqoibvoqbvoqbvobq ovbo[qbvoqebo[vboqbvoqebvoqbvoiqbeivboqbvoqbvbqovboiqebv o[qebvobovbo[qbv[oiqbvoibvoibqobvoiqbvoqbvo[qbvoibqoivbqosi dvbqoiwberklmpfnvwfnvwkfnvfnvkwqfnvqnfvlnqfvknfqfhojkqdbvoq bdoivboqibvoijqboivboijqbvoubqioubvioubqiubeviubqiubevqbedv biuqbdviuqbdviubqiuvbiqubviuqbviubqiuvbiquubviuqubviuubqiuub viuuqidvbiuqsbdviuqbdviubiqubvqiubvqiubviasbviuqbdviuqbviqjvb iqbvjubqdub",
  }}
/>

<Story
  name="Multi-line Text State (Sora Font)"
  args={{
    state: "ask",
    placeholder: "Find or ask...",
    inputValue:
      "This is a multi-line text input that should expand automatically.\n\nIt should handle multiple lines and paragraphs.\n\nEach new line should increase the height of the input field.",
  }}
/>

<Story
  name="Very Long Single Line (Sora Font)"
  args={{
    state: "ask",
    placeholder: "Find or ask...",
    inputValue:
      "This is a very long single line of text that should trigger the expanding behavior when it exceeds the normal width and requires the input field to grow vertically to accommodate all the content without horizontal scrolling.",
  }}
/>

<Story
  name="Interactive Demo"
  args={{
    state: "search",
    placeholder: "Find or ask...",
    inputValue: "",
  }}
/>
