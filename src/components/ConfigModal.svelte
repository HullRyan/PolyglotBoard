<script>
    import { createEventDispatcher } from "svelte";
    import { loadModel } from "$lib/utils/tts";

    export let box = { id: "", label: "", text: "", targetLang: "es" };
    export let isOpen = false;

    const dispatch = createEventDispatcher();

    const languages = [
        { code: "es", name: "Spanish" },
        { code: "fr", name: "French" },
        { code: "de", name: "German" },
        { code: "it", name: "Italian" },
        { code: "ja", name: "Japanese" },
        { code: "ko", name: "Korean" },
        { code: "zh-CN", name: "Chinese (Simplified)" },
        { code: "ru", name: "Russian" },
        { code: "pt", name: "Portuguese" },
        { code: "nl", name: "Dutch" },
    ];

    // Track if label was manually edited to avoid overwriting
    let labelManuallyEdited = false;

    /** @param {any} e */
    function handleTextChange(e) {
        const newText = e.target.value;
        // If label hasn't been manually edited (or is empty/same as old text), update it
        if (!labelManuallyEdited || !box.label || box.label === box.text) {
            box.label = newText;
            // Reset manual edit flag if we sync them up
            if (box.label === newText) labelManuallyEdited = false;
        }
    }

    function handleLabelChange() {
        labelManuallyEdited = true;
    }

    async function handleLangChange() {
        // Preload the model for the selected language
        console.log(`Preloading model for ${box.targetLang}...`);
        try {
            await loadModel(box.targetLang);
            console.log(`Model for ${box.targetLang} preloaded.`);
        } catch (e) {
            console.error(`Failed to preload model for ${box.targetLang}`, e);
        }
    }

    function save() {
        dispatch("save", box);
        isOpen = false;
    }

    function close() {
        dispatch("close");
        isOpen = false;
    }
</script>

<svelte:window
    on:keydown={(e) => {
        if (e.key === "Escape") close();
    }}
/>

{#if isOpen}
    <div
        class="modal-backdrop"
        on:click={close}
        on:keydown={(e) => {
            if (e.key === "Enter" || e.key === " ") close();
        }}
        role="button"
        tabindex="0"
    >
        <div
            class="modal glass-panel"
            on:click|stopPropagation
            on:keydown|stopPropagation
            role="dialog"
            aria-modal="true"
            tabindex="-1"
        >
            <h2>Configure Button</h2>

            <div class="form-group">
                <label for="text">Text to Translate/Speak</label>
                <textarea
                    id="text"
                    bind:value={box.text}
                    on:input={handleTextChange}
                    placeholder="Text to translate..."
                ></textarea>
            </div>

            <div class="form-group">
                <label for="label">Label</label>
                <input
                    id="label"
                    type="text"
                    bind:value={box.label}
                    on:input={handleLabelChange}
                    placeholder="e.g. Hello (Spanish)"
                />
            </div>

            <div class="form-group">
                <label for="lang">Target Language</label>
                <select
                    id="lang"
                    bind:value={box.targetLang}
                    on:change={handleLangChange}
                >
                    {#each languages as lang}
                        <option value={lang.code}>{lang.name}</option>
                    {/each}
                </select>
            </div>

            <div class="actions">
                <button class="btn-secondary" on:click={close}>Cancel</button>
                <button class="btn-primary" on:click={save}>Save</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 100;
        backdrop-filter: blur(4px);
    }

    .modal {
        padding: 2rem;
        width: 90%;
        max-width: 500px;
        color: var(--text-color);
    }

    h2 {
        margin-top: 0;
        margin-bottom: 1.5rem;
    }

    .form-group {
        margin-bottom: 1.5rem;
    }

    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: var(--secondary-color);
    }

    input,
    textarea,
    select {
        width: 100%;
        padding: 0.75rem;
        border-radius: 0.5rem;
        border: 1px solid var(--glass-border);
        background: rgba(0, 0, 0, 0.2);
        color: white;
        font-family: inherit;
        box-sizing: border-box;
    }

    input:focus,
    textarea:focus,
    select:focus {
        outline: none;
        border-color: var(--primary-color);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
        margin-top: 2rem;
    }

    .btn-secondary {
        background: transparent;
        border: 1px solid var(--glass-border);
        color: var(--text-color);
        padding: 0.75rem 1.5rem;
        border-radius: 0.5rem;
        cursor: pointer;
    }

    .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.05);
    }
</style>
