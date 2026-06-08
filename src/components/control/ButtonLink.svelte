<script lang="ts">
export let badge: string | undefined = undefined;
export let url: string | undefined = undefined;
export let label: string | undefined = undefined;
export let style: Record<string, string> | undefined = undefined;
</script>

<a href={url} aria-label={label}>
    <button
        class="
            w-full
            h-10
            rounded-lg
            bg-none
            hover:bg-[var(--btn-plain-bg-hover)]
            active:bg-[var(--btn-plain-bg-active)]
            transition-all
            pl-2
            hover:pl-3
            
            text-neutral-700
            hover:text-[var(--primary)]
            dark:text-neutral-300
            dark:hover:text-[var(--primary)]
        "
        style={style}
    >
        <div class="flex items-center justify-between relative mr-2">
            <div class="overflow-hidden text-left whitespace-nowrap overflow-ellipsis">
                <slot></slot>
            </div>
            {#if badge !== undefined && badge !== null && badge !== ''}
                <div class="transition px-2 h-7 ml-4 min-w-[2rem] rounded-lg text-sm font-bold
                    text-[var(--btn-content)] dark:text-[var(--deep-text)]
                    bg-[var(--btn-regular-bg)] dark:bg-[var(--primary)]
                    flex items-center justify-center">
                    {badge}
                </div>
            {/if}
        </div>
    </button>
</a>
