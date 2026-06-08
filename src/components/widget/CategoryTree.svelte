<script lang="ts">
import type { CategoryTreeNode } from "../../utils/content-utils";
import ButtonLink from "../control/ButtonLink.svelte";

interface Props {
	categories: CategoryTreeNode[];
}

let { categories }: Props = $props();

function renderNode(_cat: CategoryTreeNode, _lvl: number): void {
	// 递归渲染逻辑
}
</script>

{#each categories as cat (cat.fullPath)}
	<div class="category-item">
		<ButtonLink
			url={cat.url}
			badge={String(cat.count)}
			label={`View all posts in the ${cat.fullPath} category`}
			style={{ paddingLeft: `${0}rem` }}
		>
			{cat.name}
		</ButtonLink>
	</div>
{/each}
