<script lang="ts">
import type { CategoryTreeNode } from "../../utils/content-utils";
import ButtonLink from "../control/ButtonLink.svelte";

interface Props {
	categories: CategoryTreeNode[];
	level?: number;
}

let { categories, level = 0 }: Props = $props();
</script>

{#each categories as cat (cat.fullPath)}
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
			<svelte:self categories={cat.children} level={level + 1} />
		{/if}
	</div>
{/each}

<style>
	.category-item {
		margin-bottom: 0.25rem;
	}
</style>
