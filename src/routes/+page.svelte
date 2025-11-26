<script>
    import { boxes, theme, title } from "$lib/stores";
    import { dndzone } from "svelte-dnd-action";
    import { flip } from "svelte/animate";
    import ConfigModal from "../components/ConfigModal.svelte";
    import { translateText } from "$lib/utils/translation_service";
    import { speakText, preloadAudio } from "$lib/utils/tts.js";
    import { fade, scale } from "svelte/transition";
    import { onMount } from "svelte";

    /** @type {boolean} */
    let isEditMode = false;
    /** @type {boolean} */
    let showModal = false;
    /** @type {any} */
    let currentBox = { id: "", label: "", text: "", targetLang: "es" };
    /** @type {string | null} */
    let currentRowId = null; // Track which row we are adding/editing in
    /** @type {boolean} */
    let isNewBox = false;
    /** @type {string | null} */
    let loadingBoxId = null;
    // Track boxes that are preparing (translating/caching audio)
    /** @type {Set<string>} */
    let preparingBoxIds = new Set();

    const flipDurationMs = 300;

    onMount(() => {
        // Preload audio for all boxes on load
        // We do this sequentially to avoid freezing the UI too much
        (async () => {
            for (const row of $boxes) {
                for (const box of row.items) {
                    const text = box.translatedText || box.text;
                    if (text) {
                        // Mark as preparing
                        preparingBoxIds.add(box.id);
                        $boxes = $boxes; // Trigger reactivity

                        try {
                            console.log(
                                `Preloading audio for box ${box.id}...`,
                            );
                            await preloadAudio(text, box.targetLang);
                        } catch (e) {
                            console.error(`Failed to preload box ${box.id}`, e);
                        } finally {
                            // Done preparing
                            preparingBoxIds.delete(box.id);
                            preparingBoxIds = preparingBoxIds; // Trigger reactivity
                        }
                    }
                }
            }
        })();
    });

    /**
     * @param {string} rowId
     * @param {any} e
     */
    function handleDndConsider(rowId, e) {
        const rowIdx = $boxes.findIndex((r) => r.id === rowId);
        if (rowIdx > -1) {
            $boxes[rowIdx].items = e.detail.items;
            $boxes = $boxes;
        }
    }

    /**
     * @param {string} rowId
     * @param {any} e
     */
    function handleDndFinalize(rowId, e) {
        const rowIdx = $boxes.findIndex((r) => r.id === rowId);
        if (rowIdx > -1) {
            $boxes[rowIdx].items = e.detail.items;
            $boxes = $boxes;
        }
    }

    /**
     * @param {any} box
     */
    async function handleBoxClick(box) {
        // Prevent click if preparing
        if (preparingBoxIds.has(box.id)) return;

        if (isEditMode) {
            currentBox = { ...box };
            // Find row id for this box
            currentRowId =
                $boxes.find((r) =>
                    r.items.find((/** @type {any} */ b) => b.id === box.id),
                )?.id || null;
            isNewBox = false;
            showModal = true;
        } else {
            loadingBoxId = box.id;
            try {
                let textToSpeak = box.translatedText;

                if (!textToSpeak) {
                    console.log("Cache miss, translating...");
                    textToSpeak = await translateText(box.text, box.targetLang);

                    // Cache it for next time (optional, but good UX)
                    $boxes = $boxes.map((row) => ({
                        ...row,
                        items: row.items.map((/** @type {any} */ b) =>
                            b.id === box.id
                                ? { ...b, translatedText: textToSpeak }
                                : b,
                        ),
                    }));
                } else {
                    console.log("Using cached translation");
                }

                console.log("Translated:", textToSpeak);
                // speakText is now async and handles audio playback
                await speakText(
                    textToSpeak,
                    box.targetLang,
                    () => console.log("Speaking..."),
                    () => (loadingBoxId = null),
                );
            } catch (e) {
                console.error(e);
                alert("Translation or TTS failed");
                loadingBoxId = null;
            }
        }
    }

    /**
     * @param {string} rowId
     */
    function addBox(rowId) {
        currentBox = {
            id: Date.now().toString(),
            label: "",
            text: "",
            targetLang: "es",
        };
        currentRowId = rowId;
        isNewBox = true;
        showModal = true;
    }

    /**
     * @param {CustomEvent<any>} e
     */
    async function saveBox(e) {
        const box = e.detail;

        // 1. Save immediately to update UI
        if (isNewBox) {
            const rowIdx = $boxes.findIndex((r) => r.id === currentRowId);
            if (rowIdx > -1) {
                $boxes[rowIdx].items = [...$boxes[rowIdx].items, box];
                $boxes = $boxes;
            }
        } else {
            // Find row and update
            $boxes = $boxes.map((row) => {
                const itemIdx = row.items.findIndex((b) => b.id === box.id);
                if (itemIdx > -1) {
                    const newItems = [...row.items];
                    newItems[itemIdx] = box;
                    return { ...row, items: newItems };
                }
                return row;
            });
        }

        // 2. Trigger background translation to cache it
        try {
            // Mark as preparing
            preparingBoxIds.add(box.id);
            $boxes = $boxes; // Trigger reactivity for Set

            console.log("Caching translation in background...");
            const translated = await translateText(box.text, box.targetLang);

            $boxes = $boxes.map((row) => ({
                ...row,
                items: row.items.map((/** @type {any} */ b) => {
                    if (b.id === box.id) {
                        return { ...b, translatedText: translated };
                    }
                    return b;
                }),
            }));
            console.log("Translation cached:", translated);

            // 3. Preload audio
            console.log("Preloading audio...");
            await preloadAudio(translated, box.targetLang);
            console.log("Audio preloaded");
        } catch (err) {
            console.error("Background translation/audio failed", err);
        } finally {
            preparingBoxIds.delete(box.id);
            preparingBoxIds = preparingBoxIds; // Trigger reactivity
        }
    }

    /**
     * @param {MouseEvent} e
     * @param {string} id
     */
    function deleteBox(e, id) {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this button?")) {
            $boxes = $boxes.map((row) => ({
                ...row,
                items: row.items.filter((/** @type {any} */ b) => b.id !== id),
            }));
        }
    }

    function toggleTheme() {
        $theme = $theme === "dark" ? "light" : "dark";
    }
</script>

<div class="container">
    <header>
        {#if isEditMode}
            <input
                bind:value={$title}
                class="title-input"
                placeholder="Board Title"
                aria-label="Board Title"
            />
        {:else}
            <h1>{$title}</h1>
        {/if}
        <div class="controls">
            <button
                class="btn-icon"
                on:click={toggleTheme}
                title="Toggle Theme"
                aria-label="Toggle Theme"
            >
                {#if $theme === "dark"}
                    <!-- Sun Icon for Light Mode switch -->
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle cx="12" cy="12" r="5"></circle>
                        <line x1="12" y1="1" x2="12" y2="3"></line>
                        <line x1="12" y1="21" x2="12" y2="23"></line>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"
                        ></line>
                        <line x1="1" y1="12" x2="3" y2="12"></line>
                        <line x1="21" y1="12" x2="23" y2="12"></line>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                    </svg>
                {:else}
                    <!-- Moon Icon for Dark Mode switch -->
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path
                            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                        ></path>
                    </svg>
                {/if}
            </button>
            <button
                class="btn-secondary"
                on:click={() => (isEditMode = !isEditMode)}
            >
                {isEditMode ? "Done" : "Edit Mode"}
            </button>
        </div>
    </header>

    <div class="rows-container">
        {#each $boxes as row (row.id)}
            <div class="row-wrapper">
                {#if isEditMode}
                    <div class="row-controls">
                        <button class="btn-sm" on:click={() => addBox(row.id)}
                            >+ Add Button</button
                        >
                    </div>
                {/if}
                <section
                    use:dndzone={{
                        items: row.items,
                        flipDurationMs,
                        dragDisabled: !isEditMode,
                        type: "box",
                    }}
                    on:consider={(/** @type {any} */ e) =>
                        handleDndConsider(row.id, e)}
                    on:finalize={(/** @type {any} */ e) =>
                        handleDndFinalize(row.id, e)}
                    class="grid"
                >
                    {#each row.items as box (box.id)}
                        <div
                            class="box glass-panel"
                            animate:flip={{ duration: flipDurationMs }}
                            on:click={() => handleBoxClick(box)}
                            on:keydown={(e) =>
                                e.key === "Enter" && handleBoxClick(box)}
                            role="button"
                            tabindex="0"
                            class:editing={isEditMode}
                            class:loading={loadingBoxId === box.id}
                            class:preparing={preparingBoxIds.has(box.id)}
                        >
                            {#if isEditMode}
                                <button
                                    class="delete-btn"
                                    on:click={(e) => deleteBox(e, box.id)}
                                    >×</button
                                >
                            {/if}

                            <div class="content">
                                <span class="icon">
                                    {#if loadingBoxId === box.id || preparingBoxIds.has(box.id)}
                                        <div class="spinner"></div>
                                    {:else}
                                        🗣️
                                    {/if}
                                </span>
                                <h3>{box.label || "Untitled"}</h3>
                                <p class="lang-badge">{box.targetLang}</p>
                            </div>
                        </div>
                    {/each}
                </section>
            </div>
        {/each}
    </div>
</div>

<ConfigModal bind:isOpen={showModal} box={currentBox} on:save={saveBox} />

<style>
    .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
    }

    header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 3rem;
    }

    h1 {
        font-size: 2.5rem;
        background: linear-gradient(
            to right,
            var(--primary-color),
            var(--accent-color)
        );
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0;
    }

    .controls {
        display: flex;
        gap: 1rem;
    }

    .grid {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 1.5rem;
        min-height: 200px;
    }

    .box {
        width: 200px;
        aspect-ratio: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 1.5rem;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
        text-align: center;
    }

    .box:hover {
        background: rgba(255, 255, 255, 0.1);
        transform: translateY(-4px);
    }

    .box.editing {
        border-style: dashed;
        cursor: grab;
    }

    .box.loading {
        opacity: 0.7;
        cursor: wait;
    }

    .box.preparing {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .content {
        pointer-events: none; /* Let clicks pass to box */
    }

    .icon {
        font-size: 2rem;
        margin-bottom: 1rem;
        display: block;
        height: 40px; /* Fixed height to prevent jumping */
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .spinner {
        width: 24px;
        height: 24px;
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: var(--accent-color);
        animation: spin 1s ease-in-out infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1.1rem;
    }

    .lang-badge {
        font-size: 0.8rem;
        color: var(--secondary-color);
        text-transform: uppercase;
        letter-spacing: 1px;
        margin: 0;
    }

    .delete-btn {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        background: rgba(239, 68, 68, 0.2);
        color: #fca5a5;
        border: none;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1.2rem;
        line-height: 1;
    }

    .delete-btn:hover {
        background: rgba(239, 68, 68, 0.4);
    }

    .btn-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        color: var(--text-color);
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-icon:hover {
        background: var(--glass-border);
        transform: scale(1.1);
    }

    .btn-secondary {
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        color: var(--text-color);
        padding: 0.75rem 1.5rem;
        border-radius: 0.5rem;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
    }

    .btn-secondary:hover {
        background: var(--glass-border);
    }
    .rows-container {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .row-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .row-controls {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .btn-sm {
        padding: 0.25rem 0.75rem;
        font-size: 0.875rem;
        border-radius: 0.25rem;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid var(--glass-border);
        color: var(--text-color);
        cursor: pointer;
    }

    .btn-sm:hover {
        background: rgba(255, 255, 255, 0.2);
    }

    .title-input {
        font-size: 2.5rem;
        font-weight: bold;
        background: transparent;
        border: none;
        border-bottom: 2px solid var(--accent-color);
        color: var(--text-color);
        width: 100%;
        max-width: 500px;
        padding: 0.25rem;
        outline: none;
        font-family: inherit;
    }

    .title-input:focus {
        border-bottom-color: var(--primary-color);
    }
</style>
