<script lang="ts">
  import { option } from "./optionType/index";
  import CloseIcon from "./icons/Close.svelte";
  import TrashIcon from "./icons/Trash.svelte";

  type Intent = "prompt" | "summarise" | "translate" | "write" | "rewrite";
  type IntentKey = keyof typeof option;

  type OptionValue = string | number;
  type SettingsValues = Record<string, OptionValue>;

  let {
    intent,
    values = $bindable({} as SettingsValues),
    onChange,
    onClose,
    onSave,
    onReset,
  } = $props();

  const currentOptions = $derived(
    intent && option[intent as IntentKey] ? option[intent as IntentKey] : []
  );

  $effect(() => {
    if (!intent) return;

    const intentKey = intent as IntentKey;
    const options = option[intentKey] || [];

    const currentOptionIds = new Set(
      options.map((opt) => opt.id).filter(Boolean)
    );

    Object.keys(values).forEach((key) => {
      if (!currentOptionIds.has(key)) {
        delete values[key];
      }
    });

    options.forEach((opt) => {
      if (opt.id && values[opt.id] === undefined) {
        if (opt.defaultValue !== undefined) {
          values[opt.id] = opt.defaultValue;
        } else if (
          opt.uiType === "dropdown" &&
          opt.options &&
          opt.options.length > 0
        ) {
          const firstOption = opt.options[0];
          if (typeof firstOption === "object" && "value" in firstOption) {
            values[opt.id] = firstOption.value;
          }
        } else if (opt.uiType === "slider" && opt.min !== undefined) {
          values[opt.id] = opt.min;
        }
      }
    });
  });

  function getDefaultValues(): SettingsValues {
    if (!intent) return {};

    const intentKey = intent as IntentKey;
    const options = option[intentKey] || [];
    const defaults: SettingsValues = {};

    options.forEach((opt) => {
      if (opt.id) {
        if (opt.defaultValue !== undefined) {
          defaults[opt.id] = opt.defaultValue;
        } else if (
          opt.uiType === "dropdown" &&
          opt.options &&
          opt.options.length > 0
        ) {
          const firstOption = opt.options[0];
          if (typeof firstOption === "object" && "value" in firstOption) {
            defaults[opt.id] = firstOption.value;
          }
        } else if (opt.uiType === "slider" && opt.min !== undefined) {
          defaults[opt.id] = opt.min;
        }
      }
    });

    return defaults;
  }

  function handleDropdownChange(optionId: string, value: OptionValue) {
    values[optionId] = value;
    onChange?.({ id: optionId, value });
    if (intent) {
      setTimeout(() => {
        onSave?.({ intent, values: { ...values } });
      }, 0);
    }
  }

  function handleSliderChange(optionId: string, value: number) {
    values[optionId] = value;
    onChange?.({ id: optionId, value });
    if (intent) {
      setTimeout(() => {
        onSave?.({ intent, values: { ...values } });
      }, 0);
    }
  }

  function handleReset() {
    if (!intent) return;

    const defaults = getDefaultValues();
    Object.keys(values).forEach((key) => {
      if (defaults[key] !== undefined) {
        values[key] = defaults[key];
      } else {
        delete values[key];
      }
    });

    Object.assign(values, defaults);

    onSave?.({ intent, values: { ...values } });
    onReset?.();
  }

  function getCurrentValue(optionId: string): OptionValue {
    return values[optionId] ?? "";
  }
</script>

{#if intent}
  {#if currentOptions.length > 0}
    <div class="settings-popup" role="dialog" aria-label="Settings">
      <div class="settings-header">
        <h3 class="settings-title">Settings</h3>
        <div class="header-buttons">
          <button
            class="trash-button"
            onclick={handleReset}
            title="Reset to defaults"
            aria-label="Reset to defaults"
          >
            <TrashIcon />
          </button>
          <button
            class="close-button"
            onclick={onClose}
            title="Close settings"
            aria-label="Close settings"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div class="settings-content">
        {#each currentOptions as opt (opt.id || opt.name)}
          {#if opt.id && opt.name}
            <div class="settings-option">
              {#if opt.uiType === "dropdown" && opt.options}
                <label class="option-label" for={opt.id}>
                  {opt.name}
                </label>
                <select
                  id={opt.id}
                  class="option-dropdown"
                  value={String(getCurrentValue(opt.id))}
                  onchange={(e) => {
                    if (!opt.id) return;
                    const target = e.currentTarget;
                    const selectedValue = opt.options?.find(
                      (o) => String(o.value) === target.value
                    )?.value;
                    if (selectedValue !== undefined) {
                      handleDropdownChange(opt.id, selectedValue);
                    }
                  }}
                >
                  {#each opt.options as optionItem}
                    <option value={String(optionItem.value)}>
                      {optionItem.label}
                    </option>
                  {/each}
                </select>
              {/if}

              {#if opt.uiType === "slider"}
                <div class="slider-container">
                  <label class="option-label" for={opt.id}>
                    {opt.name}
                    <span class="slider-value">{getCurrentValue(opt.id)}</span>
                  </label>
                  <input
                    type="range"
                    id={opt.id}
                    class="option-slider"
                    min={opt.min ?? 0}
                    max={opt.max ?? 100}
                    step={opt.step ?? 1}
                    value={Number(getCurrentValue(opt.id))}
                    oninput={(e) => {
                      if (!opt.id) return;
                      handleSliderChange(opt.id, Number(e.currentTarget.value));
                    }}
                  />
                </div>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {:else}
    <div class="settings-popup" role="dialog" aria-label="Settings">
      <div class="settings-header">
        <h3 class="settings-title">Settings</h3>
        <div class="header-buttons">
          <button
            class="trash-button"
            onclick={handleReset}
            title="Reset to defaults"
            aria-label="Reset to defaults"
          >
            <TrashIcon />
          </button>
          <button
            class="close-button"
            onclick={onClose}
            title="Close settings"
            aria-label="Close settings"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      <div class="settings-content">
        <p style="color: #9ca3af; font-size: 14px;">
          No settings available for this intent.
        </p>
      </div>
    </div>
  {/if}
{/if}

<style>
  .settings-popup {
    position: absolute;
    bottom: 40px;
    right: 0;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 12px;
    padding: 16px;
    min-width: 280px;
    max-width: 320px;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    animation: fadeInUp 0.2s ease;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #374151;
  }

  .settings-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #e5e7eb;
  }

  .header-buttons {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .close-button {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: #374151;
    color: #d1d5db;
  }

  .settings-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: calc(100vh - 300px);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #374151 transparent;
  }

  /* .reset-button {
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 6px;
    color: #e5e7eb;
    font-size: 13px;
    font-weight: 500;
    padding: 6px 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  } */

  /* .reset-button:hover {
    background: #4b5563;
    border-color: #6b7280;
    color: #f3f4f6;
  } */

  /* .reset-button:active {
    background: #1f2937;
    transform: scale(0.98);
  } */

  .trash-button {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .trash-button:hover {
    background: #374151;
    color: #ef4444;
  }

  .trash-button:active {
    background: #1f2937;
    transform: scale(0.98);
  }

  .settings-option {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-label {
    font-size: 13px;
    font-weight: 500;
    color: #d1d5db;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .slider-value {
    font-size: 12px;
    color: #9ca3af;
    font-weight: 600;
    background: #374151;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .option-dropdown {
    background: #131723;
    border: 1px solid #374151;
    border-radius: 6px;
    color: #e5e7eb;
    font-size: 14px;
    padding: 8px 12px;
    cursor: pointer;
    outline: none;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .option-dropdown:hover {
    border-color: #4b5563;
    background: #1a1f2e;
  }

  .option-dropdown:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .option-dropdown option {
    background: #131723;
    color: #e5e7eb;
  }

  .slider-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: #374151;
    outline: none;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    margin: 5px 0;
  }

  .option-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-top: -5px;
  }

  .option-slider::-webkit-slider-thumb:hover {
    background: #2563eb;
    transform: scale(1.1);
  }

  .option-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
    margin-top: -5px;
  }

  .option-slider::-moz-range-thumb:hover {
    background: #2563eb;
    transform: scale(1.1);
  }

  .option-slider::-webkit-slider-runnable-track {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: #374151;
  }

  .option-slider::-moz-range-track {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: #374151;
  }
</style>
