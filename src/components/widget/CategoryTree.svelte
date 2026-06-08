<script lang="ts">
import type { CategoryTreeNode } from "../../utils/content-utils";
import ButtonLink from "../control/ButtonLink.svelte";

export let categories: CategoryTreeNode[] = [];
export let level = 0;
</script>

{#each categories as cat}
	<div class="category-item">
		<ButtonLink
			url={cat.url}
			badge={String(cat.count)}
			label={`View all posts in the ${cat.fullPath} category`}
			style={{ paddingLeft: `${level * 1.5}rem` }}
		>
			{cat.name}
		</ButtonLink>
		{#if cat.children && cat.children.length > 0}
			<CategoryTree categories={cat.children} level={level + 1} />
		{/if}
	</div>
{/each}
